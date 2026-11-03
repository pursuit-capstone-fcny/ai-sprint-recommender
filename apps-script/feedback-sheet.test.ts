import { afterEach, describe, expect, it, vi } from 'vitest';
import { refreshFeedbackReport } from './index';
import { impressionEvent } from '../fixtures/usage-events';
import { receiveUsage, type UsagePorts } from './usage';
import { parsePublicCatalog } from '../src/contracts/publicCatalog';
import fixture from '../fixtures/public-catalog.json';

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
  return { data, properties, openById };
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('feedback Sheet adapter', () => {
  it('keeps feedback reporting available with a mixed burst log above 10,000 events', () => {
    const { data } = setup();
    const time = new Date().toISOString();
    const up = {
      ...impressionEvent,
      time,
      type: 'feedback',
      schemaVersion: 2,
      helpful: true,
      voteRevision: 1,
    };
    const down = {
      ...up,
      eventId: crypto.randomUUID(),
      helpful: false,
      voteRevision: 2,
    };
    const impressions = Array.from({ length: 10_001 }, () => ({
      ...impressionEvent,
      time,
      eventId: crypto.randomUUID(),
    }));
    data.usage.Usage = [
      ['eventId', 'receivedAt', 'eventJson'],
      ...[...impressions, up, down].map((event) => [
        event.eventId,
        time,
        JSON.stringify(event),
      ]),
    ];
    data.feedback.Feedback = [['previous report']];
    refreshFeedbackReport();
    expect(data.feedback.Feedback).toEqual([
      ['youtubeId', 'helpful', 'notHelpful', 'responses', 'helpfulRate'],
      [up.youtubeId, 0, 1, 1, 0],
    ]);
  });
  it('AC-29.2/3: collector gates feedback independently and accepts retries through the append-only event contract', () => {
    setup();
    const event = {
      ...impressionEvent,
      type: 'feedback',
      schemaVersion: 2,
      helpful: true,
      voteRevision: 1,
      time: new Date().toISOString(),
    };
    const records: { eventId: string; receivedAt: string }[] = [];
    const ports: UsagePorts = {
      enabled: true,
      now: () => new Date(),
      lock: { tryLock: () => true, releaseLock: vi.fn() },
      policy: () => ({
        retentionDays: 7,
        maxPerMinute: 10,
        maxPerDay: 200,
        maxRows: 1000,
        recommendationVersions: [],
      }),
      catalog: () => parsePublicCatalog(fixture),
      records: () => records,
      append: (e, receivedAt) => {
        records.push({ eventId: e.eventId, receivedAt });
      },
    };
    const receive = () =>
      JSON.parse(
        receiveUsage(
          { type: 'text/plain', contents: JSON.stringify(event) },
          ports,
        ),
      );
    expect(receive().error.code).toBe('FEEDBACK_DISABLED');
    ports.feedbackEnabled = true;
    expect(receive()).toEqual({ ok: true, status: 'accepted' });
    expect(receive()).toEqual({ ok: true, status: 'duplicate' });
    expect(records).toHaveLength(1);
  });
  it.each([undefined, 'invalid', '0', '366'])(
    'AC-29.4: invalid retention %s clears stale report output',
    (days) => {
      const { data, properties, openById } = setup();
      data.feedback.Feedback = [['stale aggregate']];
      if (days === undefined) delete properties.USAGE_RETENTION_DAYS;
      else properties.USAGE_RETENTION_DAYS = days;
      expect(() => refreshFeedbackReport()).toThrow();
      expect(data.feedback.Feedback).toEqual([]);
      expect(openById.mock.calls.map(([id]) => id)).toEqual(['feedback']);
    },
  );
  it('AC-29.4: writes only retained aggregate feedback to the restricted report and clears it on failure', () => {
    const { data, properties } = setup();
    const up = {
      ...impressionEvent,
      type: 'feedback',
      schemaVersion: 2,
      helpful: true,
      voteRevision: 1,
      time: new Date().toISOString(),
    };
    const down = {
      ...up,
      eventId: crypto.randomUUID(),
      helpful: false,
      voteRevision: 2,
    };
    const expired = {
      ...up,
      eventId: crypto.randomUUID(),
      sessionId: crypto.randomUUID(),
    };
    data.usage.Usage = [
      ['eventId', 'receivedAt', 'eventJson'],
      ...[down, up].map((e) => [e.eventId, e.time, JSON.stringify(e)]),
      [expired.eventId, '2026-10-20T12:00:00.000Z', JSON.stringify(expired)],
    ];
    refreshFeedbackReport();
    expect(data.feedback.Feedback).toEqual([
      ['youtubeId', 'helpful', 'notHelpful', 'responses', 'helpfulRate'],
      [up.youtubeId, 0, 1, 1, 0],
    ]);
    data.usage.Usage[1][2] = 'invalid';
    expect(() => refreshFeedbackReport()).toThrow(/Feedback refresh failed/);
    expect(data.feedback.Feedback).toEqual([]);
    properties.FEEDBACK_REPORT_ACCESS_APPROVED = 'false';
    expect(() => refreshFeedbackReport()).toThrow(/not approved/);
  });
});
