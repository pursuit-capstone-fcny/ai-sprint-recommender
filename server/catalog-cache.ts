import {
  parsePublicCatalog,
  type PublicCatalog,
} from '../src/contracts/publicCatalog';
import { boundedJson } from './bounded-json';

export const CATALOG_CACHE_SECONDS = 60;
const MAX_CATALOG_BYTES = 1_048_576;
const storedAtHeader = 'x-catalog-stored-at';

export interface CatalogCache {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

export function defaultCatalogCache(): CatalogCache | undefined {
  const storage: CacheStorage & { default?: CatalogCache } = globalThis.caches;
  return storage?.default;
}

export function catalogCacheKey(
  origin: string,
  source: string,
  version: string,
): Request {
  const url = new URL('/__recommendation-catalog/v1', origin);
  url.searchParams.set('source', source);
  url.searchParams.set('version', version);
  return new Request(url, { method: 'GET' });
}

export async function readCatalogSnapshot(options: {
  origin: string;
  source: string;
  requestedVersion: string;
  signal: AbortSignal;
  fetcher: typeof fetch;
  cache?: CatalogCache;
}): Promise<PublicCatalog> {
  const { origin, source, requestedVersion, signal, fetcher, cache } = options;
  if (cache) {
    try {
      const cached = await cache.match(
        catalogCacheKey(origin, source, requestedVersion),
      );
      const saved = cached?.headers.get(storedAtHeader);
      const storedAt =
        saved === null || saved === undefined ? NaN : Number(saved);
      const age = Date.now() - storedAt;
      if (
        cached?.ok &&
        Number.isSafeInteger(storedAt) &&
        age >= 0 &&
        age < CATALOG_CACHE_SECONDS * 1_000
      ) {
        const catalog = parsePublicCatalog(
          await boundedJson(cached, MAX_CATALOG_BYTES),
        );
        if (catalog.catalogVersion === requestedVersion) return catalog;
      }
    } catch {
      // Cache errors and invalid snapshots are misses; the trusted source remains available.
    }
  }
  signal.throwIfAborted();
  const response = await fetcher(source, {
    signal,
    redirect: 'follow',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  });
  if (!response.ok) throw new Error('Catalog unavailable');
  const catalog = parsePublicCatalog(
    await boundedJson(response, MAX_CATALOG_BYTES),
  );
  signal.throwIfAborted();
  if (cache) {
    try {
      // Store only the validated server snapshot, under its own version even on a mismatch.
      await cache.put(
        catalogCacheKey(origin, source, catalog.catalogVersion),
        Response.json(catalog, {
          headers: {
            'cache-control': `public, max-age=${CATALOG_CACHE_SECONDS}`,
            [storedAtHeader]: Date.now().toString(),
          },
        }),
      );
    } catch {
      // A cache write must not turn a valid source response into a fallback.
    }
  }
  return catalog;
}
