import {
  readFile,
  mkdir,
  writeFile,
  readdir,
  lstat,
  rm,
} from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import {
  strictCatalog,
  canonicalJson,
  catalogDataJson,
  snapshotPath,
  LIBRARY_MAX_BYTES,
  LibraryManifestSchema,
} from '../src/library/catalog.ts';

const [input, output, ...extra] = process.argv.slice(2);
if (!input || !output || extra.length || resolve(input) === resolve(output))
  throw new Error('Use distinct library input/output directories');
try {
  const manifest = LibraryManifestSchema.parse(
    JSON.parse(await readFile(join(input, 'current.json'), 'utf8')),
  );
  const files = await readdir(join(input, 'versions'), { withFileTypes: true });
  if (!files.length || files.length > 1000)
    throw new Error('Invalid snapshot inventory');
  const assets = [];
  let total = 0;
  for (const file of files) {
    if (!file.isFile() || !/^[a-f0-9]{64}\.json$/.test(file.name))
      throw new Error('Unexpected catalog file');
    const path = join(input, 'versions', file.name);
    const stat = await lstat(path);
    if (
      !stat.isFile() ||
      stat.size > LIBRARY_MAX_BYTES ||
      (total += stat.size) > 20 * LIBRARY_MAX_BYTES
    )
      throw new Error('Catalog capacity exceeded');
    const catalog = strictCatalog(JSON.parse(await readFile(path, 'utf8')));
    const version = `sha256:${createHash('sha256').update(catalogDataJson(catalog)).digest('hex')}`;
    if (
      catalog.catalogVersion !== version ||
      `versions/${file.name}` !== snapshotPath(version)
    )
      throw new Error('Catalog digest mismatch');
    assets.push([snapshotPath(version), canonicalJson(catalog)]);
  }
  if (!assets.some(([path]) => path === snapshotPath(manifest.catalogVersion)))
    throw new Error('Current catalog is missing');
  // Validation completes before output is changed or a deployment can start.
  await rm(output, { recursive: true, force: true });
  await mkdir(join(output, 'catalog', 'versions'), { recursive: true });
  for (const [path, json] of assets)
    await writeFile(join(output, 'catalog', path), json);
  await writeFile(
    join(output, 'catalog', 'current.json'),
    canonicalJson(manifest),
  );
  await writeFile(
    join(output, '_headers'),
    '/catalog/*\n  Access-Control-Allow-Origin: *\n  X-Content-Type-Options: nosniff\n/catalog/current.json\n  Cache-Control: no-cache\n/catalog/versions/*\n  Cache-Control: public, max-age=31536000, immutable\n',
  );
  console.log(
    JSON.stringify({
      catalogVersion: manifest.catalogVersion,
      snapshots: assets.length,
    }),
  );
} catch {
  // No catalog values, paths from upstream, or credentials in deployment errors.
  console.error(
    'Library asset validation failed; previous deployment is unchanged.',
  );
  process.exitCode = 1;
}
