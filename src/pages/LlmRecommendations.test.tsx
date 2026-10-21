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
const catalog = publicCatalog.items.map(toCatalogItem);
const success = {
  outcome: 'success',
  youtubeIds: ['fx04BdgtSht', 'fx03BdgtXls', 'fx09IntroCt', 'fx01GrntRpt'],
  catalogVersion: publicCatalog.catalogVersion,
  modelVersion: 'fixture-model',
  promptVersion: 'fixture-prompt',
};
function deferredResponse() {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function goal(value = 'a fictional semantic goal') {
  fireEvent.change(screen.getByLabelText('What do you want to learn?'), {
    target: { value },
  });
}
function submit() {
  fireEvent.click(screen.getByRole('button', { name: 'Find videos' }));
}
function usage() {
  const send = vi.fn(async (event: unknown) => {
    UsageEventSchema.parse(event);
    return 'accepted' as const;
  });
  return {
    session: {
      sessionId: crypto.randomUUID(),
      src: 'pilot' as const,
      sender: { send },
    },
    catalog: publicCatalog,
  };
}
const props = {
  catalog,
  recommendationCatalog: publicCatalog,
  availableFunctionAreas: publicCatalog.functionAreas,
};
beforeEach(() => {
  vi.stubEnv('VITE_LLM_ENABLED', 'true');
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async () => Response.json(success)),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('LLM submissions', () => {
  it('makes one request per submit, preserves model order, and expands without another request or duplicate events', async () => {
    const logging = usage();
    const view = (
      <StrictMode>
        <IntakeResults {...props} usage={logging} />
      </StrictMode>
    );
    const { rerender } = render(view);
    expect(
      screen.getByText(/send your goal and selected options to Anthropic/),
    ).toBeTruthy();
    logging.session.sender.send.mockClear();
    goal('fictional-private-goal');
    expect(fetch).not.toHaveBeenCalled();
    submit();
    expect(screen.getByRole('status').textContent).toBe(
      'Finding AI suggestions…',
    );
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { name: 'Videos to start with' }),
    );
    expect(logging.session.sender.send).not.toHaveBeenCalled();
    await screen.findByText('AI suggestions');
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getAllByRole('listitem')[0].textContent).toContain(
      '[Fixture] Budget sheet',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    rerender(view);
    goal('unsubmitted-private-goal');
    expect(fetch).toHaveBeenCalledTimes(1);
    const events = logging.session.sender.send.mock.calls.map(([event]) =>
      UsageEventSchema.parse(event),
    );
    expect(events.filter((event) => event.type === 'search')).toHaveLength(1);
    expect(events.filter((event) => event.type === 'impression')).toHaveLength(
      4,
    );
    expect(
      events.every(
        (event) =>
          event.recommendationEngine === 'llm' &&
          event.llmFallbackReason === 'none',
      ),
    ).toBe(true);
    expect(events[0]).toMatchObject({
      modelVersion: 'fixture-model',
      promptVersion: 'fixture-prompt',
      resultCount: 3,
    });
    expect(new Set(events.map((event) => event.searchId)).size).toBe(1);
    expect(JSON.stringify(events)).not.toContain('private-goal');
    expect(window.location.search).not.toContain('private-goal');
    fireEvent.click(
      screen.getAllByRole('link', { name: /Watch on YouTube/ })[0],
    );
    expect(logging.session.sender.send.mock.calls.at(-1)?.[0]).toMatchObject({
      type: 'click',
      matchType: 'semantic',
      rank: 1,
    });
  });
  it('skips all-blank submissions and disabled calls, while blank goal with an area is valid', async () => {
    render(<IntakeResults {...props} />);
    submit();
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByText('Standard matching')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Function area'), {
      target: { value: 'Operations' },
    });
    submit();
    await screen.findByText('AI suggestions');
    expect(
      JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body)).goal,
    ).toBe('');
    vi.stubEnv('VITE_LLM_ENABLED', 'false');
    goal('a different goal');
    submit();
    expect(screen.getByText('Standard matching')).toBeTruthy();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each([
    [
      { ...success, catalogVersion: `sha256:${'0'.repeat(64)}` },
      'catalog-mismatch',
    ],
    [{ ...success, youtubeIds: ['fx01GrntRpt'] }, 'insufficient-results'],
    [
      { ...success, youtubeIds: ['unknown0000', 'fx01GrntRpt'] },
      'invalid-response',
    ],
    [{ outcome: 'fallback', reason: 'budget-exhausted' }, 'budget-exhausted'],
    [{ outcome: 'fallback', reason: 'rate-limited' }, 'rate-limited'],
    [{ outcome: 'fallback', reason: 'disabled' }, 'disabled'],
  ])(
    'uses complete standard matching and bounded usage metadata for a rejected selection',
    async (response, reason) => {
      vi.mocked(fetch).mockResolvedValue(Response.json(response));
      const logging = usage();
      render(<IntakeResults {...props} usage={logging} />);
      const initial = screen
        .getAllByRole('listitem')
        .map((item) => item.textContent);
      logging.session.sender.send.mockClear();
      goal('unmatched');
      submit();
      await screen.findByText('Standard matching');
      expect(
        screen.getAllByRole('listitem').map((item) => item.textContent),
      ).toEqual(initial);
      expect(logging.session.sender.send.mock.calls[0][0]).toMatchObject({
        type: 'search',
        recommendationEngine: 'rules',
        llmFallbackReason: reason,
      });
      expect(logging.session.sender.send).toHaveBeenCalledTimes(4);
    },
  );
  it('keeps only the latest submitted result and never logs the earlier response', async () => {
    const first = deferredResponse();
    const second = deferredResponse();
    vi.mocked(fetch)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const logging = usage();
    render(<IntakeResults {...props} usage={logging} />);
    logging.session.sender.send.mockClear();
    goal('first');
    submit();
    goal('second');
    submit();
    await act(async () => {
      second.resolve(
        Response.json({
          ...success,
          youtubeIds: ['fx09IntroCt', 'fx01GrntRpt', 'fx04BdgtSht'],
        }),
      );
    });
    expect(screen.getAllByRole('listitem')[0].textContent).toContain(
      '[Fixture] Start here',
    );
    const count = logging.session.sender.send.mock.calls.length;
    await act(async () => {
      first.resolve(Response.json(success));
    });
    expect(screen.getAllByRole('listitem')[0].textContent).toContain(
      '[Fixture] Start here',
    );
    expect(logging.session.sender.send).toHaveBeenCalledTimes(count);
    expect(
      logging.session.sender.send.mock.calls.filter(
        ([event]) => UsageEventSchema.parse(event).type === 'search',
      ),
    ).toHaveLength(1);
  });
  it.each(['edit', 'clear'])(
    'cancels pending results on %s without a stale display or extra impressions',
    async (action) => {
      const pending = deferredResponse();
      vi.mocked(fetch).mockReturnValue(pending.promise);
      const logging = usage();
      render(<IntakeResults {...props} usage={logging} />);
      goal();
      submit();
      if (action === 'edit') goal('new unsubmitted text');
      else fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
      const initial = screen
        .getAllByRole('listitem')
        .map((item) => item.textContent);
      const count = logging.session.sender.send.mock.calls.length;
      await act(async () => {
        pending.resolve(Response.json(success));
      });
      expect(screen.queryByText('AI suggestions')).toBeNull();
      expect(
        screen.getAllByRole('listitem').map((item) => item.textContent),
      ).toEqual(initial);
      expect(logging.session.sender.send).toHaveBeenCalledTimes(count);
    },
  );
  it('completes rules fallback at five seconds and ignores a later success', async () => {
    vi.useFakeTimers();
    const pending = deferredResponse();
    vi.mocked(fetch).mockReturnValue(pending.promise);
    const logging = usage();
    render(<IntakeResults {...props} usage={logging} />);
    logging.session.sender.send.mockClear();
    goal();
    submit();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4999);
    });
    expect(screen.getByRole('status').textContent).toBe(
      'Finding AI suggestions…',
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(screen.getByText('Standard matching')).toBeTruthy();
    expect(logging.session.sender.send.mock.calls[0][0]).toMatchObject({
      llmFallbackReason: 'timeout',
    });
    const count = logging.session.sender.send.mock.calls.length;
    await act(async () => {
      pending.resolve(Response.json(success));
    });
    expect(screen.getByText('Standard matching')).toBeTruthy();
    expect(logging.session.sender.send).toHaveBeenCalledTimes(count);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('keeps the fixture catalog offline even when the browser flag is enabled', async () => {
    render(<IntakeResults catalog={catalog} />);
    goal();
    submit();
    await waitFor(() =>
      expect(screen.getByText('Standard matching')).toBeTruthy(),
    );
    expect(fetch).not.toHaveBeenCalled();
    expect(
      screen.queryByText(/send your goal and selected options to Anthropic/),
    ).toBeNull();
  });
});
