import { afterEach, describe, it, expect } from 'vitest';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  existsSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fixture from '../../fixtures/public-catalog.json';
import { catalogDataJson, strictCatalog, canonicalJson } from './catalog';
const paths: string[] = [];
afterEach(() => {
  paths
    .splice(0)
    .forEach((path) => rmSync(path, { recursive: true, force: true }));
});
function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'fcny-publication-'));
  paths.push(dir);
  const input = join(dir, 'input'),
    output = join(dir, 'output');
  mkdirSync(join(input, 'versions'), { recursive: true });
  const catalog = strictCatalog(fixture);
  catalog.catalogVersion = `sha256:${createHash('sha256').update(catalogDataJson(catalog)).digest('hex')}`;
  const file = join(
    input,
    'versions',
    `${catalog.catalogVersion.slice(7)}.json`,
  );
  writeFileSync(file, canonicalJson(catalog));
  writeFileSync(
    join(input, 'current.json'),
    JSON.stringify({
      schemaVersion: 1,
      catalogVersion: catalog.catalogVersion,
      publishedAt: '2026-10-29T12:00:00Z',
    }),
  );
  return {
    input,
    output,
    file,
    catalog,
    run: () =>
      execFileSync(
        process.execPath,
        ['scripts/build-library-assets.mjs', input, output],
        { stdio: 'pipe' },
      ),
  };
}
describe('static catalog publication build', () => {
  it('copies only verified public snapshots and emits immutable/current caching policies', () => {
    const s = setup();
    s.run();
    expect(
      JSON.parse(
        readFileSync(join(s.output, 'catalog', 'current.json'), 'utf8'),
      ).catalogVersion,
    ).toBe(s.catalog.catalogVersion);
    expect(readFileSync(join(s.output, '_headers'), 'utf8')).toContain(
      'immutable',
    );
  });
  it('keeps newer immutable snapshots when an older manifest is deployed for rollback', () => {
    const old = setup(),
      latest = setup();
    latest.catalog.items[0].title = 'New published title';
    latest.catalog.catalogVersion = `sha256:${createHash('sha256').update(catalogDataJson(latest.catalog)).digest('hex')}`;
    const newerFile = `${latest.catalog.catalogVersion.slice(7)}.json`;
    writeFileSync(
      join(latest.input, 'versions', newerFile),
      canonicalJson(latest.catalog),
    );
    execFileSync(
      process.execPath,
      ['scripts/build-library-assets.mjs', old.input, old.output, latest.input],
      { stdio: 'pipe' },
    );
    expect(
      JSON.parse(readFileSync(join(old.output, 'catalog/current.json'), 'utf8'))
        .catalogVersion,
    ).toBe(old.catalog.catalogVersion);
    expect(
      JSON.parse(
        readFileSync(join(old.output, 'catalog/versions', newerFile), 'utf8'),
      ),
    ).toEqual(latest.catalog);
    expect(
      existsSync(
        join(
          old.output,
          'catalog/versions',
          `${old.catalog.catalogVersion.slice(7)}.json`,
        ),
      ),
    ).toBe(true);
  });
  it('rejects tampered snapshots before changing previous output', () => {
    const s = setup();
    mkdirSync(s.output);
    writeFileSync(join(s.output, 'last-good'), 'keep');
    writeFileSync(s.file, JSON.stringify({ ...s.catalog, items: [] }));
    expect(s.run).toThrow();
    expect(readFileSync(join(s.output, 'last-good'), 'utf8')).toBe('keep');
  });
  it('rejects private fields and missing manifest targets', () => {
    const s = setup();
    writeFileSync(s.file, JSON.stringify({ ...s.catalog, usage: 'private' }));
    expect(s.run).toThrow();
    expect(existsSync(s.output)).toBe(false);
  });
});
