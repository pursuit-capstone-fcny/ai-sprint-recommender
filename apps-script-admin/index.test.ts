import { afterEach, describe, it, expect, vi } from 'vitest';
import { analyticsServices } from '../fixtures/analytics-services';
import { initializeAnalytics, refreshAnalytics } from '../apps-script/index';
import { doGet, readDashboard } from './index';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
function setup() {
  const s = analyticsServices();
  initializeAnalytics();
  refreshAnalytics();
  Object.assign(s.properties, {
    ANALYTICS_ADMIN_ENABLED: 'true',
    ANALYTICS_ADMIN_ENVIRONMENT: 'test',
    ANALYTICS_ADMIN_EMAILS: '["admin@example.test"]',
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
    expect(readDashboard()).toEqual({ ok: false, error: 'ACCESS_DENIED' });
    expect(doGet()).toEqual({ kind: 'denied' });
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
