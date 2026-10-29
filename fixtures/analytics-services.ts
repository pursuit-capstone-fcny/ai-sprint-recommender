import { createHash } from 'node:crypto';
import { vi } from 'vitest';
import publicCatalog from './public-catalog.json';
import { searchEvent } from './usage-events';
import { headers } from '../apps-script/catalog';
import { usageHeaders } from '../apps-script/usage-sheet';

export function analyticsServices() {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(searchEvent.time));
  const properties: Record<string, string> = {
    ANALYTICS_ENABLED: 'true',
    ANALYTICS_ACCESS_APPROVED: 'true',
    ANALYTICS_OWNER: 'Fixture reporting owner',
    ANALYTICS_SPREADSHEET_ID: 'fixture-report',
    CATALOG_SPREADSHEET_ID: 'fixture-catalog',
    USAGE_SPREADSHEET_ID: 'fixture-usage',
    ANALYTICS_ENVIRONMENT: 'test',
    USAGE_ENVIRONMENT: 'test',
    USAGE_RETENTION_DAYS: '30',
    CATALOG_PUBLIC_ENABLED: 'true',
    USAGE_LOGGING_ENABLED: 'true',
    USAGE_MAX_PER_MINUTE: '100',
    USAGE_MAX_PER_DAY: '1000',
    USAGE_MAX_ROWS: '1000',
  };
  const data: Record<string, Record<string, unknown[][]>> = {
    'fixture-report': {},
    'fixture-usage': { Usage: [[...usageHeaders]] },
    'fixture-catalog': {
      Catalog: [
        [...headers.Catalog],
        ...publicCatalog.items.map((item) =>
          headers.Catalog.map((header) =>
            Array.isArray(item[header]) ? item[header].join(',') : item[header],
          ),
        ),
      ],
      Dictionary: [
        [...headers.Dictionary],
        ...publicCatalog.functionAreas.map((tag) => ['functionArea', tag]),
        ...publicCatalog.tools.map((tag) => ['tool', tag]),
        ...publicCatalog.tasks.map((tag) => ['task', tag]),
      ],
      Synonyms: [
        [...headers.Synonyms],
        ...publicCatalog.synonyms.map((s) => [s.alias, s.category, s.target]),
      ],
      'Adjacent tools': [
        [...headers['Adjacent tools']],
        ...publicCatalog.adjacentTools.map((a) => [
          a.source,
          a.related,
          a.task,
        ]),
      ],
    },
  };
  const ops: string[] = [];
  let lockAvailable = true;
  const sheets = new Map<string, ReturnType<typeof sheet>>();
  function sheet(book: string, name: string) {
    const identity = `${book}/${name}`;
    let maxRows = 1000,
      maxColumns = 26;
    const api = {
      getSheetId: () => Object.keys(data[book]).indexOf(name),
      getName: () => name,
      getLastRow: () => data[book][name].length,
      getLastColumn: () =>
        Math.max(0, ...data[book][name].map((row) => row.length)),
      getMaxRows: () => maxRows,
      getMaxColumns: () => maxColumns,
      insertRowsAfter: (_row: number, count: number) => {
        maxRows += count;
      },
      insertColumnsAfter: (_col: number, count: number) => {
        maxColumns += count;
      },
      setFrozenRows: () => api,
      clearContents: () => {
        ops.push(`clear:${identity}`);
        data[book][name] = [];
        return api;
      },
      getDataRange: () => ({
        getValues: () => data[book][name].map((row) => [...row]),
      }),
      getRange: (row: number, col: number, height: number, width: number) => {
        const range = {
          getValues: () =>
            Array.from({ length: height }, (_, n) =>
              Array.from(
                { length: width },
                (_, i) => data[book][name][row + n - 1]?.[col + i - 1] ?? '',
              ),
            ),
          setNumberFormat: () => range,
          setValues: (values: unknown[][]) => {
            ops.push(`write:${identity}`);
            values.forEach((values, n) =>
              values.forEach((value, i) => {
                data[book][name][row + n - 1] ??= [];
                data[book][name][row + n - 1][col + i - 1] = value;
              }),
            );
            return range;
          },
        };
        return range;
      },
    };
    return api;
  }
  const openById = vi.fn((id: string) => {
    if (!data[id]) throw new Error('Unknown fixture workbook');
    const book = {
      getId: () => id,
      getSheetByName: (name: string) => {
        if (!data[id][name]) return null;
        const key = `${id}/${name}`;
        if (!sheets.has(key)) sheets.set(key, sheet(id, name));
        return sheets.get(key)!;
      },
      insertSheet: (name: string) => {
        data[id][name] = [];
        return book.getSheetByName(name)!;
      },
      getSpreadsheetTimeZone: () => 'America/New_York',
    };
    return book;
  });
  vi.stubGlobal('PropertiesService', {
    getScriptProperties: () => ({
      getProperty: (name: string) => properties[name] ?? null,
      setProperty: (name: string, value: string) => {
        properties[name] = value;
      },
    }),
  });
  const flush = vi.fn(() => {
    ops.push('flush');
  });
  vi.stubGlobal('SpreadsheetApp', { openById, flush });
  vi.stubGlobal('LockService', {
    getScriptLock: () => ({
      tryLock: () => {
        ops.push('lock');
        return lockAvailable;
      },
      releaseLock: () => {
        ops.push('unlock');
      },
    }),
  });
  let generation = 0;
  vi.stubGlobal('Utilities', {
    getUuid: () => `fixture-generation-${++generation}`,
    DigestAlgorithm: { SHA_256: 'sha256' },
    Charset: { UTF_8: 'utf8' },
    computeDigest: (_algorithm: string, value: string) =>
      Array.from(createHash('sha256').update(value).digest()),
    formatDate: (date: Date) =>
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(date),
  });
  vi.stubGlobal('ContentService', {
    MimeType: { JSON: 'application/json' },
    createTextOutput: (text: string) => ({
      setMimeType: () => ({ getContent: () => text }),
    }),
  });
  const triggers: string[] = [];
  const triggerSources: (string | null)[] = [];
  vi.stubGlobal('ScriptApp', {
    getProjectTriggers: () =>
      triggers.map((name, index) => ({
        getHandlerFunction: () => name,
        getTriggerSourceId: () => triggerSources[index],
        getUniqueId: () => String(index),
      })),
    deleteTrigger: (trigger: { getUniqueId: () => string }) => {
      const index = Number(trigger.getUniqueId());
      triggers.splice(index, 1);
      triggerSources.splice(index, 1);
    },
    newTrigger: (name: string) => {
      let targetId: string | null = null;
      const builder = {
        timeBased: () => builder,
        everyDays: () => builder,
        atHour: () => builder,
        inTimezone: () => builder,
        forSpreadsheet: (id: string) => {
          targetId = id;
          return builder;
        },
        onEdit: () => builder,
        create: () => {
          triggers.push(name);
          triggerSources.push(targetId);
        },
      };
      return builder;
    },
  });
  return {
    properties,
    data,
    ops,
    openById,
    flush,
    triggers,
    triggerSources,
    setLock: (value: boolean) => {
      lockAvailable = value;
    },
  };
}
