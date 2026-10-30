import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  catalogDataJson,
  canonicalJson,
  strictCatalog,
  snapshotPath,
} from '../src/library/catalog.ts';
const catalog = strictCatalog(
  JSON.parse(await readFile('fixtures/public-catalog.json', 'utf8')),
);
catalog.catalogVersion = `sha256:${createHash('sha256').update(catalogDataJson(catalog)).digest('hex')}`;
await mkdir('public/catalog/versions', { recursive: true });
await writeFile(
  `public/catalog/${snapshotPath(catalog.catalogVersion)}`,
  canonicalJson(catalog),
);
await writeFile(
  'public/catalog/current.json',
  JSON.stringify({
    schemaVersion: 1,
    catalogVersion: catalog.catalogVersion,
    publishedAt: '2026-10-29T00:00:00Z',
  }),
);
console.log('Prepared fictional static catalog for isolated preview.');
