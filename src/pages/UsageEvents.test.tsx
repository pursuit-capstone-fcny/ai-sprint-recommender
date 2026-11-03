import { StrictMode } from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../fixtures/public-catalog.json';
import { toCatalogItem } from '../contracts/catalogItem';
import { parsePublicCatalog } from '../contracts/publicCatalog';
import { UsageEventSchema } from '../contracts/usageEvent';
import { createUsageSender } from '../usage/sendUsage';
import { buildAnalyticsReport } from '../analytics/report';
import { IntakeResults } from './IntakeResults';
import { IntakeResultsPage } from './IntakeResultsPage';

const publicCatalog = parsePublicCatalog({
  ...fixture,
  functionAreas: ['Operations'],
  tools: ['ChatGPT'],
  tasks: ['report writing'],
  synonyms: [],
  adjacentTools: [],
  items: Array.from({ length: 4 }, (_, i) => ({
    youtubeId: `fixture000${i}`,
    title: `Fixture video ${i}`,
    description: 'Public fixture.',
    functionAreas: ['Operations'],
    tasks: ['report writing'],
    tools: ['ChatGPT'],
    addedAt: `2026-01-0${4 - i}`,
    lengthSeconds: null,
    status: 'active',
    startHere: false,
  })),
});
const catalog = publicCatalog.items.map(toCatalogItem);
const endpoint = 'https://script.google.com/macros/s/test/exec';
const logged = () =>
  vi
    .mocked(fetch)
    .mock.calls.filter(([, options]) => options?.method === 'POST')
    .map(([, options]) =>
      UsageEventSchema.parse(JSON.parse(String(options?.body))),
    );
function session() {
  return {
    sessionId: crypto.randomUUID(),
    src: 'pilot' as const,
    sender: createUsageSender(endpoint),
  };
}
function submit() {
  fireEvent.click(screen.getByRole('radio', { name: 'Deterministic' }));
  fireEvent.click(screen.getByRole('button', { name: 'Find videos' }));
}
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockImplementation(async () =>
        Response.json({ ok: true, status: 'accepted' }),
      ),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('browser usage events', () => {
  it('AC-16.7: every Clear resets direct views even without a submitted search', async () => {
    render(
      <StrictMode>
        <IntakeResults
          catalog={catalog}
          usage={{ session: session(), catalog: publicCatalog }}
        />
      </StrictMode>,
    );
    const contexts = new Set<string>();
    for (let visit = 0; visit < 3; visit++) {
      fireEvent.click(
        screen.getByRole('button', { name: 'Play Fixture video 0' }),
      );
      await waitFor(() =>
        expect(logged().filter((event) => event.type === 'click')).toHaveLength(
          visit + 1,
        ),
      );
      const event = logged().at(-1)!;
      expect(event.mode).toBe('direct');
      expect(contexts.has(event.searchId)).toBe(false);
      contexts.add(event.searchId);
      expect(
        logged().filter((event) => event.type === 'impression'),
      ).toHaveLength(visit + 1);
      const count = logged().length;
      fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
      expect(logged()).toHaveLength(count);
    }
    expect(logged().some((event) => event.type === 'search')).toBe(false);
  });

  it('AC-16.7/24.19: passive browsing sends nothing; actual browsing actions count only as direct use', async () => {
    const usage = { session: session(), catalog: publicCatalog };
    const view = (
      <StrictMode>
        <IntakeResults catalog={catalog} usage={usage} />
      </StrictMode>
    );
    const { rerender } = render(view);
    expect(logged()).toHaveLength(0);
    rerender(view);
    expect(logged()).toHaveLength(0);
    fireEvent.click(
      screen.getByRole('button', { name: 'Play Fixture video 0' }),
    );
    fireEvent.click(
      screen.getAllByRole('link', { name: /Watch on YouTube/ })[0],
    );
    await waitFor(() => expect(logged()).toHaveLength(3));
    expect(logged().map((event) => event.type)).toEqual([
      'impression',
      'click',
      'click',
    ]);
    expect(
      logged().every(
        (event) =>
          event.mode === 'direct' &&
          event.type !== 'search' &&
          event.matchType === 'direct',
      ),
    ).toBe(true);
    expect(
      logged().every(
        (event) =>
          event.recommendationEngine === undefined &&
          event.llmFallbackReason === undefined &&
          event.modelVersion === undefined &&
          event.promptVersion === undefined,
      ),
    ).toBe(true);
    const report = buildAnalyticsReport({
      current: publicCatalog,
      filter: { startDate: '2026-11-03', endDate: '2026-11-03' },
      records: logged().map((event) => ({
        event,
        receivedAt: '2026-11-03T16:00:00.000Z',
      })),
    });
    expect(
      report.videos.find((row) => row.youtubeId === 'fixture0000'),
    ).toMatchObject({
      appearances: 0,
      embedClicks: 0,
      youtubeClicks: 0,
      directViews: 1,
      directEmbedClicks: 1,
      directYoutubeClicks: 1,
    });
    expect(
      report.tags.every((row) => row.appearances === 0 && row.searches === 0),
    ).toBe(true);
    expect(report.associations).toEqual([]);
  });

  it('AC-16.7: Clear sends no impressions and creates a new direct browsing context', async () => {
    render(
      <IntakeResults
        catalog={catalog}
        usage={{ session: session(), catalog: publicCatalog }}
      />,
    );
    fireEvent.change(screen.getByLabelText('Your goal'), {
      target: { value: 'report writing' },
    });
    submit();
    await waitFor(() =>
      expect(logged().some((event) => event.type === 'search')).toBe(true),
    );
    const search = logged().find((event) => event.type === 'search')!;
    await waitFor(() =>
      expect(
        logged().filter((event) => event.searchId === search.searchId),
      ).toHaveLength(5),
    );
    const beforeClear = logged().length;
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(logged()).toHaveLength(beforeClear);
    fireEvent.click(
      screen.getByRole('button', { name: 'Play Fixture video 0' }),
    );
    await waitFor(() => expect(logged()).toHaveLength(beforeClear + 2));
    expect(
      logged()
        .slice(beforeClear)
        .every(
          (event) =>
            event.mode === 'direct' && event.searchId !== search.searchId,
        ),
    ).toBe(true);
  });

  it.each([false, true])(
    'collects explicit production feedback while automatic usage stays disabled; submitted=%s',
    async (submitted) => {
      const feedbackEndpoint = `https://script.google.com/macros/s/feedback-${submitted}/exec`;
      vi.stubEnv('VITE_CATALOG_SOURCE', 'remote');
      vi.stubEnv('VITE_CATALOG_URL', endpoint);
      vi.stubEnv('VITE_USAGE_PRODUCTION_URL', feedbackEndpoint);
      vi.stubEnv('VITE_USAGE_ENVIRONMENT', 'production');
      vi.stubEnv('VITE_USAGE_ENABLED', 'false');
      vi.stubEnv('VITE_FEEDBACK_ENABLED', 'true');
      vi.stubEnv('VITE_FEEDBACK_QUESTION', 'Was this helpful?');
      vi.mocked(fetch).mockImplementation(async (_url, init) =>
        init?.method === 'POST'
          ? Response.json({ ok: true, status: 'accepted' })
          : Response.json(publicCatalog),
      );
      render(<IntakeResultsPage />);
      await screen.findByRole('button', { name: 'Find videos' });
      expect(logged()).toHaveLength(0);
      if (submitted) submit();
      fireEvent.click(
        screen.getByRole('button', { name: 'Play Fixture video 0' }),
      );
      expect(logged()).toHaveLength(0);
      fireEvent.click(
        screen.getByRole('button', {
          name: 'Helpful: Fixture video 0',
        }),
      );
      await screen.findByText(
        'Saved as helpful. You can change your response.',
      );
      expect(logged()).toHaveLength(1);
      expect(logged()[0]).toMatchObject({
        type: 'feedback',
        helpful: true,
        voteRevision: 1,
        mode: submitted ? 'recommendations' : 'direct',
        matchType: submitted ? 'weak' : 'direct',
      });
      fireEvent.click(
        screen.getByRole('button', {
          name: 'Not helpful: Fixture video 0',
        }),
      );
      await screen.findByText(
        'Saved as not helpful. You can change your response.',
      );
      expect(logged()).toHaveLength(2);
      expect(logged()[1]).toMatchObject({
        type: 'feedback',
        helpful: false,
        voteRevision: 2,
      });
    },
  );

  it('logs one submitted search, each displayed card once and both clicks, even in StrictMode', async () => {
    const usage = { session: session(), catalog: publicCatalog };
    const view = (
      <StrictMode>
        <IntakeResults
          catalog={catalog}

          usage={usage}
        />
      </StrictMode>
    );
    const { rerender } = render(view);
    expect(logged()).toHaveLength(0);
    expect(screen.queryByText(/Test preview: we log/)).toBeNull();
    fireEvent.change(screen.getByLabelText('Your goal'), {
      target: { value: 'report writing plus private fixture words' },
    });
    expect(logged()).toHaveLength(0);
    submit();
    await waitFor(() => expect(logged()).toHaveLength(5));
    const search = logged().find((event) => event.type === 'search');
    expect(search).toMatchObject({
      type: 'search',
      tasks: ['report writing'],
      tools: [],
      functionArea: null,
      resultCount: 4,
      strongMatchCount: 4,
      recommendationEngine: 'rules',
      llmFallbackReason: 'not-requested',
      fallbackType: 'none',
    });
    expect(JSON.stringify(logged())).not.toContain('private fixture words');
    expect(new Set(logged().map((event) => event.sessionId))).toEqual(
      new Set([usage.session.sessionId]),
    );
    expect(logged().every((event) => event.searchId === search?.searchId)).toBe(
      true,
    );
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
    rerender(view);
    fireEvent.change(screen.getByLabelText('Your goal'), {
      target: { value: 'unsubmitted edit' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Play Fixture video 0' }),
    );
    await waitFor(() => expect(logged()).toHaveLength(6));
    expect(logged()[5]).toMatchObject({
      type: 'click',
      target: 'embed',
      youtubeId: 'fixture0000',
      rank: 1,
      searchId: search?.searchId,
    });
    expect(screen.getByTitle('Fixture video 0').tagName).toBe('IFRAME');
    const link = screen.getAllByRole('link', { name: /Watch on YouTube/ })[0];
    fireEvent.click(link);
    await waitFor(() => expect(logged()).toHaveLength(7));
    expect(logged()[6]).toMatchObject({
      type: 'click',
      target: 'youtube',
      rank: 1,
      searchId: search?.searchId,
    });
    expect(link.getAttribute('target')).toBe('_blank');
    expect(logged().filter((event) => event.type === 'search')).toHaveLength(1);
    expect(new Set(logged().map((event) => event.eventId)).size).toBe(7);
  });

  it('creates a new search context even for an identical second submission; Clear is not a search', async () => {
    const usage = { session: session(), catalog: publicCatalog };
    render(<IntakeResults catalog={catalog} usage={usage} />);
    expect(logged()).toHaveLength(0);
    submit();
    await waitFor(() => expect(logged()).toHaveLength(5));
    submit();
    await waitFor(() => expect(logged()).toHaveLength(10));
    const searches = logged().filter((event) => event.type === 'search');
    expect(searches).toHaveLength(2);
    expect(searches[0].searchId).not.toBe(searches[1].searchId);
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(logged()).toHaveLength(10);
    expect(logged().filter((event) => event.type === 'search')).toHaveLength(2);
  });

  it('keeps submit and playback working while delivery is stalled or offline', async () => {
    vi.useFakeTimers();
    vi.mocked(fetch)
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockRejectedValue(new TypeError('offline'));
    render(
      <IntakeResults
        catalog={catalog}

        usage={{ session: session(), catalog: publicCatalog }}
      />,
    );
    submit();
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    fireEvent.click(
      screen.getByRole('button', { name: 'Play Fixture video 0' }),
    );
    expect(screen.getByTitle('Fixture video 0')).toBeTruthy();
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
  });

  it('never sends usage events in production even with a test URL and an enabled flag', async () => {
    vi.stubEnv('VITE_CATALOG_SOURCE', 'remote');
    vi.stubEnv('VITE_CATALOG_URL', endpoint);
    vi.stubEnv('VITE_USAGE_TEST_URL', endpoint);
    vi.stubEnv('VITE_USAGE_ENABLED', 'true');
    vi.stubEnv('VITE_USAGE_ENVIRONMENT', 'production');
    vi.mocked(fetch).mockImplementation(async () =>
      Response.json(publicCatalog),
    );
    render(<IntakeResultsPage />);
    await screen.findByRole('button', { name: 'Find videos' });
    submit();
    fireEvent.click(
      screen.getByRole('button', { name: 'Play Fixture video 0' }),
    );
    expect(logged()).toHaveLength(0);
    expect(screen.queryByText(/Your typed goal is not logged/)).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('logs production searches and impressions only to the production collector', async () => {
    const production = 'https://script.google.com/macros/s/production/exec';
    vi.stubEnv('VITE_CATALOG_SOURCE', 'remote');
    vi.stubEnv('VITE_CATALOG_URL', endpoint);
    vi.stubEnv('VITE_USAGE_TEST_URL', endpoint);
    vi.stubEnv('VITE_USAGE_PRODUCTION_URL', production);
    vi.stubEnv('VITE_USAGE_ENABLED', 'true');
    vi.stubEnv('VITE_USAGE_ENVIRONMENT', 'production');
    vi.mocked(fetch).mockImplementation(async (_url, init) =>
      init?.method === 'POST'
        ? Response.json({ ok: true, status: 'accepted' })
        : Response.json(publicCatalog),
    );
    render(<IntakeResultsPage />);
    await screen.findByRole('button', { name: 'Find videos' });
    submit();
    await waitFor(() =>
      expect(logged().filter((event) => event.type === 'search')).toHaveLength(
        1,
      ),
    );
    await waitFor(() => expect(logged()).toHaveLength(5));
    const posts = vi
      .mocked(fetch)
      .mock.calls.filter(([, init]) => init?.method === 'POST');
    expect(posts.every(([url]) => url === production)).toBe(true);
  });
});
