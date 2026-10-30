import { afterEach, describe, expect, it, vi } from 'vitest';
import { doGet, doPost, initializeRequests, purgeRequests } from './index';
import { contributionHeaders } from './contributions';

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
    CATALOG_SPREADSHEET_ID: 'catalog',
    USAGE_SPREADSHEET_ID: 'usage',
    ANALYTICS_SPREADSHEET_ID: 'analytics',
    FEEDBACK_REPORT_SPREADSHEET_ID: 'feedback',
    FEEDBACK_REPORT_ACCESS_APPROVED: 'true',
    USAGE_RETENTION_DAYS: '7',
  };
  const data: Record<string, Record<string, unknown[][]>> = {
    review: {},
    usage: {},
    feedback: {},
  };
  const openById = vi.fn((id: string) => {
    const book = data[id];
    if (!book) throw new Error('Unexpected workbook');
    const sheet = (name: string) => ({
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
    };
  });
  vi.stubGlobal('PropertiesService', {
    getScriptProperties: () => ({
      getProperty: (name: string) => properties[name] ?? null,
    }),
  });
  vi.stubGlobal('LockService', {
    getScriptLock: () => ({ tryLock: () => true, releaseLock: vi.fn() }),
  });
  vi.stubGlobal('ContentService', {
    MimeType: { JSON: 'json' },
    createTextOutput: (body: string) => ({ setMimeType: () => body }),
  });
  vi.stubGlobal('SpreadsheetApp', {
    openById,
    getActiveSpreadsheet: () => ({ getId: () => 'catalog' }),
    flush: vi.fn(),
    newDataValidation: () => ({
      requireValueInList: () => ({
        setAllowInvalid: () => ({ build: () => ({}) }),
      }),
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
  return { data, properties, entry, send, openById };
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('request Sheet adapter', () => {
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
  it('rejects any configured catalog/usage/report destination before writing request text', () => {
    const { properties, send, openById } = setup();
    for (const id of ['catalog', 'usage', 'analytics', 'feedback']) {
      properties.REQUESTS_SPREADSHEET_ID = id;
      expect(send()).toEqual({ error: { code: 'REQUESTS_UNAVAILABLE' } });
    }
    expect(openById).not.toHaveBeenCalled();
  });
});
