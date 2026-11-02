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

const publicCatalog = parsePublicCatalog(fixture);
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
  fireEvent.change(screen.getByLabelText('What do you want to learn or do?'), {
    target: { value: text },
  });
}
function choose(name: 'Deterministic' | 'Haiku AI') {
  fireEvent.click(screen.getByRole('radio', { name }));
}
function submit() {
  fireEvent.click(screen.getByRole('button', { name: 'Find videos' }));
}
function setup(ai = true) {
  const send = vi.fn(async (event: unknown) => {
    UsageEventSchema.parse(event);
    return 'accepted' as const;
  });
  const view = (
    <StrictMode>
      <IntakeResults
        {...props}
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
  it('preserves a valid abstention and requires an explicit engine choice for local matching', async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ ...success, youtubeIds: [] }),
    );
    const { send } = setup();
    goal('Draft a grant report');
    submit();
    await screen.findByText('No confident AI matches found.');
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    await waitFor(() =>
      expect(
        send.mock.calls.filter(
          ([e]) => UsageEventSchema.parse(e).type === 'search',
        ),
      ).toHaveLength(1),
    );
    choose('Deterministic');
    submit();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('No confident AI matches found.')).toBeNull();
  });
  it.each([
    { ...success, youtubeIds: ['fx01GrntRpt'] },
    { ...success, youtubeIds: ['fx04BdgtSht', 'fx04BdgtSht'] },
    { ...success, youtubeIds: ['unknown0000', 'fx01GrntRpt'] },
    { ...success, catalogVersion: `sha256:${'0'.repeat(64)}` },
    { outcome: 'fallback', reason: 'budget-exhausted' },
    { outcome: 'fallback', reason: 'rate-limited' },
    { outcome: 'fallback', reason: 'disabled' },
  ])(
    'shows unavailable without substitute cards or phantom usage for rejected responses',
    async (response) => {
      vi.mocked(fetch).mockResolvedValue(Response.json(response));
      const { send } = setup();
      goal();
      submit();
      await screen.findByText(/AI recommendations are unavailable/);
      expect(screen.queryAllByRole('listitem')).toHaveLength(0);
      expect(send).not.toHaveBeenCalled();
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('radio', { name: 'Haiku AI' })).toHaveProperty(
        'checked',
        true,
      );
    },
  );
  it('never dispatches an empty goal or a disabled AI selection', () => {
    setup();
    submit();
    expect(screen.getByText(/Enter a task description/)).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
    vi.stubEnv('VITE_LLM_ENABLED', 'false');
    goal();
    submit();
    expect(screen.getByText(/AI recommendations are unavailable/)).toBeTruthy();
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
    await act(async () => {
      resolve(Response.json(success));
      await Promise.resolve();
    });
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(send).not.toHaveBeenCalled();
  });
});
