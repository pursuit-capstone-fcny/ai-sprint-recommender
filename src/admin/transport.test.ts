import { afterEach, describe, it, expect, vi } from 'vitest';
import fixture from '../../fixtures/public-catalog.json';
import { dashboardDemo } from '../../fixtures/dashboard-demo';
import {
  loadPrivateDashboard,
  connectPrivateSheet,
  disconnectPrivateSheet,
} from './transport';
afterEach(() => {
  delete window.google;
  vi.useRealTimers();
});
describe('private dashboard RPC', () => {
  it('fails closed outside the private Google HTML app', async () => {
    expect(await loadPrivateDashboard()).toEqual({
      ok: false,
      error: 'ACCESS_DENIED',
    });
  });
  it('validates returned facts and never displays a raw server failure', async () => {
    let success: (v: unknown) => void = () => {},
      fail: () => void = () => {};
    const runner = {
      withSuccessHandler: (f: (v: unknown) => void) => {
        success = f;
        return runner;
      },
      withFailureHandler: (f: () => void) => {
        fail = f;
        return runner;
      },
      readDashboard: () => {},
    };
    window.google = { script: { run: runner } };
    const request = loadPrivateDashboard();
    success({ ok: true, snapshot: dashboardDemo });
    expect((await request).ok).toBe(true);
    const invalid = loadPrivateDashboard();
    success({
      ok: true,
      snapshot: { ...dashboardDemo, rawGoal: 'synthetic private value' },
    });
    expect(await invalid).toEqual({ ok: false, error: 'REPORT_UNAVAILABLE' });
    const failure = loadPrivateDashboard();
    fail();
    expect(await failure).toEqual({ ok: false, error: 'REPORT_UNAVAILABLE' });
  });
  it('routes connection RPCs, preserves safe setup errors, and rejects unsafe connection links', async () => {
    let success: (v: unknown) => void = () => {};
    const runner = {
      withSuccessHandler: (f: (v: unknown) => void) => {
        success = f;
        return runner;
      },
      withFailureHandler: () => runner,
      readDashboard: () => {},
      connectSheet: vi.fn(),
      disconnectSheet: vi.fn(),
    };
    window.google = { script: { run: runner } };
    const request = connectPrivateSheet(
      'https://docs.google.com/spreadsheets/d/fixture-catalog/edit',
    );
    expect(runner.connectSheet).toHaveBeenCalledWith(
      'https://docs.google.com/spreadsheets/d/fixture-catalog/edit',
    );
    success({ ok: false, error: 'SHARING_TOO_BROAD' });
    expect(await request).toEqual({ ok: false, error: 'SHARING_TOO_BROAD' });
    const invalid = loadPrivateDashboard();
    success({
      ok: true,
      snapshot: dashboardDemo,
      connection: {
        title: 'Fixture',
        kind: 'library',
        url: 'javascript:alert(1)',
      },
    });
    expect(await invalid).toEqual({ ok: false, error: 'REPORT_UNAVAILABLE' });
    const disconnected = disconnectPrivateSheet();
    success({ ok: true });
    expect(await disconnected).toBe(true);
  });
  it('bounds an RPC that never returns', async () => {
    vi.useFakeTimers();
    const runner = {
      withSuccessHandler: () => runner,
      withFailureHandler: () => runner,
      readDashboard: () => {},
    };
    window.google = { script: { run: runner } };
    const request = loadPrivateDashboard();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(await request).toEqual({ ok: false, error: 'REPORT_UNAVAILABLE' });
    expect(vi.getTimerCount()).toBe(0);
  });
});

it('accepts optional video metadata omitted by Apps Script RPC and still rejects malformed metadata', async () => {
  let success: (v: unknown) => void = () => {};
  const runner = {
    withSuccessHandler: (handler: (v: unknown) => void) => {
      success = handler;
      return runner;
    },
    withFailureHandler: () => runner,
    readDashboard: () => {},
  };
  window.google = { script: { run: runner } };
  const catalog = {
    ...fixture,
    items: fixture.items.map((item) => ({
      ...item,
      addedAt: undefined,
      lengthSeconds: undefined,
    })),
  };
  const request = loadPrivateDashboard();
  success({ ok: true, snapshot: { ...dashboardDemo, catalog } });
  const result = await request;
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('Expected catalog');
  expect(result.snapshot.catalog?.items).toHaveLength(fixture.items.length);
  expect(result.snapshot.catalog?.items[0]).toMatchObject({
    addedAt: null,
    lengthSeconds: null,
  });
  const invalid = loadPrivateDashboard();
  success({
    ok: true,
    snapshot: {
      ...dashboardDemo,
      catalog: {
        ...catalog,
        items: [{ ...catalog.items[0], lengthSeconds: 'unknown' }],
      },
    },
  });
  expect(await invalid).toEqual({ ok: false, error: 'REPORT_UNAVAILABLE' });
});
