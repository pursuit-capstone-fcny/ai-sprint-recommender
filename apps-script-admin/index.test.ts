import { afterEach, describe, it, expect, vi } from 'vitest';
import { analyticsServices } from '../fixtures/analytics-services';
import { initializeAnalytics, refreshAnalytics } from '../apps-script/index';
import { doGet, readDashboard, connectSheet, disconnectSheet } from './index';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
function setup() {
  const s = analyticsServices();
  initializeAnalytics();
  refreshAnalytics();
  const bindings: Record<string, Record<string, string>> = {
    'admin@example.test': { ANALYTICS_CONNECTED_SHEET: 'fixture-report' },
  };
  let sharing = 'PRIVATE';
  vi.stubGlobal('DriveApp', {
    Access: { PRIVATE: 'PRIVATE' },
    getFileById: () => ({ getSharingAccess: () => sharing }),
  });
  vi.stubGlobal('PropertiesService', {
    getScriptProperties: () => ({
      getProperty: (key: string) => s.properties[key] ?? null,
    }),
    getUserProperties: () => {
      bindings[active] ??= {};
      return {
        getProperty: (key: string) => bindings[active][key] ?? null,
        setProperty: (key: string, value: string) => {
          bindings[active][key] = value;
        },
        deleteProperty: (key: string) => {
          delete bindings[active][key];
        },
      };
    },
  });
  vi.stubGlobal('LockService', {
    getUserLock: () => ({ tryLock: () => true, releaseLock: () => {} }),
  });
  let active = 'admin@example.test',
    effective = 'admin@example.test';
  vi.stubGlobal('Session', {
    getActiveUser: () => ({ getEmail: () => active }),
    getEffectiveUser: () => ({ getEmail: () => effective }),
  });
  vi.stubGlobal('HtmlService', {
    createHtmlOutputFromFile: () => ({
      setTitle: () => ({ addMetaTag: () => ({ kind: 'dashboard' }) }),
    }),
    createHtmlOutput: () => ({ setTitle: () => ({ kind: 'denied' }) }),
  });
  return {
    ...s,
    bindings,
    sharing: (value: string) => {
      sharing = value;
    },
    identity: (a: string, e = a) => {
      active = a;
      effective = e;
    },
  };
}
describe('private admin deployment', () => {
  it('authorizes each request server-side and returns only aggregate facts', () => {
    const s = setup();
    expect(doGet()).toEqual({ kind: 'dashboard' });
    const result = readDashboard();
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected snapshot');
    expect(result.snapshot.facts.length).toBeGreaterThan(0);
    expect(JSON.stringify(result)).not.toContain('ANALYTICS_ADMIN_EMAILS');
    expect(JSON.stringify(result)).not.toContain('eventJson');
    s.identity('other@example.test');
    expect(readDashboard()).toEqual({
      ok: false,
      error: 'SHEET_NOT_CONNECTED',
    });
    expect(doGet()).toEqual({ kind: 'dashboard' });
  });
  it('denies missing identity, owner-executed deployment, disabled access and a missing file ACL', () => {
    const s = setup();
    s.identity('');
    expect(readDashboard().ok).toBe(false);
    s.identity('admin@example.test', 'owner@example.test');
    expect(readDashboard().ok).toBe(false);
    s.identity('admin@example.test');
    s.properties.ANALYTICS_ADMIN_ENABLED = 'false';
    expect(readDashboard().ok).toBe(false);
    s.properties.ANALYTICS_ADMIN_ENABLED = 'true';
    s.openById.mockImplementation(() => {
      throw new Error('Private ACL information');
    });
    expect(readDashboard()).toEqual({ ok: false, error: 'ACCESS_DENIED' });
  });
  it('connects using only a link, isolates users, and disconnects without file writes', () => {
    const s = setup();
    s.identity('eliot@example.test');
    const before = [...s.ops];
    expect(
      connectSheet(
        'https://docs.google.com/spreadsheets/d/fixture-report/edit#gid=0',
      ).ok,
    ).toBe(true);
    expect(readDashboard().ok).toBe(true);
    expect(s.bindings['eliot@example.test'].ANALYTICS_CONNECTED_SHEET).toBe(
      'fixture-report',
    );
    expect(disconnectSheet()).toEqual({ ok: true });
    expect(readDashboard()).toEqual({
      ok: false,
      error: 'SHEET_NOT_CONNECTED',
    });
    s.identity('admin@example.test');
    expect(readDashboard().ok).toBe(true);
    expect(s.ops).toEqual(before);
  });
  it('rejects invalid, broadly shared and inaccessible links without replacing a working connection', () => {
    const s = setup();
    for (const link of [
      'fixture-report',
      'https://evil.test/spreadsheets/d/fixture-report',
      'https://docs.google.com.evil.test/spreadsheets/d/fixture-report',
    ]) {
      expect(connectSheet(link)).toEqual({
        ok: false,
        error: 'INVALID_SHEET_LINK',
      });
    }
    s.sharing('ANYONE_WITH_LINK');
    expect(
      connectSheet(
        'https://docs.google.com/spreadsheets/d/fixture-report/edit',
      ),
    ).toEqual({ ok: false, error: 'SHARING_TOO_BROAD' });
    expect(readDashboard()).toEqual({ ok: false, error: 'ACCESS_DENIED' });
    s.sharing('PRIVATE');
    expect(
      connectSheet(
        'https://docs.google.com/spreadsheets/d/missing-fixture/edit',
      ),
    ).toEqual({ ok: false, error: 'ACCESS_DENIED' });
    expect(s.bindings['admin@example.test'].ANALYTICS_CONNECTED_SHEET).toBe(
      'fixture-report',
    );
  });
  it('connects a catalog directly without reporting config and distinguishes missing usage from zero usage', () => {
    const s = setup();
    const before = [...s.ops];
    const result = connectSheet(
      'https://docs.google.com/spreadsheets/u/0/d/fixture-catalog/edit',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected library snapshot');
    expect(result.connection?.kind).toBe('library');
    expect(result.snapshot.collectionAvailable).toBe(false);
    expect(result.snapshot.conservativeWindow).toBe(true);
    expect(result.snapshot.facts.length).toBeGreaterThan(0);
    s.data['fixture-catalog'].Usage = s.data['fixture-usage'].Usage;
    const logged = readDashboard();
    expect(logged.ok && logged.snapshot.collectionAvailable).toBe(true);
    expect(s.ops).toEqual(before);
  });
  it('suppresses stale, refreshing, cleared and failed facts', () => {
    const s = setup(),
      rows = s.data['fixture-report']['Analytics status'];
    for (const state of ['refreshing', 'cleared', 'error']) {
      rows.find((r) => r[0] === 'state')![1] = state;
      const result = readDashboard();
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.snapshot.facts).toEqual([]);
    }
    rows.find((r) => r[0] === 'state')![1] = 'ready';
    vi.setSystemTime(new Date('2026-10-25T12:00:00Z'));
    const result = readDashboard();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.snapshot.state).toBe('stale');
  });
  it('fails closed on a corrupt header or mismatched refresh generation', () => {
    const s = setup(),
      rows = s.data['fixture-report']['Analytics facts'];
    rows[0][0] = 'rawGoal';
    expect(readDashboard()).toEqual({ ok: false, error: 'REPORT_UNAVAILABLE' });
    rows[0][0] = 'activeInventory';
    const book = s.openById('fixture-report');
    const original = book.getSheetByName;
    let reads = 0;
    s.openById.mockReturnValue({
      ...book,
      getSheetByName: (name: string) => {
        if (name === 'Analytics status' && ++reads === 2)
          s.data['fixture-report']['Analytics status'].find(
            (r) => r[0] === 'generationId',
          )![1] = 'another-generation';
        return original(name);
      },
    });
    expect(readDashboard()).toEqual({ ok: false, error: 'REPORT_UNAVAILABLE' });
  });
});
