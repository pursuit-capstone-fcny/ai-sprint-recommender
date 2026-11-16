import { afterEach, describe, expect, it, vi } from 'vitest';
import * as collector from './index';
import { contributionHeaders } from './contributions';

const { doGet, doPost, initializeRequests, purgeRequests } = collector;

function setup() {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-30T12:00:00Z'));
  const policy = {
    version: 'fictional-v1',
    topicPrompt: 'Fictional topic?',
    demoInvitation: 'Fictional demo?',
    purpose: 'Fictional review',
    access: 'Approved reviewers',
    owner: 'Fictional owner',
    retentionDays: 7,
    demoOffers: true,
  };
  const properties: Record<string, string> = {
    REQUESTS_ENABLED: 'true',
    REQUESTS_ACCESS_APPROVED: 'true',
    REQUESTS_SPREADSHEET_ID: 'review',
    REQUESTS_POLICY: JSON.stringify(policy),
    CATALOG_SPREADSHEET_ID: 'fixture-catalog',
    USAGE_SPREADSHEET_ID: 'usage',
    ANALYTICS_SPREADSHEET_ID: 'analytics',
    FEEDBACK_REPORT_SPREADSHEET_ID: 'feedback',
    FEEDBACK_REPORT_ACCESS_APPROVED: 'true',
    USAGE_RETENTION_DAYS: '7',
    LIBRARY_SOURCE_SHEET_URL:
      'https://docs.google.com/spreadsheets/d/fixture-catalog/edit',
  };
  const data: Record<string, Record<string, unknown[][]>> = {
    review: {},
    'fixture-catalog': {
      'Video Tracker': [['Existing catalog']],
      Usage: [['Existing usage']],
    },
    usage: {},
    feedback: {},
  };
  const createTrigger = vi.fn();
  const flush = vi.fn();
  const setProperty = vi.fn((name: string, value: string) => {
    properties[name] = value;
  });
  const openById = vi.fn((id: string) => {
    const book = data[id];
    if (!book) throw new Error('Unexpected workbook');
    const sheet = (name: string) => ({
      getName: () => name,
      copyTo: (target: { insertSheet: (name: string) => unknown }) => {
        const copy = target.insertSheet('Copy of Requests');
        const rows = data['fixture-catalog']['Copy of Requests'];
        rows.push(...book[name].map((row) => [...row]));
        return copy;
      },
      setName: (next: string) => {
        book[next] = book[name];
        delete book[name];
        name = next;
      },
      setColumnWidth: vi.fn(),
      setColumnWidths: vi.fn(),
      getLastRow: () => book[name].length,
      getLastColumn: () => book[name][0]?.length ?? 0,
      getMaxRows: () => 1000,
      insertRowsAfter: vi.fn(),
      setFrozenRows: vi.fn(),
      clearContents: () => {
        book[name] = [];
      },
      deleteRow: (row: number) => {
        book[name].splice(row - 1, 1);
      },
      getRange: (row: number, col: number, count: number, width: number) => {
        const range = {
          getValues: () =>
            book[name]
              .slice(row - 1, row - 1 + count)
              .map((r) => r.slice(col - 1, col - 1 + width)),
          setValues: (values: unknown[][]) => {
            values.forEach((v, i) => {
              book[name][row - 1 + i] = v;
            });
            return range;
          },
          setNumberFormat: () => range,
          setDataValidation: () => range,
          setFontWeight: () => range,
          setWrap: () => range,
        };
        return range;
      },
    });
    return {
      getSheetByName: (name: string) => (name in book ? sheet(name) : null),
      insertSheet: (name: string) => {
        book[name] = [];
        return sheet(name);
      },
      deleteSheet: (sheet: { getName: () => string }) => {
        delete book[sheet.getName()];
      },
    };
  });
  vi.stubGlobal('PropertiesService', {
    getScriptProperties: () => ({
      getProperty: (name: string) => properties[name] ?? null,
      setProperty,
    }),
  });
  vi.stubGlobal('LockService', {
    getScriptLock: () => ({ tryLock: () => true, releaseLock: vi.fn() }),
  });
  vi.stubGlobal('ContentService', {
    MimeType: { JSON: 'json' },
    createTextOutput: (body: string) => ({ setMimeType: () => body }),
  });
  const sharing: Record<string, string> = {
    'fixture-catalog': 'PRIVATE',
    review: 'PRIVATE',
  };
  vi.stubGlobal('DriveApp', {
    Access: { PRIVATE: 'PRIVATE' },
    getFileById: (id: string) => ({ getSharingAccess: () => sharing[id] }),
  });
  vi.stubGlobal('SpreadsheetApp', {
    openById,
    getActiveSpreadsheet: () => ({ getId: () => 'fixture-catalog' }),
    flush,
    newDataValidation: () => ({
      requireValueInList: () => ({
        setAllowInvalid: () => ({ build: () => ({}) }),
      }),
    }),
  });
  vi.stubGlobal('ScriptApp', {
    getProjectTriggers: () => [],
    newTrigger: () => ({
      timeBased: () => ({ everyHours: () => ({ create: createTrigger }) }),
    }),
  });
  const entry = {
    schemaVersion: 1,
    type: 'contribution',
    requestId: crypto.randomUUID(),
    time: new Date().toISOString(),
    policyVersion: policy.version,
    kind: 'demo',
    topic: '=FICTIONAL_FORMULA()',
    email: 'fictional@example.org',
    consent: true,
  };
  const send = (changes = {}) =>
    JSON.parse(
      String(
        doPost({
          postData: {
            type: 'text/plain',
            contents: JSON.stringify({ ...entry, ...changes }),
          },
        }),
      ),
    );
  return {
    data,
    properties,
    entry,
    send,
    openById,
    sharing,
    createTrigger,
    flush,
    setProperty,
  };
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('request Sheet adapter', () => {
  it('leaves both queues intact when the library already has different rows', () => {
    const { data, properties, send, createTrigger } = setup();
    properties.USAGE_SPREADSHEET_ID = 'fixture-catalog';
    initializeRequests();
    expect(send()).toEqual({ ok: true, status: 'accepted' });
    const legacy = structuredClone(data.review.Requests);
    data['fixture-catalog'].Requests = [[...contributionHeaders]];

    expect(() => collector.migrateRequestsToLibrary()).toThrow('Queues differ');
    expect(properties.REQUESTS_SPREADSHEET_ID).toBe('review');
    expect(data.review.Requests).toEqual(legacy);
    expect(data['fixture-catalog'].Requests).toEqual([contributionHeaders]);
    expect(createTrigger).not.toHaveBeenCalled();
  });

  it.each(['setup', 'retention', 'destination write'] as const)(
    'keeps the legacy inbox writable after %s fails and copies new arrivals on retry',
    (failure) => {
      const { data, properties, send, createTrigger, flush, setProperty } =
        setup();
      properties.USAGE_SPREADSHEET_ID = 'fixture-catalog';
      initializeRequests();
      expect(send()).toEqual({ ok: true, status: 'accepted' });
      data.review.Requests[1][2] = 'reviewing';
      const failingStep = {
        setup: flush,
        retention: createTrigger,
        'destination write': setProperty,
      }[failure];
      failingStep.mockImplementationOnce(() => {
        expect(properties.REQUESTS_SPREADSHEET_ID).toBe('review');
        throw new Error('Fictional setup failure');
      });

      expect(() => collector.migrateRequestsToLibrary()).toThrow(
        failure === 'setup'
          ? 'Request initialization failed'
          : 'Fictional setup failure',
      );
      expect(properties.REQUESTS_SPREADSHEET_ID).toBe('review');
      expect(data['fixture-catalog'].Requests).toBeUndefined();
      expect(send({ requestId: crypto.randomUUID() })).toEqual({
        ok: true,
        status: 'accepted',
      });

      createTrigger.mockImplementationOnce(() => {
        expect(properties.REQUESTS_SPREADSHEET_ID).toBe('review');
      });
      expect(collector.migrateRequestsToLibrary()).toEqual({
        retainedRequests: 2,
        retentionDays: 7,
      });
      expect(properties.REQUESTS_SPREADSHEET_ID).toBe('fixture-catalog');
      expect(data['fixture-catalog'].Requests).toEqual(data.review.Requests);
      expect(send()).toEqual({ ok: true, status: 'duplicate' });
      expect(send({ requestId: crypto.randomUUID() })).toEqual({
        ok: true,
        status: 'accepted',
      });
      expect(data['fixture-catalog'].Requests).toHaveLength(4);
      expect(data.review.Requests).toHaveLength(3);
    },
  );
  it('preserves the active tab if the destination write commits before reporting an error', () => {
    const { data, properties, send, setProperty } = setup();
    properties.USAGE_SPREADSHEET_ID = 'fixture-catalog';
    initializeRequests();
    expect(send()).toEqual({ ok: true, status: 'accepted' });
    setProperty.mockImplementationOnce((name, value) => {
      properties[name] = value;
      throw new Error('Fictional destination acknowledgement failure');
    });

    expect(collector.migrateRequestsToLibrary()).toEqual({
      retainedRequests: 1,
      retentionDays: 7,
    });
    expect(properties.REQUESTS_SPREADSHEET_ID).toBe('fixture-catalog');
    expect(data['fixture-catalog'].Requests).toEqual(data.review.Requests);
    expect(send({ requestId: crypto.randomUUID() })).toEqual({
      ok: true,
      status: 'accepted',
    });
    expect(data['fixture-catalog'].Requests).toHaveLength(3);
    expect(data.review.Requests).toHaveLength(2);
  });
  it('AC-26.2/4/7: writes requests only to staff review, escapes formulas, preserves statuses and purges contacts', () => {
    const { data, send, openById } = setup();
    initializeRequests();
    expect(data.review.Requests).toEqual([contributionHeaders]);
    expect(send()).toEqual({ ok: true, status: 'accepted' });
    const row = data.review.Requests[1];
    expect(row.slice(2)).toEqual([
      'new',
      'demo',
      "'=FICTIONAL_FORMULA()",
      'fictional@example.org',
      'fictional-v1',
    ]);
    row[2] = 'duplicate';
    expect(send()).toEqual({ ok: true, status: 'duplicate' });
    expect(row[2]).toBe('duplicate');
    expect(data.usage).toEqual({});
    expect(openById.mock.calls.every(([id]) => id === 'review')).toBe(true);
    expect(String(doGet())).not.toContain('fictional@example.org');
    vi.setSystemTime(new Date('2026-11-07T12:00:00Z'));
    expect(purgeRequests()).toEqual({ deleted: 1 });
    expect(data.review.Requests).toEqual([contributionHeaders]);
  });
  it('AC-26.2: stores topics and consented demos in the source Requests tab without changing catalog or usage', () => {
    const { data, properties, send } = setup();
    properties.REQUESTS_SPREADSHEET_ID = 'fixture-catalog';
    properties.USAGE_SPREADSHEET_ID = 'fixture-catalog';
    initializeRequests();
    expect(
      send({
        kind: 'topic',
        requestId: crypto.randomUUID(),
        topic: 'Fictional topic request',
        email: undefined,
        consent: undefined,
      }),
    ).toEqual({ ok: true, status: 'accepted' });
    expect(send()).toEqual({ ok: true, status: 'accepted' });
    expect(data['fixture-catalog'].Requests[1].slice(2)).toEqual([
      'new',
      'topic',
      'Fictional topic request',
      '',
      'fictional-v1',
    ]);
    expect(data['fixture-catalog'].Requests[2][3]).toBe('demo');
    expect(data['fixture-catalog']['Video Tracker']).toEqual([
      ['Existing catalog'],
    ]);
    expect(data['fixture-catalog'].Usage).toEqual([['Existing usage']]);
    expect(data.review).toEqual({});
    expect(send()).toEqual({ ok: true, status: 'duplicate' });
    expect(data['fixture-catalog'].Requests).toHaveLength(3);
    vi.setSystemTime(new Date('2026-11-07T12:00:00Z'));
    expect(purgeRequests()).toEqual({ deleted: 2 });
    expect(data['fixture-catalog'].Requests).toEqual([contributionHeaders]);
    expect(data['fixture-catalog'].Usage).toEqual([['Existing usage']]);
  });
  it('rejects publicly shared request destinations at initialization, submission and cleanup', () => {
    const { properties, sharing, send, openById } = setup();
    for (const id of ['review', 'fixture-catalog']) {
      properties.REQUESTS_SPREADSHEET_ID = id;
      sharing[id] = 'ANYONE_WITH_LINK';
      expect(() => initializeRequests()).toThrow('Restricted');
      expect(send()).toEqual({ error: { code: 'REQUESTS_UNAVAILABLE' } });
      expect(() => purgeRequests()).toThrow('Restricted');
    }
    expect(openById).not.toHaveBeenCalled();
  });
  it('defaults to the configured library and stops writes if its sharing later changes', () => {
    const { data, properties, sharing, send } = setup();
    delete properties.REQUESTS_SPREADSHEET_ID;
    initializeRequests();
    expect(send({ consent: false })).toEqual({
      error: { code: 'REQUESTS_INVALID' },
    });
    expect(data['fixture-catalog'].Requests).toHaveLength(1);
    expect(send()).toEqual({ ok: true, status: 'accepted' });
    sharing['fixture-catalog'] = 'ANYONE_WITH_LINK';
    expect(send({ requestId: crypto.randomUUID() })).toEqual({
      error: { code: 'REQUESTS_UNAVAILABLE' },
    });
    expect(() => purgeRequests()).toThrow('Restricted');
    expect(data['fixture-catalog'].Requests).toHaveLength(2);
  });
  it('rejects unrelated catalog/usage/report destinations before writing request text', () => {
    const { properties, send, openById } = setup();
    properties.LIBRARY_SOURCE_SHEET_URL =
      'https://docs.google.com/spreadsheets/d/different-source/edit';
    for (const id of ['fixture-catalog', 'usage', 'analytics', 'feedback']) {
      properties.REQUESTS_SPREADSHEET_ID = id;
      expect(send()).toEqual({ error: { code: 'REQUESTS_UNAVAILABLE' } });
    }
    expect(openById).not.toHaveBeenCalled();
  });
});
