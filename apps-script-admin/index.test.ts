import { afterEach, describe, it, expect, vi } from 'vitest';
import { analyticsServices } from '../fixtures/analytics-services';
import { doGet, readDashboard } from './index';
import * as publishedLibrary from '../apps-script/published-library';
const { configuredLibrarySheet } = await vi.importActual<
  typeof publishedLibrary
>('../apps-script/published-library');

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
function setup() {
  const s = analyticsServices();
  s.properties.LIBRARY_SOURCE_SHEET_URL =
    'https://docs.google.com/spreadsheets/d/fixture-catalog/edit';
  vi.spyOn(publishedLibrary, 'configuredLibrarySheet').mockImplementation(
    configuredLibrarySheet,
  );
  const bindings: Record<string, Record<string, string>> = {
    'admin@example.test': { ANALYTICS_CONNECTED_SHEET: 'fixture-catalog' },
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
    const other = readDashboard();
    expect(other.ok && other.connection).toEqual(result.connection);
    expect(other.ok && other.snapshot.facts).toEqual(result.snapshot.facts);
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
  it('loads the configured source for first-time and existing users without reading or writing personal connections', () => {
    const s = setup();
    const before = [...s.ops];
    const personalProperties = vi.spyOn(PropertiesService, 'getUserProperties');
    for (const email of ['eliot@example.test', 'admin@example.test']) {
      s.identity(email);
      s.bindings[email] = { ANALYTICS_CONNECTED_SHEET: 'obsolete-sheet' };
      const result = readDashboard();
      expect(result.ok && result.connection?.url).toBe(
        'https://docs.google.com/spreadsheets/d/fixture-catalog/edit',
      );
    }
    expect(personalProperties).not.toHaveBeenCalled();
    expect(s.ops).toEqual(before);
  });
  it('rechecks file permission on reload after a successful read', () => {
    const s = setup();
    expect(readDashboard().ok).toBe(true);
    s.openById.mockImplementation(() => {
      throw new Error('Revoked file permission');
    });
    expect(readDashboard()).toEqual({ ok: false, error: 'ACCESS_DENIED' });
  });
  it('rejects broadly shared source Sheets', () => {
    const s = setup();
    for (const sharing of [
      'ANYONE',
      'ANYONE_WITH_LINK',
      'DOMAIN',
      'DOMAIN_WITH_LINK',
    ]) {
      s.sharing(sharing);
      expect(readDashboard()).toEqual({
        ok: false,
        error: 'SHARING_TOO_BROAD',
      });
    }
  });
  it('reports missing or invalid shared configuration without using a saved personal connection', () => {
    const s = setup();
    for (const source of [
      '',
      'https://evil.test/spreadsheets/d/fixture-catalog',
    ]) {
      s.properties.LIBRARY_SOURCE_SHEET_URL = source;
      expect(readDashboard()).toEqual({
        ok: false,
        error: 'SOURCE_NOT_CONFIGURED',
      });
    }
  });
  it('follows a changed shared source instead of an old personal binding', () => {
    const s = setup();
    s.data['new-source'] = s.data['fixture-catalog'];
    s.properties.LIBRARY_SOURCE_SHEET_URL =
      'https://docs.google.com/spreadsheets/d/new-source/edit';
    const result = readDashboard();
    expect(result.ok && result.connection?.url).toBe(
      'https://docs.google.com/spreadsheets/d/new-source/edit',
    );
    expect(s.openById).toHaveBeenCalledWith('new-source');
    expect(s.openById).not.toHaveBeenCalledWith('fixture-catalog');
  });
  it('loads the shared catalog without reporting config and distinguishes missing usage from zero usage', () => {
    const s = setup();
    const before = [...s.ops];
    const result = readDashboard();
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
});
