import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyticsServices } from '../fixtures/analytics-services';
import { impressionEvent, searchEvent } from '../fixtures/usage-events';
import {
  doGet,
  doPost,
  clearAnalytics,
  initializeAnalytics,
  refreshAnalytics,
  installAnalyticsTriggers,
  analyticsReportLinks,
} from './index';
import { readAnalyticsRecords, literalCell } from './analytics-sheet';
import { readAnalyticsSnapshots, SNAPSHOT_TABLE } from './analytics-snapshots';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
function initialized() {
  const service = analyticsServices();
  initializeAnalytics();
  return service;
}
function status(data: ReturnType<typeof analyticsServices>['data']) {
  return Object.fromEntries(
    data['fixture-report']['Analytics status'].slice(1),
  );
}
function send(value: unknown) {
  return JSON.parse(
    doPost({
      postData: { type: 'text/plain', contents: JSON.stringify(value) },
    }).getContent(),
  );
}

describe('private analytics reporting adapter', () => {
  it.each([
    'Analytics facts',
    'Analytics videos',
    'Analytics tags',
    'Analytics associations',
    'Analytics status',
  ])('isolates cleanup failure in a damaged %s table', (damaged) => {
    const { data } = initialized();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    send(searchEvent);
    send({
      ...impressionEvent,
      mode: 'recommendations',
      recommendationEngine: 'rules',
      llmFallbackReason: 'not-requested',
    });
    refreshAnalytics();
    const output = data['fixture-report'];
    const source = JSON.stringify(data['fixture-usage']);
    output[damaged][0][0] = 'Damaged header';
    const preserved = JSON.stringify(output[damaged]);
    expect(() => refreshAnalytics()).toThrow('Analytics refresh failed');
    expect(JSON.stringify(output[damaged])).toBe(preserved);
    for (const name of [
      'Analytics facts',
      'Analytics videos',
      'Analytics tags',
      'Analytics associations',
    ]) {
      if (name !== damaged) expect(output[name]).toHaveLength(1);
    }
    if (damaged !== 'Analytics status')
      expect(status(data).state).toBe('error');
    expect(JSON.stringify(data['fixture-usage'])).toBe(source);
  });

  it('replaces obsolete edit triggers after the owner changes the reporting workbook', () => {
    const { data, properties, triggers, triggerSources } = initialized();
    installAnalyticsTriggers();
    data['fixture-new-report'] = {};
    properties.ANALYTICS_SPREADSHEET_ID = 'fixture-new-report';
    initializeAnalytics();
    installAnalyticsTriggers();
    installAnalyticsTriggers();
    expect(triggers).toEqual(['refreshAnalytics', 'refreshAnalyticsOnEdit']);
    expect(triggerSources).toEqual([null, 'fixture-new-report']);
  });

  it('prunes old unreferenced snapshots and preserves large public catalogs across JSON chunks', () => {
    const { data, openById } = initialized();
    data['fixture-catalog'].Catalog[1][2] =
      'Fictional public metadata. '.repeat(1000);
    const current = JSON.parse(doGet().getContent());
    refreshAnalytics();
    const sheet = openById('fixture-usage').getSheetByName(SNAPSHOT_TABLE)!;
    const snapshots = readAnalyticsSnapshots(
      sheet as unknown as GoogleAppsScript.Spreadsheet.Sheet,
    );
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toEqual(current);
    expect(data['fixture-usage'][SNAPSHOT_TABLE].length).toBeGreaterThan(2);
  });

  it('snapshot failure does not block accepted usage or leak raw service errors', () => {
    const { data } = initialized();
    const log = vi.spyOn(console, 'info').mockImplementation(() => {});
    data['fixture-usage'][SNAPSHOT_TABLE][0][0] = 'Unexpected header';
    expect(send(searchEvent)).toHaveProperty('status', 'accepted');
    expect(data['fixture-usage'].Usage).toHaveLength(2);
    expect(log.mock.calls).toContainEqual([
      'analytics-snapshot',
      'unavailable',
    ]);
  });

  it('publishes unfiltered daily facts independently of shared Sheet controls', () => {
    const { data } = initialized();
    send(impressionEvent);
    data['fixture-report']['Analytics filters'].find(
      (row) => row[0] === 'source',
    )![1] = 'email';
    refreshAnalytics();
    expect(
      data['fixture-report']['Analytics videos']
        .slice(1)
        .every((row) => row[2] === 0),
    ).toBe(true);
    expect(status(data)).toMatchObject({
      state: 'ready',
      selectedEvents: 1,
      selectionState: 'empty',
    });
    const facts = data['fixture-report']['Analytics facts'];
    const fields = facts[0];
    const appearance = fields.indexOf('appearances');
    const source = fields.indexOf('source');
    expect(
      facts
        .slice(1)
        .some((row) => row[source] === 'website' && row[appearance] === 1),
    ).toBe(true);
  });

  it('clears aggregates after the stop switch without touching private source events', () => {
    const { data, properties } = initialized();
    send(impressionEvent);
    refreshAnalytics();
    const before = JSON.stringify(data['fixture-usage']);
    properties.ANALYTICS_ENABLED = 'false';
    clearAnalytics();
    expect(data['fixture-report']['Analytics facts']).toHaveLength(1);
    expect(data['fixture-report']['Analytics videos']).toHaveLength(1);
    expect(status(data).state).toBe('cleared');
    expect(JSON.stringify(data['fixture-usage'])).toBe(before);
  });

  it('rejects lock contention before reading data', () => {
    const { setLock, openById } = analyticsServices();
    setLock(false);
    expect(() => refreshAnalytics()).toThrow('Analytics busy');
    expect(openById).not.toHaveBeenCalled();
  });

  it('AC-24.1/.4/.8: initializes owned tables, publishes zero inventory, filter controls and visible status', () => {
    const { data, ops } = initialized();
    expect(refreshAnalytics()).toHaveProperty('state', 'empty');
    expect(data['fixture-report']['Analytics filters']).toHaveLength(10);
    expect(data['fixture-report']['Analytics videos']).toHaveLength(5);
    expect(
      data['fixture-report']['Analytics tags'].some(
        (row) => row[1] === 'Claude' && row[2] === 0 && row[8] === 0,
      ),
    ).toBe(true);
    expect(status(data)).toMatchObject({
      state: 'empty',
      environment: 'test',
      percentWatched: 'unavailable',
      includeTeam: true,
      selectionIncludeTeam: false,
    });
    expect(ops.at(-1)).toBe('unlock');
  });

  it('AC-24.2/.9/.10: refreshes actual accepted searches, impressions and clicks with only aggregates', () => {
    const { data } = initialized();
    const impression = {
      ...impressionEvent,
      mode: 'recommendations',
      recommendationEngine: 'rules',
      llmFallbackReason: 'not-requested',
    };
    expect(send(searchEvent)).toHaveProperty('status', 'accepted');
    expect(send(impression)).toHaveProperty('status', 'accepted');
    expect(
      send({
        ...impression,
        eventId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        type: 'click',
        target: 'embed',
      }),
    ).toHaveProperty('status', 'accepted');
    refreshAnalytics();
    expect(data['fixture-report']['Analytics videos'][1].slice(2, 5)).toEqual([
      1, 1, 0,
    ]);
    expect(data['fixture-report']['Analytics associations']).toHaveLength(4);
    const exported = JSON.stringify(data['fixture-report']);
    expect(exported).not.toContain(searchEvent.sessionId);
    expect(exported).not.toContain(searchEvent.eventId);
    expect(exported).not.toContain('eventJson');
    expect(status(data)).toHaveProperty('acceptedEvents', 3);
  });

  it('AC-24.4: changing controls recalculates unused content and validates malformed filters', () => {
    const { data } = initialized();
    send(impressionEvent);
    const control = data['fixture-report']['Analytics filters'];
    const activity = control.find((row) => row[0] === 'activity')!;
    activity[1] = 'zero-appearances';
    refreshAnalytics();
    expect(data['fixture-report']['Analytics videos']).toHaveLength(4);
    activity[1] = 'synthetic unknown filter';
    expect(() => refreshAnalytics()).toThrow('Analytics refresh failed');
    expect(data['fixture-report']['Analytics videos']).toHaveLength(1);
    expect(status(data)).toHaveProperty('state', 'error');
  });

  it('fails closed without approvals, explicit ownership, separate files and matching environments', () => {
    const { properties, openById } = analyticsServices();
    for (const [key, value] of [
      ['ANALYTICS_ENABLED', 'false'],
      ['ANALYTICS_ACCESS_APPROVED', 'false'],
      ['ANALYTICS_OWNER', ''],
      ['ANALYTICS_SPREADSHEET_ID', 'fixture-usage'],
      ['ANALYTICS_ENVIRONMENT', 'production'],
    ]) {
      const original = properties[key];
      properties[key] = value;
      expect(() => initializeAnalytics()).toThrow();
      expect(openById).not.toHaveBeenCalled();
      properties[key] = original;
    }
  });

  it('AC-24.3: saves public catalog snapshots at ingestion as metadata changes', () => {
    const { data, openById } = initialized();
    send(searchEvent);
    data['fixture-catalog'].Catalog[1][5] = 'budget tracking';
    const nextCatalog = JSON.parse(doGet().getContent());
    expect(
      send({
        ...searchEvent,
        eventId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        searchId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        catalogVersion: nextCatalog.catalogVersion,
      }),
    ).toHaveProperty('status', 'accepted');
    const sheet = openById('fixture-usage').getSheetByName(SNAPSHOT_TABLE)!;
    expect(
      readAnalyticsSnapshots(
        sheet as unknown as GoogleAppsScript.Spreadsheet.Sheet,
      ),
    ).toHaveLength(2);
    refreshAnalytics();
    expect(status(data)).toHaveProperty('unmappedEvents', 0);
  });

  it('AC-24.8: expired rows are excluded before parsing event bodies and snapshots are pruned', () => {
    const { data, openById } = initialized();
    data['fixture-usage'].Usage.push([
      'expired-fixture-id',
      '2026-09-01T00:00:00Z',
      'not an event',
    ]);
    const sheet = openById('fixture-usage').getSheetByName('Usage')!;
    expect(
      readAnalyticsRecords(
        sheet as unknown as GoogleAppsScript.Spreadsheet.Sheet,
        new Date(searchEvent.time),
        30,
      ),
    ).toEqual([]);
    refreshAnalytics();
    expect(status(data)).toHaveProperty('acceptedEvents', 0);
  });

  it('reports errors and clears stale aggregates without deleting the source log or echoing raw exceptions', () => {
    const { data, properties } = initialized();
    send(impressionEvent);
    refreshAnalytics();
    const source = JSON.stringify(data['fixture-usage'].Usage);
    data['fixture-usage'].Usage[1][2] = 'synthetic corrupt event';
    expect(() => refreshAnalytics()).toThrow(
      'Analytics refresh failed; inspect configuration and tables, not raw execution logs',
    );
    expect(data['fixture-report']['Analytics videos']).toHaveLength(1);
    expect(status(data)).toMatchObject({
      state: 'error',
      lastSuccessAt: properties.ANALYTICS_LAST_SUCCESS_AT,
    });
    expect(JSON.stringify(data['fixture-report'])).not.toContain(
      'synthetic corrupt event',
    );
    expect(JSON.stringify(data['fixture-usage'].Usage)).not.toBe(source);
    expect(data['fixture-usage'].Usage).toHaveLength(2);
  });

  it('does not overwrite unrelated tables and releases the lock on failure', () => {
    const { data, ops } = analyticsServices();
    data['fixture-report']['Analytics videos'] = [['Unrelated staff data']];
    expect(() => initializeAnalytics()).toThrow(
      'Analytics initialization failed',
    );
    expect(data['fixture-report']['Analytics videos']).toEqual([
      ['Unrelated staff data'],
    ]);
    expect(ops.at(-1)).toBe('unlock');
  });

  it('does not expose maintenance through public requests; installs daily/edit triggers idempotently', () => {
    const { triggers, data } = initialized();
    installAnalyticsTriggers();
    installAnalyticsTriggers();
    expect(triggers).toEqual(['refreshAnalytics', 'refreshAnalyticsOnEdit']);
    const before = JSON.stringify(data['fixture-report']);
    expect(send({ action: 'refreshAnalytics' })).toHaveProperty('error');
    expect(JSON.stringify(data['fixture-report'])).toBe(before);
    expect(doGet().getContent()).not.toContain('Analytics');
    for (const link of analyticsReportLinks()) {
      const url = new URL(link.url);
      expect(url.searchParams.get('ds.spreadsheetId')).toBe('fixture-report');
      expect(url.searchParams.get('ds.connector')).toBe('googleSheets');
      expect(url.hostname).toBe('lookerstudio.google.com');
    }
  });

  it('escapes formula-shaped public metadata cells', () => {
    expect(literalCell('=1+1')).toBe("'=1+1");
    expect(literalCell('  +1')).toBe("'  +1");
    expect(literalCell('Safe title')).toBe('Safe title');
    expect(literalCell(3)).toBe(3);
  });
});
