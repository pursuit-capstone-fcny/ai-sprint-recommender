import { createHash } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { parsePublicCatalog } from '../src/contracts/publicCatalog';
import fixture from '../fixtures/public-catalog.json';
import { catalogDataJson, snapshotPath } from '../src/library/catalog';
import { publishedCatalog, publishedHistory } from './published-library';
import { readLibraryDashboard } from '../apps-script-admin/library';
import { doGet } from './index';

afterEach(() => vi.unstubAllGlobals());
function setup() {
  const catalog = parsePublicCatalog(structuredClone(fixture));
  catalog.catalogVersion =
    'sha256:' +
    createHash('sha256').update(catalogDataJson(catalog)).digest('hex');
  const origin = 'https://library.example.test/catalog/';
  const bodies: Record<string, unknown> = {
    [origin + 'current.json']: {
      schemaVersion: 1,
      catalogVersion: catalog.catalogVersion,
      publishedAt: '2026-10-29T00:00:00Z',
    },
    [origin + snapshotPath(catalog.catalogVersion)]: catalog,
  };
  const fetch = vi.fn(
    (
      url: string,
      options?: unknown,
    ): {
      getResponseCode: () => number;
      getAllHeaders: () => Record<string, string>;
      getContentText: () => string;
    } => {
      void options;
      return {
        getResponseCode: () => (url in bodies ? 200 : 404),
        getAllHeaders: () => ({
          'Content-Type': 'application/json; charset=utf-8',
        }),
        getContentText: () => JSON.stringify(bodies[url]),
      };
    },
  );
  vi.stubGlobal('UrlFetchApp', { fetch });
  vi.stubGlobal('PropertiesService', {
    getScriptProperties: () => ({
      getProperty: (key: string) =>
        ({
          LIBRARY_PUBLIC_ORIGIN: 'https://library.example.test',
          CATALOG_PUBLIC_ENABLED: 'true',
        })[key as 'LIBRARY_PUBLIC_ORIGIN'] ?? null,
    }),
  });
  vi.stubGlobal('Utilities', {
    DigestAlgorithm: { SHA_256: 'sha256' },
    Charset: { UTF_8: 'utf8' },
    computeDigest: (_: string, text: string) => [
      ...createHash('sha256').update(text).digest(),
    ],
    newBlob: (text: string) => ({ getBytes: () => [...Buffer.from(text)] }),
    formatDate: (date: Date) => date.toISOString().slice(0, 10),
    getUuid: () => 'fixture-generation',
  });
  vi.stubGlobal('ContentService', {
    MimeType: { JSON: 'application/json' },
    createTextOutput: (text: string) => ({
      setMimeType: () => ({ getContent: () => text }),
    }),
  });
  return { catalog, bodies, origin, fetch };
}
it('uses one verified version for the public adapter and private analytics without reading draft catalog cells', () => {
  const s = setup();
  const draftRead = vi.fn(() => {
    throw new Error('Must not read draft catalog');
  });
  const book = {
    getDeveloperMetadata: () => [],
    getSheetByName: (name: string) => (name === 'Usage' ? null : draftRead()),
  };
  expect(publishedCatalog()).toEqual(s.catalog);
  expect(JSON.parse(doGet().getContent())).toEqual(s.catalog);
  const report = readLibraryDashboard(
    book as unknown as GoogleAppsScript.Spreadsheet.Spreadsheet,
  );
  expect(report.facts.filter((fact) => fact.entity === 'video')).toHaveLength(
    s.catalog.items.length,
  );
  expect(report.collectionAvailable).toBe(false);
  expect(draftRead).not.toHaveBeenCalled();
  expect(s.fetch.mock.calls[0][1]).toEqual({
    muteHttpExceptions: true,
    followRedirects: false,
  });
});
it('rejects tampered or private data and never substitutes current metadata for missing historical versions', () => {
  const s = setup();
  expect(publishedHistory(['sha256:' + '0'.repeat(64)], s.catalog)).toEqual([
    s.catalog,
  ]);
  s.catalog.items[0].title = 'Unpublished edit';
  expect(() => publishedCatalog()).toThrow('version mismatch');
  Object.assign(s.catalog, { privateNotes: 'must not publish' });
  expect(() => publishedCatalog()).toThrow();
});
it('bounds history and rejects redirects, non-JSON and oversized responses', () => {
  const s = setup();
  expect(() =>
    publishedHistory(
      Array.from(
        { length: 51 },
        (_, n) => 'sha256:' + n.toString(16).padStart(64, '0'),
      ),
      s.catalog,
    ),
  ).toThrow('capacity');
  s.fetch.mockReturnValue({
    getResponseCode: () => 302,
    getAllHeaders: () => ({}),
    getContentText: () => '',
  });
  expect(() => publishedCatalog()).toThrow('unavailable');
  s.fetch.mockReturnValue({
    getResponseCode: () => 200,
    getAllHeaders: () => ({ 'Content-Type': 'text/html' }),
    getContentText: () => '{}',
  });
  expect(() => publishedCatalog()).toThrow('response');
  s.fetch.mockReturnValue({
    getResponseCode: () => 200,
    getAllHeaders: () => ({ 'Content-Type': 'application/json' }),
    getContentText: () => ' '.repeat(4097),
  });
  expect(() => publishedCatalog()).toThrow('capacity');
});
