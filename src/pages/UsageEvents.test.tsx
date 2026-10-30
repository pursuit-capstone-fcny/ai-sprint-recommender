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
  it('logs one submitted search, each displayed card once and both clicks, even in StrictMode', async () => {
    const usage = { session: session(), catalog: publicCatalog };
    const view = (
      <StrictMode>
        <IntakeResults
          catalog={catalog}
          availableFunctionAreas={publicCatalog.functionAreas}
          usage={usage}
        />
      </StrictMode>
    );
    const { rerender } = render(view);
    await waitFor(() => expect(logged()).toHaveLength(4));
    expect(logged().every((event) => event.type === 'impression')).toBe(true);
    expect(screen.getByText(/Your typed goal is not logged/)).toBeTruthy();
    fireEvent.click(screen.getByText(/Refine by function area or tool/));
    fireEvent.change(screen.getByLabelText('Function area (optional)'), {
      target: { value: 'Operations' },
    });
    fireEvent.change(
      screen.getByLabelText('What do you want to learn or do?'),
      {
        target: { value: 'report writing plus private fixture words' },
      },
    );
    fireEvent.change(screen.getByLabelText('Tool (optional)'), {
      target: { value: 'ChatGPT' },
    });
    expect(logged()).toHaveLength(4);
    submit();
    await waitFor(() => expect(logged()).toHaveLength(9));
    const search = logged().find((event) => event.type === 'search');
    expect(search).toMatchObject({
      type: 'search',
      tasks: ['report writing'],
      tools: ['ChatGPT'],
      functionArea: 'Operations',
      resultCount: 4,
      strongMatchCount: 4,
      recommendationEngine: 'rules',
      llmFallbackReason: 'disabled',
      fallbackType: 'none',
    });
    expect(JSON.stringify(logged())).not.toContain('private fixture words');
    expect(new Set(logged().map((event) => event.sessionId))).toEqual(
      new Set([usage.session.sessionId]),
    );
    expect(
      logged()
        .slice(4)
        .every((event) => event.searchId === search?.searchId),
    ).toBe(true);
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
    rerender(view);
    fireEvent.change(
      screen.getByLabelText('What do you want to learn or do?'),
      {
        target: { value: 'unsubmitted edit' },
      },
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Play Fixture video 0' }),
    );
    await waitFor(() => expect(logged()).toHaveLength(10));
    expect(logged()[9]).toMatchObject({
      type: 'click',
      target: 'embed',
      youtubeId: 'fixture0000',
      rank: 1,
      searchId: search?.searchId,
    });
    expect(screen.getByTitle('Fixture video 0').tagName).toBe('IFRAME');
    const link = screen.getAllByRole('link', { name: /Watch on YouTube/ })[0];
    fireEvent.click(link);
    await waitFor(() => expect(logged()).toHaveLength(11));
    expect(logged()[10]).toMatchObject({
      type: 'click',
      target: 'youtube',
      rank: 1,
      searchId: search?.searchId,
    });
    expect(link.getAttribute('target')).toBe('_blank');
    expect(logged().filter((event) => event.type === 'search')).toHaveLength(1);
    expect(new Set(logged().map((event) => event.eventId)).size).toBe(11);
  });

  it('creates a new search context even for an identical second submission; Clear is not a search', async () => {
    const usage = { session: session(), catalog: publicCatalog };
    render(<IntakeResults catalog={catalog} usage={usage} />);
    await waitFor(() => expect(logged()).toHaveLength(4));
    submit();
    await waitFor(() => expect(logged()).toHaveLength(9));
    submit();
    await waitFor(() => expect(logged()).toHaveLength(14));
    const searches = logged().filter((event) => event.type === 'search');
    expect(searches).toHaveLength(2);
    expect(searches[0].searchId).not.toBe(searches[1].searchId);
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    await waitFor(() => expect(logged()).toHaveLength(18));
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
        availableFunctionAreas={publicCatalog.functionAreas}
        usage={{ session: session(), catalog: publicCatalog }}
      />,
    );
    fireEvent.click(screen.getByText(/Refine by function area or tool/));
    fireEvent.change(screen.getByLabelText('Function area (optional)'), {
      target: { value: 'Operations' },
    });
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
});
