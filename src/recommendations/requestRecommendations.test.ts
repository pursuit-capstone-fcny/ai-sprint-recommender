import { afterEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../fixtures/public-catalog.json';
import {
  requestRecommendations,
  recommendationsEnabled,
} from './requestRecommendations';

const request = {
  functionArea: 'Operations',
  goal: 'fictional goal',
  tools: [],
  catalogVersion: fixture.catalogVersion,
};
const success = {
  outcome: 'success',
  youtubeIds: ['fx04BdgtSht', 'fx01GrntRpt'],
  catalogVersion: fixture.catalogVersion,
  modelVersion: 'fixture',
  promptVersion: 'fixture',
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('recommendation request', () => {
  it('is disabled by default and requires an explicit browser flag', () => {
    vi.stubEnv('VITE_LLM_ENABLED', 'false');
    expect(recommendationsEnabled()).toBe(false);
    vi.stubEnv('VITE_LLM_ENABLED', 'true');
    expect(recommendationsEnabled()).toBe(true);
  });
  it('sends only bounded intake to the same-origin endpoint with no credentials or referrer', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(success));
    vi.stubGlobal('fetch', fetchMock);
    expect(
      await requestRecommendations(request, new AbortController().signal),
    ).toEqual(success);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [path, options] = fetchMock.mock.calls[0];
    expect(path).toBe('/api/recommendations');
    expect(options).toMatchObject({
      method: 'POST',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
    });
    expect(JSON.parse(options.body)).toEqual(request);
  });
  it('enforces the bounded AI window even when a response body ignores abort', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({ ok: true, text: () => new Promise(() => {}) }),
    );
    const result = requestRecommendations(
      request,
      new AbortController().signal,
    );
    await vi.advanceTimersByTimeAsync(35000);
    expect(await result).toEqual({ outcome: 'fallback', reason: 'timeout' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each([
    [() => Promise.reject(new Error('offline')), 'provider-error'],
    [() => Promise.resolve(new Response('invalid json')), 'invalid-response'],
    [
      () => Promise.resolve(Response.json({ ...success, html: 'untrusted' })),
      'invalid-response',
    ],
    [
      () => Promise.resolve(Response.json(success, { status: 500 })),
      'invalid-response',
    ],
    [
      () => Promise.resolve(new Response('x'.repeat(16385))),
      'invalid-response',
    ],
  ])(
    'falls back without retry on a failed response',
    async (fetcher, reason) => {
      vi.stubGlobal('fetch', vi.fn(fetcher));
      expect(
        await requestRecommendations(request, new AbortController().signal),
      ).toEqual({ outcome: 'fallback', reason });
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );
  it('preserves bounded server failure reasons and does not dispatch invalid or already cancelled input', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { outcome: 'fallback', reason: 'budget-exhausted' },
            { status: 503 },
          ),
        ),
    );
    expect(
      await requestRecommendations(request, new AbortController().signal),
    ).toEqual({ outcome: 'fallback', reason: 'budget-exhausted' });
    const controller = new AbortController();
    controller.abort();
    await requestRecommendations(request, controller.signal);
    await requestRecommendations(
      { ...request, goal: 'x'.repeat(501) },
      new AbortController().signal,
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
