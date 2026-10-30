import { publishFixture } from '../fixtures/mock-published-library';
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import catalogFixture from '../fixtures/public-catalog.json';
import { impressionEvent, searchEvent } from '../fixtures/usage-events';
import { headers } from './catalog';
import { doGet, doPost, initializeUsageLog, purgeUsageLog } from './index';
import { MAX_USAGE_ROWS } from './usage';
import { usageHeaders } from './usage-sheet';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function setup() {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(searchEvent.time));
  const log = vi.spyOn(console, 'info').mockImplementation(() => {});
  const operations: string[] = [];
  const properties: Record<string, string> = {
    USAGE_LOGGING_ENABLED: 'true',
    USAGE_SPREADSHEET_ID: 'fixture-usage-book',
    USAGE_RETENTION_DAYS: '30',
    USAGE_MAX_PER_MINUTE: '10',
    USAGE_MAX_PER_DAY: '100',
    USAGE_MAX_ROWS: '1000',
    CATALOG_SPREADSHEET_ID: 'fixture-catalog-book',
    CATALOG_PUBLIC_ENABLED: 'true',
  };
  const usage: Record<string, unknown[][]> = { Usage: [[...usageHeaders]] };
  const gridRows: Record<string, number> = { Usage: 1000 };
  const catalog: Record<string, unknown[][]> = {
    Catalog: [
      [...headers.Catalog],
      ...catalogFixture.items.map((item) =>
        headers.Catalog.map((key) =>
          Array.isArray(item[key]) ? item[key].join(',') : item[key],
        ),
      ),
    ],
    Dictionary: [
      [...headers.Dictionary],
      ...catalogFixture.functionAreas.map((value) => ['functionArea', value]),
      ...catalogFixture.tools.map((value) => ['tool', value]),
      ...catalogFixture.tasks.map((value) => ['task', value]),
    ],
    Synonyms: [
      [...headers.Synonyms],
      ...catalogFixture.synonyms.map(({ alias, category, target }) => [
        alias,
        category,
        target,
      ]),
    ],
    'Adjacent tools': [
      [...headers['Adjacent tools']],
      ...catalogFixture.adjacentTools.map(({ source, related, task }) => [
        source,
        related,
        task,
      ]),
    ],
  };
  const table = (tables: Record<string, unknown[][]>, name: string) => {
    if (!(name in tables)) return null;
    return {
      getLastRow: () => tables[name].length,
      getMaxRows: () => gridRows[name] ?? 1000,
      insertRowsAfter: (row: number, count: number) => {
        gridRows[name] = row + count;
        operations.push(`grow:${row}:${count}`);
      },
      getLastColumn: () =>
        Math.max(0, ...tables[name].map((row) => row.length)),
      getDataRange: () => ({
        getValues: () => tables[name].map((row) => [...row]),
      }),
      clearContents: () => {
        tables[name] = [];
      },
      deleteRows: (row: number, count: number) => {
        operations.push(`delete:${row}:${count}`);
        tables[name].splice(row - 1, count);
      },
      getRange: (row: number, column: number, count: number, width: number) => {
        if (row + count - 1 > (gridRows[name] ?? 1000))
          throw new Error('Range outside grid');
        const range = {
          getValues: () =>
            tables[name]
              .slice(row - 1, row - 1 + count)
              .map((values) => values.slice(column - 1, column - 1 + width)),
          setNumberFormat: (format: string) => {
            operations.push(`format:${format}`);
            return range;
          },
          setValues: (values: unknown[][]) => {
            operations.push(`write:${name}`);
            values.forEach((value, index) => {
              tables[name][row - 1 + index] = [...value];
            });
            return range;
          },
        };
        return range;
      },
    };
  };
  const openById = vi.fn((id: string) => {
    const tables = id === 'fixture-usage-book' ? usage : catalog;
    return {
      getSheetByName: (name: string) => table(tables, name),
      insertSheet: (name: string) => {
        tables[name] = [];
        return table(tables, name);
      },
    };
  });
  const flush = vi.fn(() => {
    operations.push('flush');
  });
  vi.stubGlobal('PropertiesService', {
    getScriptProperties: () => ({
      getProperty: (name: string) => properties[name] ?? null,
    }),
  });
  vi.stubGlobal('SpreadsheetApp', { openById, flush });
  vi.stubGlobal('LockService', {
    getScriptLock: () => ({
      tryLock: () => {
        operations.push('lock');
        return true;
      },
      releaseLock: () => {
        operations.push('unlock');
      },
    }),
  });
  vi.stubGlobal('Utilities', {
    DigestAlgorithm: { SHA_256: 'sha256' },
    Charset: { UTF_8: 'utf8' },
    computeDigest: (_algorithm: string, json: string) =>
      Array.from(createHash('sha256').update(json).digest()),
  });
  vi.stubGlobal('ContentService', {
    MimeType: { JSON: 'application/json' },
    createTextOutput: (content: string) => ({
      setMimeType: () => ({ getContent: () => content }),
    }),
  });
  const publish = () =>
    publishFixture(catalog as unknown as import('./catalog').Workbook);
  publishFixture(catalog as unknown as import('./catalog').Workbook, true);
  const send = (value: unknown = searchEvent) =>
    JSON.parse(
      doPost({
        postData: { type: 'text/plain', contents: JSON.stringify(value) },
      }).getContent(),
    );
  return {
    publish,
    properties,
    usage,
    catalog,
    operations,
    openById,
    flush,
    log,
    send,
    gridRows,
  };
}

describe('usage Apps Script adapter', () => {
  it('AC-16.3: writes literal JSON to the configured usage book and flushes under lock', () => {
    const { send, usage, operations, openById } = setup();
    expect(send()).toEqual({ ok: true, status: 'accepted' });
    expect(usage.Usage[1].slice(0, 2)).toEqual([
      searchEvent.eventId,
      searchEvent.time,
    ]);
    expect(JSON.parse(String(usage.Usage[1][2]))).toEqual(searchEvent);
    expect(operations).toEqual([
      'lock',
      'format:@',
      'write:Usage',
      'flush',
      'unlock',
    ]);
    expect(openById.mock.calls).toEqual([['fixture-usage-book']]);
    expect(send()).toEqual({ ok: true, status: 'duplicate' });
    expect(usage.Usage).toHaveLength(2);
  });

  it('stores formula-shaped canonical tags inside a JSON object, never as formulas', () => {
    const services = setup();
    services.catalog.Dictionary.push(['task', '=1+1']);
    services.publish();
    const catalog = JSON.parse(doGet().getContent());
    expect(
      services.send({
        ...searchEvent,
        tasks: ['=1+1'],
        catalogVersion: catalog.catalogVersion,
      }),
    ).toHaveProperty('status', 'accepted');
    expect(
      services.usage.Usage[1].every(
        (value) => typeof value === 'string' && !/^[=+\-@]/.test(value),
      ),
    ).toBe(true);
    expect(JSON.parse(String(services.usage.Usage[1][2])).tasks).toEqual([
      '=1+1',
    ]);
  });

  it('grows the Sheet grid under lock before appending past its last physical row', () => {
    const { gridRows, send, operations, usage } = setup();
    gridRows.Usage = 1;
    expect(send()).toHaveProperty('status', 'accepted');
    expect(usage.Usage).toHaveLength(2);
    expect(operations).toEqual([
      'lock',
      'grow:1:100',
      'format:@',
      'write:Usage',
      'flush',
      'unlock',
    ]);
  });

  it('AC-16.8: disabled by default, without opening Sheets or writing telemetry', () => {
    const { properties, send, openById, operations, log } = setup();
    delete properties.USAGE_LOGGING_ENABLED;
    expect(send()).toEqual({ error: { code: 'USAGE_DISABLED' } });
    expect(openById).not.toHaveBeenCalled();
    expect(operations).toEqual([]);
    expect(log).not.toHaveBeenCalled();
  });

  it.each([
    'USAGE_RETENTION_DAYS',
    'USAGE_MAX_PER_MINUTE',
    'USAGE_MAX_PER_DAY',
    'USAGE_MAX_ROWS',
  ])('fails closed when %s is missing', (key) => {
    const { properties, send, openById } = setup();
    delete properties[key];
    expect(send()).toEqual({ error: { code: 'USAGE_INVALID_CONFIG' } });
    expect(openById).not.toHaveBeenCalled();
  });

  it('does not create tables on public requests or use an implicit spreadsheet', () => {
    const { properties, usage, send, openById } = setup();
    delete properties.USAGE_SPREADSHEET_ID;
    expect(send()).toEqual({ error: { code: 'USAGE_UNAVAILABLE' } });
    expect(openById).not.toHaveBeenCalled();
    properties.USAGE_SPREADSHEET_ID = 'fixture-usage-book';
    delete usage.Usage;
    expect(send()).toEqual({ error: { code: 'USAGE_UNAVAILABLE' } });
    expect(usage.Usage).toBeUndefined();
  });

  it.each(['header', 'timestamp', 'too-many-rows'])(
    'fails closed on corrupt or oversized log metadata: %s',
    (kind) => {
      const { usage, send, operations } = setup();
      if (kind === 'header') usage.Usage[0][0] = 'wrong';
      if (kind === 'timestamp')
        usage.Usage.push([searchEvent.eventId, 'bad', '{}']);
      if (kind === 'too-many-rows') usage.Usage.length = MAX_USAGE_ROWS + 2;
      expect(send()).toEqual({ error: { code: 'USAGE_UNAVAILABLE' } });
      expect(operations).toEqual(['lock', 'unlock']);
    },
  );

  it('records fixed drop outcomes without echoing the request or service errors', () => {
    const { send, log, openById } = setup();
    send({ ...searchEvent, goal: 'synthetic private input' });
    openById.mockImplementation(() => {
      throw new Error('synthetic private cell');
    });
    send();
    expect(log.mock.calls).toEqual([
      ['usage-post', '{"error":{"code":"USAGE_INVALID_EVENT"}}'],
      ['usage-post', '{"error":{"code":"USAGE_UNAVAILABLE"}}'],
    ]);
  });

  it('a retry after a flush error does not append a second row', () => {
    const { send, flush, usage, operations } = setup();
    flush.mockImplementationOnce(() => {
      throw new Error('uncertain write');
    });
    expect(send()).toEqual({ error: { code: 'USAGE_UNAVAILABLE' } });
    expect(send()).toEqual({ ok: true, status: 'duplicate' });
    expect(usage.Usage).toHaveLength(2);
    expect(operations.at(-1)).toBe('unlock');
  });

  it('initializes only an empty Usage tab and refuses to overwrite existing data', () => {
    const { usage, properties } = setup();
    properties.USAGE_LOGGING_ENABLED = 'false';
    delete usage.Usage;
    initializeUsageLog();
    expect(usage.Usage).toEqual([usageHeaders]);
    initializeUsageLog();
    expect(usage.Usage).toEqual([usageHeaders]);
    usage.Usage = [['Existing content']];
    expect(() => initializeUsageLog()).toThrow('Usage initialization failed');
    expect(usage.Usage).toEqual([['Existing content']]);
  });

  it('AC-16.8: purges expired rows in groups even while logging is disabled', () => {
    const { usage, properties, operations } = setup();
    properties.USAGE_LOGGING_ENABLED = 'false';
    delete properties.USAGE_MAX_PER_DAY;
    usage.Usage.push(
      [searchEvent.eventId, '2026-09-20T11:00:00Z', '{}'],
      [searchEvent.sessionId, '2026-09-20T12:00:00Z', '{}'],
      [impressionEvent.eventId, searchEvent.time, '{}'],
      [searchEvent.searchId, '2026-09-01T12:00:00Z', '{}'],
    );
    expect(purgeUsageLog()).toEqual({ deleted: 3 });
    expect(usage.Usage).toEqual([
      usageHeaders,
      [impressionEvent.eventId, searchEvent.time, '{}'],
    ]);
    expect(operations).toEqual([
      'lock',
      'delete:5:1',
      'delete:2:2',
      'flush',
      'unlock',
    ]);
  });

  it('does not purge when the retention policy or timestamp is invalid', () => {
    const { properties, usage, operations } = setup();
    properties.USAGE_RETENTION_DAYS = '0';
    expect(() => purgeUsageLog()).toThrow('Usage purge failed');
    expect(operations).toEqual([]);
    properties.USAGE_RETENTION_DAYS = '30';
    usage.Usage.push([searchEvent.eventId, 'bad', '{}']);
    expect(() => purgeUsageLog()).toThrow('Usage purge failed');
    expect(usage.Usage).toHaveLength(2);
    expect(operations).toEqual(['lock', 'unlock']);
  });

  it('public GET excludes usage data and POST cannot dispatch maintenance functions', () => {
    const { send, usage } = setup();
    const before = JSON.parse(doGet().getContent());
    send();
    expect(send({ action: 'purgeUsageLog' })).toHaveProperty('error');
    expect(JSON.parse(doGet().getContent())).toEqual(before);
    expect(usage.Usage).toHaveLength(2);
    expect(JSON.stringify(before)).not.toContain(searchEvent.eventId);
  });
});
