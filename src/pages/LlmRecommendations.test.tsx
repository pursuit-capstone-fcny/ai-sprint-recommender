import { StrictMode } from 'react';
import {
  act,
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
import { IntakeResults } from './IntakeResults';
import {
  DEFAULT_VIDEO_IDS,
  FALLBACK_VIDEO_IDS,
} from '../recommendations/curatedVideos';

const publicCatalog = parsePublicCatalog({
  ...fixture,
  items: [
    ...fixture.items,
    ...['fx10Extra01', 'fx11Extra02'].map((youtubeId) => ({
      ...fixture.items[3],
      youtubeId,
      title: `[Fixture] General introduction ${youtubeId}`,
    })),
  ],
});
const props = {
  catalog: publicCatalog.items.map(toCatalogItem),
  publicCatalog,
  recommendationCatalog: publicCatalog,
};
const success = {
  outcome: 'success',
  youtubeIds: ['fx04BdgtSht', 'fx03BdgtXls', 'fx01GrntRpt'],
  catalogVersion: publicCatalog.catalogVersion,
  modelVersion: 'fixture-model',
  promptVersion: 'fixture-prompt',
};
function goal(text = 'A fictional request') {
  fireEvent.change(screen.getByLabelText('Your goal'), {
    target: { value: text },
  });
}
function choose(name: 'Deterministic' | 'Haiku AI') {
  fireEvent.click(screen.getByRole('radio', { name }));
}
function submit() {
  fireEvent.click(screen.getByRole('button', { name: 'Find videos' }));
}
function setup(ai = true, catalog = props.catalog) {
  const send = vi.fn(async (event: unknown) => {
    UsageEventSchema.parse(event);
    return 'accepted' as const;
  });
  const view = (
    <StrictMode>
      <IntakeResults
        {...props}
        catalog={catalog}
        usage={{
          catalog: publicCatalog,
          session: {
            sessionId: crypto.randomUUID(),
            src: 'pilot',
            sender: { send },
          },
        }}
      />
    </StrictMode>
  );
  const rendered = render(view);
  if (ai) choose('Haiku AI');
  send.mockClear();
  return { send, view, ...rendered };
}
beforeEach(() => {
  vi.stubEnv('VITE_LLM_ENABLED', 'true');
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json(success)),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('independent recommendation engines', () => {
  it.each([
    [
      { ...success, youtubeIds: [] },
      'No confident AI matches found.',
      'insufficient-results',
    ],
    [
      { outcome: 'fallback', reason: 'disabled' },
      'AI recommendations are unavailable.',
      'disabled',
    ],
  ])(
    'shows eight curated fallback videos and their actual usage for %j',
    async (response, message, reason) => {
      vi.mocked(fetch).mockResolvedValue(Response.json(response));
      const ids = [...DEFAULT_VIDEO_IDS, ...FALLBACK_VIDEO_IDS];
      const snapshot = parsePublicCatalog({
        ...publicCatalog,
        items: ids.map((youtubeId) => ({
          ...publicCatalog.items[0],
          youtubeId,
          title: `Fixture lesson ${youtubeId}`,
        })),
      });
      const send = vi.fn(async (event: unknown) => {
        UsageEventSchema.parse(event);
        return 'accepted' as const;
      });
      render(
        <IntakeResults
          catalog={snapshot.items.map(toCatalogItem)}
          publicCatalog={snapshot}
          recommendationCatalog={snapshot}
          usage={{
            catalog: snapshot,
            session: {
              sessionId: crypto.randomUUID(),
              src: 'pilot',
              sender: { send },
            },
          }}
        />,
      );
      choose('Haiku AI');
      send.mockClear();
      goal();
      submit();
      await screen.findByText(message);
      expect(
        screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent),
      ).toEqual(FALLBACK_VIDEO_IDS.map((id) => `Fixture lesson ${id}`));
      expect(screen.getAllByText('Fallback video')).toHaveLength(8);
      await waitFor(() => expect(send).toHaveBeenCalledTimes(9));
      const events = send.mock.calls.map(([event]) =>
        UsageEventSchema.parse(event),
      );
      expect(events.find((event) => event.type === 'search')).toMatchObject({
        resultCount: 8,
        strongMatchCount: 0,
      });
      expect(
        events.every(
          (event) =>
            event.recommendationEngine === 'rules' &&
            event.llmFallbackReason === reason,
        ),
      ).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );

  it('defaults to deterministic even when AI is enabled, and changing engine or typing makes no request', () => {
    setup(false);
    expect(screen.getByRole('radio', { name: 'Deterministic' })).toHaveProperty(
      'checked',
      true,
    );
    goal('Draft a grant report');
    submit();
    expect(fetch).not.toHaveBeenCalled();
    choose('Haiku AI');
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('makes one AI call per submit, preserves order without padding, and emits only final engine events', async () => {
    const { send, rerender, view } = setup();
    goal('private-fictional-goal');
    submit();
    expect(screen.getByRole('status').textContent).toBe(
      'Finding AI suggestions…',
    );
    await screen.findByText('AI suggestions');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getAllByRole('listitem')[0].textContent).toContain(
      '[Fixture] Budget sheet',
    );
    rerender(view);
    goal('an unsubmitted change');
    expect(fetch).toHaveBeenCalledTimes(1);
    const events = send.mock.calls.map(([e]) => UsageEventSchema.parse(e));
    expect(events.filter((e) => e.type === 'search')).toHaveLength(1);
    expect(events.filter((e) => e.type === 'impression')).toHaveLength(3);
    expect(events.every((e) => e.recommendationEngine === 'llm')).toBe(true);
    expect(JSON.stringify(events)).not.toContain('private-fictional-goal');
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
  });
  it('preserves abstention, shows six labeled general videos, and logs actual local fallback activity', async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ ...success, youtubeIds: [] }),
    );
    const { send } = setup();
    goal('Draft a grant report');
    submit();
    await screen.findByText('No confident AI matches found.');
    expect(
      screen.getByRole('heading', { name: 'Fallback videos' }),
    ).toBeTruthy();
    expect(screen.getAllByText('Fallback video')).toHaveLength(6);
    expect(
      screen.getByText(/These are general library suggestions/),
    ).toBeTruthy();
    expect(screen.queryByText('Suggested for your goal')).toBeNull();
    await waitFor(() =>
      expect(
        send.mock.calls.filter(
          ([e]) => UsageEventSchema.parse(e).type === 'search',
        ),
      ).toHaveLength(1),
    );
    fireEvent.click(screen.getAllByRole('button', { name: /Play / })[0]);
    expect(document.querySelectorAll('iframe')).toHaveLength(1);
    goal('an unsubmitted private-fictional-goal');
    const events = send.mock.calls.map(([e]) => UsageEventSchema.parse(e));
    expect(events.filter((e) => e.type === 'impression')).toHaveLength(6);
    expect(events.filter((e) => e.type === 'click')).toHaveLength(1);
    expect(
      events.every(
        (e) =>
          e.recommendationEngine === 'rules' &&
          e.llmFallbackReason === 'insufficient-results' &&
          e.modelVersion === 'fixture-model' &&
          e.promptVersion === 'fixture-prompt',
      ),
    ).toBe(true);
    expect(events.find((e) => e.type === 'search')).toMatchObject({
      resultCount: 6,
      strongMatchCount: 0,
    });
    expect(
      events
        .filter((e) => e.type === 'impression' || e.type === 'click')
        .every((e) => e.matchType === 'weak' || e.matchType === 'start-here'),
    ).toBe(true);
    expect(JSON.stringify(events)).not.toContain('private-fictional-goal');
    choose('Deterministic');
    submit();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('No confident AI matches found.')).toBeNull();
  });
  it('shows a single valid AI pick without fallback cards', async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ ...success, youtubeIds: ['fx01GrntRpt'] }),
    );
    setup();
    goal();
    submit();
    await waitFor(() =>
      expect(screen.getAllByRole('listitem')).toHaveLength(1),
    );
    expect(screen.getByText('Suggested for your goal')).toBeTruthy();
    expect(screen.queryByText('Fallback video')).toBeNull();
    expect(screen.queryByText(/AI recommendations are unavailable/)).toBeNull();
  });
  it.each([
    [
      { ...success, youtubeIds: ['fx04BdgtSht', 'fx04BdgtSht'] },
      'invalid-response',
    ],
    [
      { ...success, youtubeIds: ['unknown0000', 'fx01GrntRpt'] },
      'invalid-response',
    ],
    [
      { ...success, catalogVersion: `sha256:${'0'.repeat(64)}` },
      'catalog-mismatch',
    ],
    [{ outcome: 'fallback', reason: 'budget-exhausted' }, 'budget-exhausted'],
    [{ outcome: 'fallback', reason: 'rate-limited' }, 'rate-limited'],
    [{ outcome: 'fallback', reason: 'disabled' }, 'disabled'],
  ])(
    'shows labeled local fallback cards and preserves the reason for rejected responses: %j',
    async (response, reason) => {
      vi.mocked(fetch).mockResolvedValue(Response.json(response));
      const { send } = setup();
      goal();
      submit();
      await screen.findByText(/AI recommendations are unavailable/);
      expect(screen.getAllByRole('listitem')).toHaveLength(6);
      expect(screen.getAllByText('Fallback video')).toHaveLength(6);
      // Delivery starts in an effect after the fallback cards render.
      await waitFor(() => expect(send).toHaveBeenCalledTimes(7));
      const events = send.mock.calls.map(([e]) => UsageEventSchema.parse(e));
      expect(events.filter((e) => e.type === 'search')).toHaveLength(1);
      expect(events.filter((e) => e.type === 'impression')).toHaveLength(6);
      expect(
        events.every(
          (e) =>
            e.recommendationEngine === 'rules' &&
            e.llmFallbackReason === reason,
        ),
      ).toBe(true);
      expect(events.find((e) => e.type === 'search')).toMatchObject({
        resultCount: 6,
        strongMatchCount: 0,
      });
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('radio', { name: 'Haiku AI' })).toHaveProperty(
        'checked',
        true,
      );
    },
  );
  it('creates no fallback cards or phantom usage when the eligible catalog is empty', async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ outcome: 'fallback', reason: 'disabled' }),
    );
    const { send } = setup(true, []);
    goal();
    submit();
    await screen.findByText(/AI recommendations are unavailable/);
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    expect(
      screen.queryByRole('heading', { name: 'Fallback videos' }),
    ).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });
  it('never dispatches an empty goal or a disabled AI selection', () => {
    setup();
    submit();
    expect(screen.getByText(/Enter a task description/)).toBeTruthy();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    expect(fetch).not.toHaveBeenCalled();
    vi.stubEnv('VITE_LLM_ENABLED', 'false');
    submit();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    goal();
    submit();
    expect(screen.getByText(/AI recommendations are unavailable/)).toBeTruthy();
    expect(screen.getAllByText('Fallback video')).toHaveLength(6);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('does not let a pending AI response cross an engine switch', async () => {
    let resolve!: (r: Response) => void;
    vi.mocked(fetch).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { send } = setup();
    goal('Draft a grant report');
    submit();
    choose('Deterministic');
    submit();
    const localCards = screen
      .queryAllByRole('listitem')
      .map((x) => x.textContent);
    await act(async () => {
      resolve(Response.json(success));
      await Promise.resolve();
    });
    expect(screen.queryAllByRole('listitem').map((x) => x.textContent)).toEqual(
      localCards,
    );
    expect(
      send.mock.calls.every(
        ([e]) => UsageEventSchema.parse(e).recommendationEngine === 'rules',
      ),
    ).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('ignores an earlier AI submission after a later one completes', async () => {
    let resolve!: (r: Response) => void;
    vi.mocked(fetch)
      .mockReturnValueOnce(
        new Promise((done) => {
          resolve = done;
        }),
      )
      .mockResolvedValueOnce(Response.json(success));
    setup();
    goal('first');
    submit();
    goal('second');
    submit();
    await screen.findByText('AI suggestions');
    await act(async () => {
      resolve(Response.json({ ...success, youtubeIds: [] }));
      await Promise.resolve();
    });
    expect(screen.getByText('AI suggestions')).toBeTruthy();
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('enforces the 35-second window and rejects a late success without retrying', async () => {
    vi.useFakeTimers();
    let resolve!: (r: Response) => void;
    vi.mocked(fetch).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { send } = setup();
    goal();
    submit();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(35_000);
    });
    expect(screen.getByText(/AI recommendations are unavailable/)).toBeTruthy();
    const fallbacks = screen.getAllByRole('listitem').map((x) => x.textContent);
    expect(screen.getAllByText('Fallback video')).toHaveLength(6);
    await act(async () => {
      resolve(Response.json(success));
      await Promise.resolve();
    });
    expect(screen.getAllByRole('listitem').map((x) => x.textContent)).toEqual(
      fallbacks,
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    const events = send.mock.calls.map(([e]) => UsageEventSchema.parse(e));
    expect(events.filter((e) => e.type === 'impression')).toHaveLength(6);
    expect(
      events.every(
        (e) =>
          e.recommendationEngine === 'rules' &&
          e.llmFallbackReason === 'timeout',
      ),
    ).toBe(true);
  });
});
