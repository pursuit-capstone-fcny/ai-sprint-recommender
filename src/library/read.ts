import { boundedJson } from './boundedJson';
import {
  strictCatalog,
  catalogDataJson,
  LibraryManifestSchema,
  snapshotPath,
  LIBRARY_MAX_BYTES,
} from './catalog';
import type { PublicCatalog } from '../contracts/publicCatalog';

export class PublishedCatalogVersionError extends Error {}
export async function readPublishedManifest(
  manifestUrl: string,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
) {
  const url = new URL(
    manifestUrl,
    typeof location === 'undefined' ? undefined : location.href,
  );
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/catalog/current.json' ||
    (url.protocol !== 'https:' &&
      !(
        url.protocol === 'http:' &&
        ['localhost', '127.0.0.1'].includes(url.hostname)
      ))
  )
    throw new Error('Invalid published library source');
  const response = await fetcher(url.href, {
    signal,
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    // Workers supports manual/follow only. A redirect is rejected by !ok below.
    redirect: 'manual',
    cache: 'no-store',
  });
  if (
    !response.ok ||
    !response.headers.get('content-type')?.includes('application/json')
  )
    throw new Error('Published manifest unavailable');
  const manifest = LibraryManifestSchema.parse(
    await boundedJson(response, 4096),
  );
  signal.throwIfAborted();
  return manifest;
}
export async function verifyPublishedCatalog(
  value: unknown,
): Promise<PublicCatalog> {
  const catalog = strictCatalog(value);
  const bytes = new TextEncoder().encode(catalogDataJson(catalog));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  const version = `sha256:${Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
  if (version !== catalog.catalogVersion)
    throw new Error('Catalog digest mismatch');
  return catalog;
}
export async function readPublishedCatalog(options: {
  manifestUrl: string;
  requestedVersion?: string;
  signal: AbortSignal;
  fetcher?: typeof fetch;
}): Promise<PublicCatalog> {
  const { manifestUrl, requestedVersion, signal, fetcher = fetch } = options;
  const url = new URL(
    manifestUrl,
    typeof location === 'undefined' ? undefined : location.href,
  );
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/catalog/current.json' ||
    (url.protocol !== 'https:' &&
      !(
        url.protocol === 'http:' &&
        ['localhost', '127.0.0.1'].includes(url.hostname)
      ))
  )
    throw new Error('Invalid published library source');
  const get = async (href: string, maxBytes: number, immutable: boolean) => {
    signal.throwIfAborted();
    const response = await fetcher(href, {
      signal,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      redirect: 'manual',
      // Omit the field for immutable snapshots. Workers rejects explicit
      // `default`; the browser and Worker can both use their normal caching.
      ...(!immutable ? { cache: 'no-store' as const } : {}),
    });
    if (
      !response.ok ||
      !response.headers.get('content-type')?.includes('application/json')
    )
      throw new Error('Published catalog unavailable');
    const value = await boundedJson(response, maxBytes);
    signal.throwIfAborted();
    return value;
  };
  const version =
    requestedVersion ??
    (await readPublishedManifest(url.href, signal, fetcher)).catalogVersion;
  const snapshot = new URL(`/catalog/${snapshotPath(version)}`, url.origin);
  const catalog = await verifyPublishedCatalog(
    await get(snapshot.href, LIBRARY_MAX_BYTES, true),
  );
  if (catalog.catalogVersion !== version)
    throw new PublishedCatalogVersionError(
      'Published catalog version mismatch',
    );
  return catalog;
}
