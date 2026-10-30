// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  catalogCacheKey,
  readCatalogSnapshot,
  type CatalogCache,
  CATALOG_CACHE_SECONDS,
} from './catalog-cache';
import { catalog, environment } from './test-helpers';

class TTLCache implements CatalogCache {
  entries = new Map<string, { response: Response; expires: number }>();
  async match(request: Request): Promise<Response | undefined> {
    const entry = this.entries.get(request.url);
    return entry && entry.expires > Date.now()
      ? entry.response.clone()
      : undefined;
  }
  async put(request: Request, response: Response): Promise<void> {
    const ttl = Number(
      response.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1] ?? 0,
    );
    this.entries.set(request.url, {
      response: response.clone(),
      expires: Date.now() + ttl * 1000,
    });
  }
}
const origin = 'https://example.test';
const source = environment.LLM_CATALOG_URL;
function setup() {
  const cache = new TTLCache();
  const fetcher = vi.fn<typeof fetch>(async () => Response.json(catalog));
  const read = (
    requestedVersion = catalog.catalogVersion,
    catalogSource = source,
  ) =>
    readCatalogSnapshot({
      origin,
      source: catalogSource,
      requestedVersion,
      signal: new AbortController().signal,
      fetcher,
      cache,
    });
  return { cache, fetcher, read };
}
async function seed(
  cache: CatalogCache,
  value: unknown,
  version = catalog.catalogVersion,
  storedAt = Date.now(),
) {
  await cache.put(
    catalogCacheKey(origin, source, version),
    Response.json(value, {
      headers: {
        'cache-control': 'public, max-age=60',
        'x-catalog-stored-at': storedAt.toString(),
      },
    }),
  );
}
afterEach(() => vi.useRealTimers());
describe('validated catalog snapshot cache', () => {
  it('reuses a validated version without another source request and expires at 60 seconds', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-21T00:00:00Z'));
    const { read, fetcher } = setup();
    expect(await read()).toEqual(catalog);
    vi.advanceTimersByTime(CATALOG_CACHE_SECONDS * 1000 - 1);
    expect(await read()).toEqual(catalog);
    expect(fetcher).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(await read()).toEqual(catalog);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('misses a new version or source and caches the fresh response under its returned version only', async () => {
    const { read, fetcher, cache } = setup();
    await read();
    const requested = 'sha256:' + 'f'.repeat(64);
    expect(await read(requested)).toEqual(catalog);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(
      await cache.match(catalogCacheKey(origin, source, requested)),
    ).toBeUndefined();
    await read(
      catalog.catalogVersion,
      'https://script.google.com/macros/s/other/exec',
    );
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it.each([
    { malformed: true },
    { ...catalog, items: [{ ...catalog.items[0], status: 'retired' }] },
    { ...catalog, items: [{ ...catalog.items[0], tools: ['unknown-tool'] }] },
    { ...catalog, catalogVersion: 'sha256:' + '0'.repeat(64) },
  ])('treats an invalid cached snapshot as a miss', async (invalid) => {
    const { read, fetcher, cache } = setup();
    await seed(cache, invalid);
    expect(await read()).toEqual(catalog);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('never serves stale data even if a cache implementation ignores TTL', async () => {
    const { fetcher } = setup();
    const cache = {
      match: vi.fn(async () =>
        Response.json(catalog, {
          headers: { 'x-catalog-stored-at': (Date.now() - 60_000).toString() },
        }),
      ),
      put: vi.fn(async () => undefined),
    };
    await readCatalogSnapshot({
      origin,
      source,
      requestedVersion: catalog.catalogVersion,
      signal: new AbortController().signal,
      fetcher,
      cache,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('fetches fresh when cache reads fail and keeps valid data when cache writes fail', async () => {
    const { fetcher } = setup();
    const cache = {
      match: vi.fn(async () => {
        throw new Error('cache unavailable');
      }),
      put: vi.fn(async () => {
        throw new Error('cache unavailable');
      }),
    };
    expect(
      await readCatalogSnapshot({
        origin,
        source,
        requestedVersion: catalog.catalogVersion,
        signal: new AbortController().signal,
        fetcher,
        cache,
      }),
    ).toEqual(catalog);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(cache.put).toHaveBeenCalledTimes(2);
  });
  it('does not wait for cache writes when a Worker context keeps them alive', async () => {
    const { fetcher } = setup();
    let finish: () => void = () => undefined;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const waitUntil = vi.fn();
    const cache = { match: async () => undefined, put: vi.fn(() => pending) };
    expect(
      await readCatalogSnapshot({
        origin,
        source,
        requestedVersion: catalog.catalogVersion,
        signal: new AbortController().signal,
        fetcher,
        cache,
        waitUntil,
      }),
    ).toEqual(catalog);
    expect(waitUntil).toHaveBeenCalledTimes(1);
    expect(cache.put).toHaveBeenCalledTimes(2);
    finish();
    await waitUntil.mock.calls[0][0];
  });
  it('does not extend freshness while decoding a cached snapshot', async () => {
    vi.useFakeTimers();
    const storedAt = Date.now();
    vi.advanceTimersByTime(59_999);
    const { fetcher } = setup();
    const cache = {
      match: async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              setTimeout(() => {
                controller.enqueue(
                  new TextEncoder().encode(JSON.stringify(catalog)),
                );
                controller.close();
              }, 2);
            },
          }),
          { headers: { 'x-catalog-stored-at': storedAt.toString() } },
        ),
      put: async () => undefined,
    };
    const result = readCatalogSnapshot({
      origin,
      source,
      requestedVersion: catalog.catalogVersion,
      signal: new AbortController().signal,
      fetcher,
      cache,
    });
    await vi.advanceTimersByTimeAsync(2);
    expect(await result).toEqual(catalog);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([
    { ...catalog, items: [{ ...catalog.items[0], status: 'retired' }] },
    {
      ...catalog,
      items: [{ ...catalog.items[0], functionAreas: ['unknown-area'] }],
    },
  ])('never caches an invalid fresh snapshot', async (invalid) => {
    const { read, fetcher, cache } = setup();
    fetcher.mockResolvedValueOnce(Response.json(invalid));
    await expect(read()).rejects.toThrow();
    expect(cache.entries.size).toBe(0);
  });
});
