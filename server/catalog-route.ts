import { defaultCatalogCache, readCatalogSnapshot } from './catalog-cache';
import { CatalogSourceSchema, type Variables } from './config';

export const CATALOG_PATH = '/api/catalog';
export const CATALOG_LOAD_DEADLINE_MS = 9_000;
const headers = {
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
};

// An unpaid, test-only load before submission warms the same trusted cache.
export async function serveCatalog(
  request: Request,
  env: Variables,
): Promise<Response> {
  if (env.LLM_ENVIRONMENT !== 'test' || new URL(request.url).search)
    return new Response('Not found', { status: 404, headers });
  if (request.method !== 'GET')
    return new Response('Method not allowed', {
      status: 405,
      headers: { ...headers, allow: 'GET' },
    });
  const source = CatalogSourceSchema.safeParse(env.LLM_CATALOG_URL);
  const unavailable = (status = 503) =>
    Response.json({ error: 'CATALOG_UNAVAILABLE' }, { status, headers });
  if (!source.success) return unavailable();
  const abort = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<Response>((resolve) => {
    timer = setTimeout(() => {
      abort.abort();
      resolve(unavailable(504));
    }, CATALOG_LOAD_DEADLINE_MS);
  });
  try {
    return await Promise.race([
      readCatalogSnapshot({
        origin: new URL(request.url).origin,
        source: source.data,
        signal: abort.signal,
        fetcher: fetch,
        cache: defaultCatalogCache(),
      })
        .then((catalog) => Response.json(catalog, { headers }))
        .catch(() => unavailable()),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
}
