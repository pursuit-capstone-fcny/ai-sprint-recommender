// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  RecommendationResponseSchema,
  RECOMMENDATION_DEADLINE_MS,
} from '../src/contracts/recommendation';
import { recommend, type Diagnostic } from './recommendations';
import { catalog, environment } from './test-helpers';
import type { Provider } from './anthropic';
import type { CatalogCache } from './catalog-cache';

const input = {
  functionArea: 'Operations',
  goal: 'organize budget data',
  tools: ['Excel'],
  catalogVersion: catalog.catalogVersion,
};
const request = (value: unknown = input) =>
  new Request('https://example.test/api/recommendations', {
    method: 'POST',
    body: JSON.stringify(value),
  });
function setup() {
  const provider = vi.fn<Provider>(async () => ({
    value: { youtubeIds: [catalog.items[1].youtubeId] },
    inputTokens: 100,
    outputTokens: 20,
  }));
  const fetcher = vi.fn(async () => Response.json(catalog));
  const budget = {
    reserve: vi.fn(async () => ({ ok: true as const })),
    settle: vi.fn(async () => undefined),
  };
  const diagnostic = vi.fn<(entry: Diagnostic) => void>();
  const deps = {
    provider,
    fetch: fetcher,
    budget,
    diagnostic,
    clientKey: async () => 'a'.repeat(64),
  };
  return { provider, fetcher, budget, diagnostic, deps };
}
afterEach(() => vi.useRealTimers());
describe('recommendation endpoint', () => {
  it('warms a validated version without paid calls and validates intake and IDs on cache hits', async () => {
    const { deps, fetcher, provider, budget } = setup();
    const entries = new Map<string, Response>();
    const catalogCache: CatalogCache = {
      match: vi.fn(async (key) => entries.get(key.url)?.clone()),
      put: vi.fn(async (key, value) => {
        entries.set(key.url, value.clone());
      }),
    };
    const cached = { ...deps, catalogCache };
    const warmup = await recommend(
      request({ ...input, catalogVersion: 'sha256:' + 'f'.repeat(64) }),
      environment,
      cached,
    );
    expect((await warmup.json()).reason).toBe('catalog-mismatch');
    const invalid = await recommend(
      request({
        ...input,
        functionArea: '__evaluation_invalid_area__',
        goal: '',
        tools: [],
      }),
      environment,
      cached,
    );
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({
      outcome: 'fallback',
      reason: 'unavailable',
      catalogVersion: catalog.catalogVersion,
    });
    expect(budget.reserve).not.toHaveBeenCalled();
    expect(provider).not.toHaveBeenCalled();
    provider.mockResolvedValueOnce({
      value: { youtubeIds: ['unknown0000'] },
      inputTokens: 100,
      outputTokens: 20,
    });
    const response = await recommend(request(), environment, cached);
    expect((await response.json()).reason).toBe('invalid-response');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(provider).toHaveBeenCalledTimes(1);
  });
  it.each(['2026-10-21T00:00:00Z', 'not-a-date', ''])(
    'closes an expired or invalid test window without network calls',
    async (expiry) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-10-21T00:00:00Z'));
      const { deps, provider, fetcher, budget } = setup();
      const response = await recommend(
        request(),
        { ...environment, LLM_TEST_EXPIRES_AT: expiry },
        deps,
      );
      expect(await response.json()).toEqual({
        outcome: 'fallback',
        reason: 'disabled',
      });
      expect(provider).not.toHaveBeenCalled();
      expect(fetcher).not.toHaveBeenCalled();
      expect(budget.reserve).not.toHaveBeenCalled();
    },
  );
  it('permits a future test window and ignores the test expiry in production', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-21T00:00:00Z'));
    const { deps, provider } = setup();
    const open = await recommend(
      request(),
      { ...environment, LLM_TEST_EXPIRES_AT: '2026-10-22T00:00:00Z' },
      deps,
    );
    expect((await open.json()).outcome).toBe('success');
    const production = await recommend(
      request(),
      {
        ...environment,
        LLM_ENVIRONMENT: 'production',
        LLM_TEST_EXPIRES_AT: 'invalid',
      },
      deps,
    );
    expect((await production.json()).outcome).toBe('success');
    expect(provider).toHaveBeenCalledTimes(2);
  });
  it('rechecks test expiry after reservation and refunds before dispatch', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-21T00:00:00Z'));
    const { deps, provider, budget } = setup();
    budget.reserve.mockImplementation(async () => {
      vi.setSystemTime(new Date('2026-10-21T00:00:01Z'));
      return { ok: true };
    });
    const response = await recommend(
      request(),
      { ...environment, LLM_TEST_EXPIRES_AT: '2026-10-21T00:00:01Z' },
      deps,
    );
    expect((await response.json()).reason).toBe('disabled');
    expect(provider).not.toHaveBeenCalled();
    expect(budget.settle).toHaveBeenCalledWith(expect.any(String), 0);
  });
  it('defaults off without reading the request, catalog, or provider', async () => {
    const { deps, provider, fetcher } = setup();
    const result = await recommend(request(), {}, deps);
    expect(await result.json()).toEqual({
      outcome: 'fallback',
      reason: 'disabled',
    });
    expect(provider).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
    expect(result.headers.get('cache-control')).toBe('no-store');
  });
  it.each([
    'LLM_MAX_INPUT_TOKENS',
    'LLM_MAX_OUTPUT_TOKENS',
    'LLM_REQUESTS_PER_MINUTE',
    'LLM_CLIENT_REQUESTS_PER_MINUTE',
    'LLM_MAX_CONCURRENCY',
    'LLM_DAILY_MICRODOLLARS',
    'LLM_MONTHLY_MICRODOLLARS',
    'LLM_INPUT_MICRODOLLARS_PER_MILLION',
    'LLM_OUTPUT_MICRODOLLARS_PER_MILLION',
    'LLM_MODEL',
    'ANTHROPIC_API_KEY',
    'LLM_RATE_KEY',
    'LLM_APPROVALS_RECORDED',
  ])('fails closed without %s', async (key) => {
    const { deps, provider } = setup();
    expect(
      (
        await (
          await recommend(request(), { ...environment, [key]: undefined }, deps)
        ).json()
      ).reason,
    ).toBe('unavailable');
    expect(provider).not.toHaveBeenCalled();
  });
  it.each([
    { ...input, goal: 'x'.repeat(501) },
    { ...input, sessionId: 'private' },
    { ...input, items: catalog.items },
    { ...input, tools: ['Excel', 'Excel'] },
  ])('rejects malformed or browser-supplied extra data', async (value) => {
    const { deps, provider } = setup();
    const result = await recommend(request(value), environment, deps);
    expect(result.status).toBe(400);
    expect(provider).not.toHaveBeenCalled();
  });
  it('accepts blank goals, canonical selections, and trusted catalog IDs', async () => {
    const { deps, provider, budget, diagnostic } = setup();
    const response = await recommend(
      request({ ...input, goal: '' }),
      environment,
      deps,
    );
    const result = RecommendationResponseSchema.parse(await response.json());
    expect(result.outcome).toBe('success');
    expect(budget.reserve.mock.invocationCallOrder[0]).toBeLessThan(
      provider.mock.invocationCallOrder[0],
    );
    expect(budget.settle).toHaveBeenCalledWith(expect.any(String), 120);
    expect(diagnostic.mock.calls[0][0].requestId).toBe(
      response.headers.get('x-recommendation-request-id'),
    );
    expect(JSON.stringify(diagnostic.mock.calls)).not.toContain('organize');
    expect(JSON.stringify(provider.mock.calls)).not.toContain('sessionId');
  });
  it('does not dispatch for all-blank intake or unrecognized canonical tags', async () => {
    const { deps, provider } = setup();
    expect(
      (
        await (
          await recommend(
            request({ ...input, functionArea: null, goal: '', tools: [] }),
            environment,
            deps,
          )
        ).json()
      ).reason,
    ).toBe('not-requested');
    expect(
      (
        await recommend(
          request({ ...input, tools: ['invented'] }),
          environment,
          deps,
        )
      ).status,
    ).toBe(400);
    expect(provider).not.toHaveBeenCalled();
  });
  it('rejects mismatched, malformed, retired and oversized catalogs before dispatch', async () => {
    const { deps, provider, fetcher } = setup();
    const mismatch = await recommend(
      request({ ...input, catalogVersion: 'sha256:' + 'f'.repeat(64) }),
      environment,
      deps,
    );
    expect((await mismatch.json()).reason).toBe('catalog-mismatch');
    fetcher.mockResolvedValueOnce(
      Response.json({
        ...catalog,
        items: [{ ...catalog.items[0], status: 'retired' }],
      }),
    );
    expect(
      (await (await recommend(request(), environment, deps)).json()).reason,
    ).toBe('unavailable');
    fetcher.mockResolvedValueOnce(new Response(' '.repeat(1_048_577)));
    expect(
      (await (await recommend(request(), environment, deps)).json()).reason,
    ).toBe('unavailable');
    expect(provider).not.toHaveBeenCalled();
  });
  it('falls back on input-budget overflow without silently shortlisting', async () => {
    const { deps, provider } = setup();
    expect(
      (
        await (
          await recommend(
            request(),
            { ...environment, LLM_MAX_INPUT_TOKENS: '1' },
            deps,
          )
        ).json()
      ).reason,
    ).toBe('catalog-too-large');
    expect(provider).not.toHaveBeenCalled();
  });
  it.each([
    { youtubeIds: ['unknown0000'] },
    { youtubeIds: [catalog.items[0].youtubeId, catalog.items[0].youtubeId] },
    { youtubeIds: Array(11).fill(catalog.items[0].youtubeId) },
    { youtubeIds: [], titles: ['untrusted'] },
    'not-json',
  ])('rejects the whole invalid model result', async (value) => {
    const { deps, provider } = setup();
    provider.mockResolvedValueOnce({
      value,
      inputTokens: 100,
      outputTokens: 20,
    });
    const response = await recommend(request(), environment, deps);
    expect((await response.json()).reason).toBe('invalid-response');
  });
  it('keeps an empty relevant list distinct from malformed output', async () => {
    const { deps, provider } = setup();
    provider.mockResolvedValueOnce({
      value: { youtubeIds: [] },
      inputTokens: 100,
      outputTokens: 20,
    });
    expect(
      (await (await recommend(request(), environment, deps)).json()).youtubeIds,
    ).toEqual([]);
  });
  it('never dispatches when reservation rejects', async () => {
    const { deps, provider } = setup();
    deps.budget.reserve = vi.fn(async () => {
      throw new Error('Storage unavailable');
    });
    expect(
      (await (await recommend(request(), environment, deps)).json()).reason,
    ).toBe('unavailable');
    expect(provider).not.toHaveBeenCalled();
  });
  it('retains maximum spend after ambiguous provider failures, without retries', async () => {
    const { deps, provider, budget } = setup();
    provider.mockRejectedValueOnce(
      new Error('Provider includes private request text'),
    );
    const response = await recommend(request(), environment, deps);
    expect((await response.json()).reason).toBe('provider-error');
    expect(provider).toHaveBeenCalledTimes(1);
    expect(budget.settle).toHaveBeenCalledWith(expect.any(String), null);
  });
  it('bounds the whole request at five seconds even when a provider ignores cancellation', async () => {
    vi.useFakeTimers();
    const { deps, provider } = setup();
    provider.mockImplementation(() => new Promise(() => undefined));
    const pending = recommend(request(), environment, deps);
    await vi.advanceTimersByTimeAsync(RECOMMENDATION_DEADLINE_MS);
    expect((await (await pending).json()).reason).toBe('timeout');
    expect(provider).toHaveBeenCalledTimes(1);
    expect(provider.mock.calls[0][1].aborted).toBe(true);
  });
  it('does not dispatch after a slow reservation outlives the deadline', async () => {
    vi.useFakeTimers();
    const { deps, provider, budget } = setup();
    budget.reserve.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ ok: true }), 5_100),
        ),
    );
    const pending = recommend(request(), environment, deps);
    await vi.advanceTimersByTimeAsync(5_100);
    expect((await (await pending).json()).reason).toBe('timeout');
    expect(provider).not.toHaveBeenCalled();
    expect(budget.settle).toHaveBeenCalledWith(expect.any(String), 0);
  });
});
