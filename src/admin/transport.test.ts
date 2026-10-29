import { afterEach, describe, it, expect, vi } from 'vitest';
import { dashboardDemo } from '../../fixtures/dashboard-demo';
import { loadPrivateDashboard } from './transport';
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
  it('bounds an RPC that never returns', async () => {
    vi.useFakeTimers();
    const runner = {
      withSuccessHandler: () => runner,
      withFailureHandler: () => runner,
      readDashboard: () => {},
    };
    window.google = { script: { run: runner } };
    const request = loadPrivateDashboard();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(await request).toEqual({ ok: false, error: 'REPORT_UNAVAILABLE' });
    expect(vi.getTimerCount()).toBe(0);
  });
});
