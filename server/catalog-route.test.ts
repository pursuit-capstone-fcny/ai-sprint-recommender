// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from './worker';
import { recommend } from './recommendations';
import { catalog, environment } from './test-helpers';
import type { CatalogCache } from './catalog-cache';
import { CATALOG_LOAD_DEADLINE_MS } from './catalog-route';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('test catalog route', () => {
  const get = (
    env: Record<string, unknown> = environment,
    path = '/api/catalog',
    method = 'GET',
  ) =>
    worker.fetch(new Request(`https://example.test${path}`, { method }), env);
  it.each([{}, { ...environment, LLM_ENVIRONMENT: 'production' }])(
    'keeps the route unavailable outside test deployments',
    async (env) => {
      const fetcher = vi.fn();
      vi.stubGlobal('fetch', fetcher);
      expect((await get(env)).status).toBe(404);
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
  it.each([
    ['/api/catalog?source=https://attacker.test', 'GET', 404],
    ['/api/catalog', 'POST', 405],
  ])(
    'rejects request parameters and writes before loading the source',
    async (path, method, status) => {
      const fetcher = vi.fn();
      vi.stubGlobal('fetch', fetcher);
      expect(
        (await get(environment, String(path), String(method))).status,
      ).toBe(status);
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
  it.each([
    undefined,
    'https://attacker.test/catalog',
    'https://script.google.com/macros/s/fixture/exec?private=value',
    'https://private@script.google.com/macros/s/fixture/exec',
    'https://script.google.com:8443/macros/s/fixture/exec',
  ])('fails closed without a trusted configured source', async (source) => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const response = await get({ ...environment, LLM_CATALOG_URL: source });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'CATALOG_UNAVAILABLE' });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([
    { ...catalog, items: [{ ...catalog.items[0], status: 'retired' }] },
    { ...catalog, items: [{ ...catalog.items[0], tools: ['unknown'] }] },
    { private: 'private-value' },
  ])(
    'rejects invalid snapshots without exposing their content',
    async (value) => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => Response.json(value)),
      );
      const response = await get();
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: 'CATALOG_UNAVAILABLE' });
    },
  );
  it('bounds an unresponsive upstream without leaking network details or retaining a timer', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>(() => new Promise(() => undefined));
    vi.stubGlobal('fetch', fetcher);
    const response = get();
    await vi.advanceTimersByTimeAsync(CATALOG_LOAD_DEADLINE_MS);
    expect((await response).status).toBe(504);
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('returns only public fields, with no browser caching or provider setup', async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({
        ...catalog,
        private: 'private-value',
        items: catalog.items.map((item) => ({
          ...item,
          private: 'private-value',
        })),
      }),
    );
    vi.stubGlobal('fetch', fetcher);
    const response = await get({
      LLM_ENVIRONMENT: 'test',
      LLM_CATALOG_URL: environment.LLM_CATALOG_URL,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(await response.json()).toEqual(catalog);
    expect(fetcher.mock.calls[0][0]).toBe(environment.LLM_CATALOG_URL);
  });
  it('loads a slow cold catalog before submission and refreshes expired snapshots before the next submission', async () => {
    vi.useFakeTimers();
    const entries = new Map<string, Response>();
    const cache: CatalogCache = {
      match: async (key) => entries.get(key.url)?.clone(),
      put: async (key, value) => {
        entries.set(key.url, value.clone());
      },
    };
    const fetcher = vi.fn<typeof fetch>(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(Response.json(catalog)), 5_200);
        }),
    );
    vi.stubGlobal('fetch', fetcher);
    vi.stubGlobal('caches', { default: cache });
    const provider = vi.fn(async () => ({
      value: { youtubeIds: [catalog.items[0].youtubeId] },
      inputTokens: 100,
      outputTokens: 20,
    }));
    const deps = {
      provider,
      budget: {
        reserve: async () => ({ ok: true as const }),
        settle: async () => undefined,
      },
      clientKey: async () => 'fixture',
    };
    for (const loadNumber of [1, 2]) {
      const loading = worker.fetch(
        new Request('https://example.test/api/catalog'),
        {
          ...environment,
          LLM_ENABLED: 'false',
        },
      );
      await vi.advanceTimersByTimeAsync(5_200);
      const response = await loading;
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(catalog);
      // A second page load in the freshness window also avoids another Sheet read.
      expect((await get()).status).toBe(200);
      const result = await recommend(
        new Request('https://example.test/api/recommendations', {
          method: 'POST',
          body: JSON.stringify({
            functionArea: 'Operations',
            tools: [],
            goal: 'organize data',
            catalogVersion: catalog.catalogVersion,
          }),
        }),
        environment,
        deps,
      );
      expect((await result.json()).outcome).toBe('success');
      expect(fetcher).toHaveBeenCalledTimes(loadNumber);
      await vi.advanceTimersByTimeAsync(60_000);
    }
    expect(provider).toHaveBeenCalledTimes(2);
  });
  it('fetches the current catalog at expiry and never resurrects a removed item from an old version', async () => {
    vi.useFakeTimers();
    const entries = new Map<string, Response>();
    vi.stubGlobal('caches', {
      default: {
        match: async (key: Request) => entries.get(key.url)?.clone(),
        put: async (key: Request, value: Response) => {
          entries.set(key.url, value.clone());
        },
      },
    });
    const updated = {
      ...catalog,
      catalogVersion: 'sha256:' + 'f'.repeat(64),
      items: catalog.items.slice(1),
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(catalog))
      .mockImplementation(async () => Response.json(updated));
    vi.stubGlobal('fetch', fetcher);
    expect(await (await get()).json()).toEqual(catalog);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(await (await get()).json()).toEqual(updated);
    const provider = vi.fn();
    const budget = { reserve: vi.fn(), settle: vi.fn() };
    const response = await recommend(
      new Request('https://example.test/api/recommendations', {
        method: 'POST',
        body: JSON.stringify({
          functionArea: 'Operations',
          tools: [],
          goal: 'organize data',
          catalogVersion: catalog.catalogVersion,
        }),
      }),
      environment,
      { provider, budget },
    );
    expect(await response.json()).toMatchObject({
      outcome: 'fallback',
      reason: 'catalog-mismatch',
      catalogVersion: updated.catalogVersion,
    });
    expect(provider).not.toHaveBeenCalled();
    expect(budget.reserve).not.toHaveBeenCalled();
  });
});
