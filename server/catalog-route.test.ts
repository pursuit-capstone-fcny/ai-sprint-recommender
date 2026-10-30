// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import worker from './worker';
import { recommend } from './recommendations';
import { catalog, environment } from './test-helpers';
import { catalogDataJson } from '../src/library/catalog';
import { CATALOG_LOAD_DEADLINE_MS } from './catalog-route';
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const get = (
  env: Record<string, unknown> = environment,
  path = '/api/catalog',
  method = 'GET',
) => worker.fetch(new Request(`https://example.test${path}`, { method }), env);
const manifest = (version = catalog.catalogVersion) => ({
  schemaVersion: 1,
  catalogVersion: version,
  publishedAt: '2026-10-29T00:00:00Z',
});
describe('published catalog proxy', () => {
  it.each([{}, { ...environment, LLM_ENVIRONMENT: 'production' }])(
    'preserves the test-only route boundary',
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
    'rejects request-controlled sources and writes',
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
    'http://library.test',
    'https://library.test/private',
    'https://name:pass@library.test',
    'https://library.test:8443',
  ])('fails closed on invalid configured origins', async (source) => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    expect((await get({ ...environment, LIBRARY_ORIGIN: source })).status).toBe(
      503,
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('reads a current manifest and verified immutable snapshot without provider configuration', async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) =>
      Response.json(
        String(input).endsWith('/current.json') ? manifest() : catalog,
      ),
    );
    vi.stubGlobal('fetch', fetcher);
    const response = await get({
      LLM_ENVIRONMENT: 'test',
      LIBRARY_ORIGIN: environment.LIBRARY_ORIGIN,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(catalog);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(fetcher.mock.calls[0][0]).toBe(
      `${environment.LIBRARY_ORIGIN}/catalog/current.json`,
    );
    expect(fetcher.mock.calls[1][0]).toContain(
      `/versions/${catalog.catalogVersion.slice(7)}.json`,
    );
  });
  it.each([
    { ...catalog, private: 'excluded' },
    { ...catalog, items: [{ ...catalog.items[0], private: 'excluded' }] },
    { ...catalog, items: [] },
  ])('rejects leaked or tampered metadata', async (value) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input) =>
        Response.json(
          String(input).endsWith('/current.json') ? manifest() : value,
        ),
      ),
    );
    const response = await get();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'CATALOG_UNAVAILABLE' });
  });
  it('bounds an unresponsive static origin', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>(() => new Promise(() => undefined));
    vi.stubGlobal('fetch', fetcher);
    const pending = get();
    await vi.advanceTimersByTimeAsync(CATALOG_LOAD_DEADLINE_MS);
    expect((await pending).status).toBe(504);
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('revalidates the manifest and uses the new published catalog after retirement', async () => {
    vi.useFakeTimers();
    let current = catalog;
    const updated = { ...catalog, items: catalog.items.slice(1) };
    updated.catalogVersion = `sha256:${createHash('sha256').update(catalogDataJson(updated)).digest('hex')}`;
    const entries = new Map<string, Response>();
    vi.stubGlobal('caches', {
      default: {
        match: async (key: Request) => entries.get(key.url)?.clone(),
        put: async (key: Request, response: Response) => {
          entries.set(key.url, response.clone());
        },
      },
    });
    const fetcher = vi.fn<typeof fetch>(async (input) =>
      Response.json(
        String(input).endsWith('/current.json')
          ? manifest(current.catalogVersion)
          : current,
      ),
    );
    vi.stubGlobal('fetch', fetcher);
    expect(await (await get()).json()).toEqual(catalog);
    current = updated;
    expect(await (await get()).json()).toEqual(updated);
    await vi.advanceTimersByTimeAsync(61_000);
    const provider = vi.fn();
    const budget = { reserve: vi.fn(), settle: vi.fn() };
    const response = await recommend(
      new Request('https://example.test/api/recommendations', {
        method: 'POST',
        body: JSON.stringify({
          functionArea: 'Operations',
          goal: 'budget',
          tools: [],
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
