import { type PublicCatalog } from '../src/contracts/publicCatalog';
import { boundedJson } from './bounded-json';
import {
  readPublishedCatalog,
  readPublishedManifest,
  verifyPublishedCatalog,
} from '../src/library/read';

export const CATALOG_CACHE_SECONDS = 60;
const MAX_CATALOG_BYTES = 1_048_576;
const storedAtHeader = 'x-catalog-stored-at';
const inFlight = new Map<string, Promise<PublicCatalog>>();
const snapshots = new Map<
  string,
  { catalog: PublicCatalog; storedAt: number }
>();

// Public catalog reads only. A disconnected caller cannot abort another page's
// cold read, and neither goals nor recommendation results enter this map.
export async function readSharedCatalogSnapshot(
  options: Parameters<typeof readCatalogSnapshot>[0],
) {
  const key = JSON.stringify([
    options.origin,
    options.source,
    options.requestedVersion ?? 'latest',
  ]);
  for (const [name, entry] of snapshots)
    if (
      Date.now() < entry.storedAt ||
      Date.now() - entry.storedAt >= CATALOG_CACHE_SECONDS * 1000
    )
      snapshots.delete(name);
  const saved = snapshots.get(key);
  if (saved) {
    options.signal.throwIfAborted();
    return saved.catalog;
  }
  let pending = inFlight.get(key);
  if (!pending && inFlight.size < 16) {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error('Catalog read deadline'));
      }, 5000);
    });
    pending = Promise.race([
      // Start the shared TTL at a fresh trusted source read, rather than
      // extending the age of a snapshot already held in the edge cache.
      readCatalogSnapshot({
        ...options,
        cache: undefined,
        signal: controller.signal,
      }),
      timeout,
    ])
      .then((catalog) => {
        if (
          !options.requestedVersion ||
          options.requestedVersion === catalog.catalogVersion
        ) {
          if (snapshots.size >= 4)
            snapshots.delete(snapshots.keys().next().value!);
          snapshots.set(key, { catalog, storedAt: Date.now() });
        }
        return catalog;
      })
      .finally(() => {
        clearTimeout(timer);
        inFlight.delete(key);
      });
    inFlight.set(key, pending);
  }
  if (!pending) throw new Error('Catalog read capacity reached');
  const shared = pending;
  return new Promise<PublicCatalog>((resolve, reject) => {
    const cancel = () => reject(new Error('Catalog read aborted'));
    options.signal.addEventListener('abort', cancel, { once: true });
    if (options.signal.aborted) cancel();
    shared
      .then(resolve, reject)
      .finally(() => options.signal.removeEventListener('abort', cancel));
  });
}

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
  version = 'latest',
): Request {
  const url = new URL('/__recommendation-catalog/v1', origin);
  url.searchParams.set('source', source);
  url.searchParams.set('version', version);
  return new Request(url, { method: 'GET' });
}

export async function readCatalogSnapshot(options: {
  origin: string;
  source: string;
  requestedVersion?: string;
  currentVersion?: string;
  signal: AbortSignal;
  fetcher: typeof fetch;
  cache?: CatalogCache;
  waitUntil?: (task: Promise<unknown>) => void;
}): Promise<PublicCatalog> {
  const { origin, source, requestedVersion, signal, fetcher, cache } = options;
  if (!requestedVersion) {
    const manifest = await readPublishedManifest(source, signal, fetcher);
    return readCatalogSnapshot({
      ...options,
      requestedVersion: manifest.catalogVersion,
      currentVersion: manifest.catalogVersion,
    });
  }
  if (cache && requestedVersion) {
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
        const catalog = await verifyPublishedCatalog(
          await boundedJson(cached, MAX_CATALOG_BYTES),
        );
        if (
          Date.now() - storedAt < CATALOG_CACHE_SECONDS * 1_000 &&
          (!requestedVersion || catalog.catalogVersion === requestedVersion)
        )
          return catalog;
      }
    } catch {
      // Cache errors and invalid snapshots are misses; the trusted source remains available.
    }
  }
  signal.throwIfAborted();
  const catalog = await readPublishedCatalog({
    manifestUrl: source,
    requestedVersion: options.currentVersion,
    signal,
    fetcher,
  });
  signal.throwIfAborted();
  if (cache) {
    const save = async () => {
      const snapshot = Response.json(catalog, {
        headers: {
          'cache-control': `public, max-age=${CATALOG_CACHE_SECONDS}`,
          [storedAtHeader]: Date.now().toString(),
        },
      });
      // The catalog GET can find the latest validated snapshot without browser input.
      // Versioned lookups still miss on any new version and fetch the trusted source.
      await Promise.allSettled([
        cache.put(
          catalogCacheKey(origin, source, catalog.catalogVersion),
          snapshot.clone(),
        ),
        cache.put(catalogCacheKey(origin, source), snapshot),
      ]);
    };
    const saved = save().catch(() => undefined);
    // Recommendation latency must not depend on a cache write. Catalog GET waits
    // for it so the following submission can reuse the validated version.
    if (options.waitUntil) options.waitUntil(saved);
    else await saved;
  }
  return catalog;
}
