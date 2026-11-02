import { z } from 'zod';
import { parseSheetLink } from './sheetLink';
import { DashboardSnapshotSchema, type DashboardResponse } from './snapshot';
type Runner = {
  withSuccessHandler: (handler: (value: unknown) => void) => Runner;
  withFailureHandler: (handler: () => void) => Runner;
  readDashboard: () => void;
  connectSheet?: (link: string) => void;
  disconnectSheet?: () => void;
};
declare global {
  interface Window {
    google?: { script?: { run?: Runner } };
  }
}
const connectionSchema = z.strictObject({
  title: z.string().min(1).max(1000),
  url: z.string().refine((value) => {
    try {
      parseSheetLink(value);
      return true;
    } catch {
      return false;
    }
  }),
  kind: z.enum(['report', 'library']),
});
export const loadPrivateDashboard = () => request('readDashboard');
export const connectPrivateSheet = (link: string) =>
  request('connectSheet', link);
export function disconnectPrivateSheet(): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), 30_000);
    const finish = (ok: boolean) => {
      clearTimeout(timer);
      resolve(ok);
    };
    const runner = window.google?.script?.run;
    if (!runner?.disconnectSheet) {
      finish(false);
      return;
    }
    runner
      .withSuccessHandler((value) =>
        finish(
          typeof value === 'object' &&
            value !== null &&
            'ok' in value &&
            value.ok === true,
        ),
      )
      .withFailureHandler(() => finish(false))
      .disconnectSheet?.();
  });
}
// Apps Script RPC can omit null-valued properties inside nested catalog rows.
// Restore only the contract's two nullable metadata fields before validation.
function rpcSnapshot(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || !('catalog' in value))
    return value;
  const catalog = value.catalog;
  if (
    typeof catalog !== 'object' ||
    catalog === null ||
    !('items' in catalog) ||
    !Array.isArray(catalog.items)
  )
    return value;
  return {
    ...value,
    catalog: {
      ...catalog,
      items: catalog.items.map((item: unknown) => {
        if (typeof item !== 'object' || item === null) return item;
        return {
          ...item,
          addedAt: 'addedAt' in item ? (item.addedAt ?? null) : null,
          lengthSeconds:
            'lengthSeconds' in item ? (item.lengthSeconds ?? null) : null,
        };
      }),
    },
  };
}
function request(
  method: 'readDashboard' | 'connectSheet',
  link = '',
): Promise<DashboardResponse> {
  return new Promise((resolve) => {
    const timer = setTimeout(
      () => resolve({ ok: false, error: 'REPORT_UNAVAILABLE' }),
      30_000,
    );
    const finish = (value: DashboardResponse) => {
      clearTimeout(timer);
      resolve(value);
    };
    const runner = window.google?.script?.run;
    if (!runner || !runner[method]) {
      finish({ ok: false, error: 'ACCESS_DENIED' });
      return;
    }
    const call = runner
      .withSuccessHandler((value) => {
        if (typeof value === 'object' && value !== null && 'ok' in value) {
          if (value.ok === true && 'snapshot' in value) {
            const parsed = DashboardSnapshotSchema.safeParse(
              rpcSnapshot(value.snapshot),
            );
            if (parsed.success) {
              const connection =
                'connection' in value
                  ? connectionSchema.safeParse(value.connection)
                  : null;
              if (connection && !connection.success) {
                finish({ ok: false, error: 'REPORT_UNAVAILABLE' });
                return;
              }
              finish({
                ok: true,
                snapshot: parsed.data,
                ...(connection?.success ? { connection: connection.data } : {}),
              });
              return;
            }
          }
          if (
            value.ok === false &&
            'error' in value &&
            [
              'ACCESS_DENIED',
              'SHEET_NOT_CONNECTED',
              'INVALID_SHEET_LINK',
              'UNSUPPORTED_SHEET',
              'SHARING_TOO_BROAD',
            ].includes(String(value.error))
          ) {
            finish({
              ok: false,
              error: value.error as Extract<
                DashboardResponse,
                { ok: false }
              >['error'],
            });
            return;
          }
        }
        finish({ ok: false, error: 'REPORT_UNAVAILABLE' });
      })
      .withFailureHandler(() =>
        finish({ ok: false, error: 'REPORT_UNAVAILABLE' }),
      );
    if (method === 'connectSheet') call.connectSheet?.(link);
    else call.readDashboard();
  });
}
