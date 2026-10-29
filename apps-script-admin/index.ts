/// <reference types="google-apps-script" />
import { z } from 'zod';
import {
  DashboardSnapshotSchema,
  factFields,
  type DashboardResponse,
} from '../src/admin/snapshot';

function authorizedBook() {
  const p = PropertiesService.getScriptProperties();
  if (
    p.getProperty('ANALYTICS_ADMIN_ENABLED') !== 'true' ||
    p.getProperty('ANALYTICS_ACCESS_APPROVED') !== 'true'
  )
    throw new Error('Denied');
  const email = Session.getActiveUser().getEmail().trim().toLowerCase();
  if (
    !z.email().safeParse(email).success ||
    Session.getEffectiveUser().getEmail().trim().toLowerCase() !== email
  )
    throw new Error('Denied');
  const allowed = z
    .array(z.email())
    .min(1)
    .max(100)
    .parse(JSON.parse(p.getProperty('ANALYTICS_ADMIN_EMAILS') ?? '[]'));
  if (!allowed.some((value) => value.toLowerCase() === email))
    throw new Error('Denied');
  const id = z
    .string()
    .regex(/^[A-Za-z0-9_-]{10,150}$/)
    .parse(p.getProperty('ANALYTICS_SPREADSHEET_ID'));
  // USER_ACCESSING deployment also enforces the signed-in reader's real file ACL.
  const environment = z
    .enum(['test', 'production'])
    .parse(p.getProperty('ANALYTICS_ADMIN_ENVIRONMENT'));
  return { book: SpreadsheetApp.openById(id), environment };
}
function readStatus(book: GoogleAppsScript.Spreadsheet.Spreadsheet) {
  const sheet = book.getSheetByName('Analytics status');
  if (!sheet || sheet.getLastRow() > 100 || sheet.getLastColumn() !== 2)
    throw new Error('Invalid status');
  const rows: unknown[][] = sheet.getDataRange().getValues();
  if (JSON.stringify(rows.shift()) !== JSON.stringify(['metric', 'value']))
    throw new Error('Invalid status');
  const values: Record<string, unknown> = {};
  for (const [key, value] of rows) {
    if (typeof key !== 'string' || key in values)
      throw new Error('Invalid status');
    values[key] = value;
  }
  return values;
}
function snapshotStatus(values: Record<string, unknown>) {
  const nullable = (key: string) =>
    values[key] === undefined || values[key] === 'unavailable'
      ? null
      : values[key];
  return {
    state: values.state,
    refreshedAt: nullable('lastSuccessAt'),
    staleAt: nullable('staleAt'),
    generationId: nullable('generationId'),
    startDate: nullable('startDate'),
    endDate: nullable('endDate'),
    environment: nullable('environment'),
    retainedFrom: nullable('retainedFrom'),
    retainedThrough: nullable('retainedThrough'),
    unmappedEvents: values.unmappedEvents ?? 0,
    unattributedEvents: values.unattributedEvents ?? 0,
  };
}
export function doGet() {
  try {
    authorizedBook();
    return HtmlService.createHtmlOutputFromFile('Dashboard')
      .setTitle('FCNY · Library analytics')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } catch {
    return HtmlService.createHtmlOutput(
      '<h1>Admin access required</h1><p>Sign in with an approved FCNY Google account that can read the reporting workbook. Contact the reporting owner if access is missing.</p>',
    ).setTitle('FCNY · Access required');
  }
}
export function readDashboard(): DashboardResponse {
  let access: ReturnType<typeof authorizedBook>;
  try {
    access = authorizedBook();
  } catch {
    return { ok: false, error: 'ACCESS_DENIED' };
  }
  try {
    const book = access.book;
    const before = readStatus(book),
      health = snapshotStatus(before);
    if (
      health.environment !== null &&
      health.environment !== access.environment
    )
      throw new Error('Environment mismatch');
    if (!['ready', 'empty'].includes(String(health.state)))
      return {
        ok: true,
        snapshot: DashboardSnapshotSchema.parse({ ...health, facts: [] }),
      };
    const validated = DashboardSnapshotSchema.parse({ ...health, facts: [] });
    if (validated.environment !== access.environment)
      throw new Error('Environment mismatch');
    if (Date.parse(validated.staleAt!) <= Date.now())
      return {
        ok: true,
        snapshot: { ...validated, state: 'stale', facts: [] },
      };
    const sheet = book.getSheetByName('Analytics facts');
    if (
      !sheet ||
      sheet.getLastRow() > 100_001 ||
      sheet.getLastColumn() !== factFields.length
    )
      throw new Error('Invalid facts');
    const rows: unknown[][] = sheet.getDataRange().getValues();
    if (JSON.stringify(rows.shift()) !== JSON.stringify(factFields))
      throw new Error('Invalid header');
    const after = readStatus(book);
    if (
      before.generationId !== after.generationId ||
      before.state !== after.state ||
      before.lastSuccessAt !== after.lastSuccessAt
    )
      throw new Error('Refresh in progress');
    return {
      ok: true,
      snapshot: DashboardSnapshotSchema.parse({
        ...health,
        facts: rows.map((row) =>
          Object.fromEntries(factFields.map((key, index) => [key, row[index]])),
        ),
      }),
    };
  } catch {
    return { ok: false, error: 'REPORT_UNAVAILABLE' };
  }
}
