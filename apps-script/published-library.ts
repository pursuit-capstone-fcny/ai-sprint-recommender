/// <reference types="google-apps-script" />
import { parseSheetLink } from '../src/admin/sheetLink';
import {
  catalogDataJson,
  LIBRARY_MAX_BYTES,
  LibraryManifestSchema,
  snapshotPath,
  strictCatalog,
} from '../src/library/catalog';
import type { PublicCatalog } from '../src/contracts/publicCatalog';

export function configuredLibrarySheet() {
  return parseSheetLink(
    PropertiesService.getScriptProperties().getProperty(
      'LIBRARY_SOURCE_SHEET_URL',
    ),
  );
}
function origin() {
  const value = PropertiesService.getScriptProperties().getProperty(
    'LIBRARY_PUBLIC_ORIGIN',
  );
  if (!value || !/^https:\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(value))
    throw new Error('Published library is not configured');
  return value;
}
function json(url: string, limit: number) {
  const response = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    followRedirects: false,
  });
  if (response.getResponseCode() !== 200)
    throw new Error('Published library unavailable');
  const headers = response.getAllHeaders();
  const type = Object.entries(headers).find(
    ([key]) => key.toLowerCase() === 'content-type',
  )?.[1];
  if (typeof type !== 'string' || !/^application\/json(?:\s*;|$)/i.test(type))
    throw new Error('Invalid catalog response');
  const text = response.getContentText();
  if (text.length > limit || Utilities.newBlob(text).getBytes().length > limit)
    throw new Error('Catalog capacity reached');
  return JSON.parse(text);
}
export function publishedCatalog(version?: string): PublicCatalog {
  const base = origin() + '/catalog/';
  const expected =
    version ??
    LibraryManifestSchema.parse(json(base + 'current.json', 4096))
      .catalogVersion;
  const catalog = strictCatalog(
    json(base + snapshotPath(expected), LIBRARY_MAX_BYTES),
  );
  const hash = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    catalogDataJson(catalog),
    Utilities.Charset.UTF_8,
  )
    .map((byte) => (byte & 255).toString(16).padStart(2, '0'))
    .join('');
  if (catalog.catalogVersion !== expected || expected !== 'sha256:' + hash)
    throw new Error('Catalog version mismatch');
  return catalog;
}
// Missing legacy snapshots stay unmapped. Never substitute today's tags.
export function publishedHistory(
  versions: Iterable<string>,
  current: PublicCatalog,
) {
  const unique = [...new Set(versions)].filter(
    (version) => version !== current.catalogVersion,
  );
  if (unique.length > 50)
    throw new Error('Historical catalog capacity reached');
  const catalogs = [current];
  let bytes = JSON.stringify(current).length;
  for (const version of unique) {
    let catalog: PublicCatalog;
    try {
      catalog = publishedCatalog(version);
    } catch {
      continue;
    }
    bytes += JSON.stringify(catalog).length;
    if (bytes > 8 * LIBRARY_MAX_BYTES)
      throw new Error('Historical catalog capacity reached');
    catalogs.push(catalog);
  }
  return catalogs;
}
