import { z } from 'zod';
import {
  parsePublicCatalog,
  type PublicCatalog,
} from '../contracts/publicCatalog.ts';

export const LIBRARY_MAX_BYTES = 1_048_576;
export const LibraryManifestSchema = z.strictObject({
  schemaVersion: z.literal(1),
  catalogVersion: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  publishedAt: z.iso.datetime(),
});
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalJson(Reflect.get(value, key))}`,
      )
      .join(',')}}`;
  }
  const result = JSON.stringify(value);
  if (result === undefined) throw new Error('Invalid public catalog value');
  return result;
}
export function strictCatalog(value: unknown): PublicCatalog {
  const catalog = parsePublicCatalog(value);
  if (
    canonicalJson(value) !== canonicalJson(catalog) ||
    catalog.items.some((item) => item.status !== 'active')
  )
    throw new Error('Unexpected public catalog fields');
  return catalog;
}
export function catalogDataJson(catalog: PublicCatalog): string {
  const { catalogVersion: _version, ...data } = catalog;
  void _version;
  return canonicalJson(data);
}
export function snapshotPath(version: string): string {
  if (!/^sha256:[a-f0-9]{64}$/.test(version))
    throw new Error('Invalid catalog version');
  return `versions/${version.slice(7)}.json`;
}
export function libraryOrigin(value: unknown): string {
  const parsed = z.url().parse(value);
  const url = new URL(parsed);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  )
    throw new Error('Use an HTTPS library origin');
  return url.origin;
}
