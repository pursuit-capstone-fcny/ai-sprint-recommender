import { DashboardSnapshotSchema, type DashboardResponse } from './snapshot';
type Runner = {
  withSuccessHandler: (handler: (value: unknown) => void) => Runner;
  withFailureHandler: (handler: () => void) => Runner;
  readDashboard: () => void;
};
declare global {
  interface Window {
    google?: { script?: { run?: Runner } };
  }
}
export function loadPrivateDashboard(): Promise<DashboardResponse> {
  return new Promise((resolve) => {
    const timer = setTimeout(
      () => resolve({ ok: false, error: 'REPORT_UNAVAILABLE' }),
      15_000,
    );
    const finish = (value: DashboardResponse) => {
      clearTimeout(timer);
      resolve(value);
    };
    const runner = window.google?.script?.run;
    if (!runner) {
      finish({ ok: false, error: 'ACCESS_DENIED' });
      return;
    }
    runner
      .withSuccessHandler((value) => {
        if (typeof value === 'object' && value !== null && 'ok' in value) {
          if (value.ok === true && 'snapshot' in value) {
            const parsed = DashboardSnapshotSchema.safeParse(value.snapshot);
            if (parsed.success) {
              finish({ ok: true, snapshot: parsed.data });
              return;
            }
          }
          if (
            value.ok === false &&
            'error' in value &&
            value.error === 'ACCESS_DENIED'
          ) {
            finish({ ok: false, error: 'ACCESS_DENIED' });
            return;
          }
        }
        finish({ ok: false, error: 'REPORT_UNAVAILABLE' });
      })
      .withFailureHandler(() =>
        finish({ ok: false, error: 'REPORT_UNAVAILABLE' }),
      )
      .readDashboard();
  });
}
