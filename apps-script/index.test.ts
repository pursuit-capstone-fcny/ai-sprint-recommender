import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { doGet } from './index';
import { headers } from './catalog';
import { parsePublicCatalog } from '../src/contracts/publicCatalog';

afterEach(() => vi.unstubAllGlobals());

function googleServices(enabled: string | null = 'true') {
  const events: string[] = [];
  const uploadDate = new Date('2026-10-19T02:00:00Z');
  const sheets: Record<string, unknown[][]> = {
    Catalog: [
      headers.Catalog.map((header) =>
        header === 'addedAt' ? ' addedAt ' : header,
      ),
      [
        'fx01GrntRpt',
        '[Fixture] Public title',
        'Public description',
        '',
        '',
        '',
        uploadDate,
        120,
        'active',
        true,
      ],
    ],
    Dictionary: [[...headers.Dictionary]],
    Synonyms: [[...headers.Synonyms]],
    'Adjacent tools': [[...headers['Adjacent tools']]],
    Problems: [['Old', 'diagnostic']],
  };
  const table = (name: string) => {
    if (!(name in sheets)) return null;
    return {
      getDataRange: () => ({
        getValues: () => sheets[name].map((row) => [...row]),
      }),
      clearContents: () => {
        sheets[name] = [];
      },
      getRange: () => ({
        setValues: (rows: unknown[][]) => {
          sheets[name] = rows;
        },
      }),
    };
  };
  const openById = vi.fn(() => ({
    getSheetByName: table,
    insertSheet: (name: string) => {
      sheets[name] = [];
      return table(name);
    },
    getSpreadsheetTimeZone: () => 'America/New_York',
  }));
  vi.stubGlobal('PropertiesService', {
    getScriptProperties: () => ({
      getProperty: (name: string) =>
        name === 'CATALOG_PUBLIC_ENABLED' ? enabled : 'test-spreadsheet',
    }),
  });
  vi.stubGlobal('SpreadsheetApp', {
    openById,
    flush: () => {
      events.push('flush');
    },
  });
  vi.stubGlobal('LockService', {
    getScriptLock: () => ({
      tryLock: () => {
        events.push('lock');
        return true;
      },
      releaseLock: () => {
        events.push('unlock');
      },
    }),
  });
  const formatDate = vi.fn(() => '2026-10-18');
  vi.stubGlobal('Utilities', {
    formatDate,
    DigestAlgorithm: { SHA_256: 'sha256' },
    Charset: { UTF_8: 'utf8' },
    computeDigest: (_algorithm: string, json: string) =>
      Array.from(createHash('sha256').update(json).digest(), (byte) =>
        byte > 127 ? byte - 256 : byte,
      ),
  });
  const mimeTypes: string[] = [];
  vi.stubGlobal('ContentService', {
    MimeType: { JSON: 'application/json' },
    createTextOutput: (text: string) => {
      const output = {
        getContent: () => text,
        setMimeType: (mime: string) => {
          mimeTypes.push(mime);
          return output;
        },
      };
      return output;
    },
  });
  return { openById, sheets, events, uploadDate, formatDate, mimeTypes };
}

describe('Apps Script adapter', () => {
  it('AC-9.2/9.4: returns validated JSON and flushes diagnostics before releasing the lock', () => {
    const services = googleServices();
    const catalog = parsePublicCatalog(JSON.parse(doGet().getContent()));
    expect(catalog.items[0].addedAt).toBe('2026-10-18');
    expect(services.formatDate).toHaveBeenCalledWith(
      services.uploadDate,
      'America/New_York',
      'yyyy-MM-dd',
    );
    expect(services.openById).toHaveBeenCalledWith('test-spreadsheet');
    expect(services.mimeTypes).toEqual(['application/json']);
    expect(services.events).toEqual(['lock', 'flush', 'unlock']);
    expect(services.sheets.Problems).toEqual([
      ['Tab', 'Row', 'Field', 'Reason'],
    ]);
  });

  it('AC-9.2: is disabled by default without touching a spreadsheet', () => {
    const services = googleServices(null);
    expect(JSON.parse(doGet().getContent())).toEqual({
      error: { code: 'CATALOG_DISABLED' },
    });
    expect(services.openById).not.toHaveBeenCalled();
    expect(services.events).toEqual([]);
  });

  it('AC-9.4: creates the reserved Problems tab when absent', () => {
    const services = googleServices();
    delete services.sheets.Problems;
    parsePublicCatalog(JSON.parse(doGet().getContent()));
    expect(services.sheets.Problems).toEqual([
      ['Tab', 'Row', 'Field', 'Reason'],
    ]);
  });

  it('AC-9.2: replaces Google service errors with a content-free envelope', () => {
    const services = googleServices();
    services.openById.mockImplementation(() => {
      throw new Error('private Sheet error');
    });
    expect(JSON.parse(doGet().getContent())).toEqual({
      error: { code: 'CATALOG_UNAVAILABLE' },
    });
    expect(services.events).toEqual(['lock', 'unlock']);
  });
});
