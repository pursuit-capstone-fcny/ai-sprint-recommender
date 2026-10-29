/// <reference types="google-apps-script" />
import { z } from 'zod';
import {
  DashboardSnapshotSchema,
  factFields,
  type DashboardResponse,
} from '../src/admin/snapshot';

import { parseSheetLink, sheetLink } from '../src/admin/sheetLink';
import { readLibraryDashboard } from './library';

function authorizeUser() {
  if (
    PropertiesService.getScriptProperties().getProperty(
      'ANALYTICS_ADMIN_ENABLED',
    ) === 'false'
  )
    throw new Error('Denied');
  const email = Session.getActiveUser().getEmail().trim().toLowerCase();
  if (
    !z.email().safeParse(email).success ||
    Session.getEffectiveUser().getEmail().trim().toLowerCase() !== email
  )
    throw new Error('Denied');
}
function connectedBook(id: string) {
  // Restricted file membership replaces a duplicated, manually managed app allowlist.
  if (DriveApp.getFileById(id).getSharingAccess() !== DriveApp.Access.PRIVATE)
    throw new Error('Sharing too broad');
  return SpreadsheetApp.openById(id);
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
    authorizeUser();
    return HtmlService.createHtmlOutputFromFile('Dashboard')
      .setTitle('FCNY · Library analytics')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } catch {
    return HtmlService.createHtmlOutput(
      '<h1>Google sign-in required</h1><p>Use your Google account to connect a private library Sheet you can access.</p>',
    ).setTitle('FCNY · Sign-in required');
  }
}
function loadBook(
  book: GoogleAppsScript.Spreadsheet.Spreadsheet,
): DashboardResponse {
  try {
    const connection = {
      title: book.getName(),
      url: sheetLink(book.getId()),
      kind: book.getSheetByName('Analytics facts')
        ? ('report' as const)
        : ('library' as const),
    };
    if (connection.kind === 'library')
      return { ok: true, snapshot: readLibraryDashboard(book), connection };
    const before = readStatus(book),
      health = snapshotStatus(before);
    if (!['ready', 'empty'].includes(String(health.state)))
      return {
        ok: true,
        connection,
        snapshot: DashboardSnapshotSchema.parse({ ...health, facts: [] }),
      };
    const validated = DashboardSnapshotSchema.parse({ ...health, facts: [] });
    if (Date.parse(validated.staleAt!) <= Date.now())
      return {
        ok: true,
        snapshot: { ...validated, state: 'stale', facts: [] },
        connection,
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
      connection,
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

export function readDashboard(): DashboardResponse {
  try {
    authorizeUser();
  } catch {
    return { ok: false, error: 'ACCESS_DENIED' };
  }
  const id = PropertiesService.getUserProperties().getProperty(
    'ANALYTICS_CONNECTED_SHEET',
  );
  if (!id) return { ok: false, error: 'SHEET_NOT_CONNECTED' };
  try {
    return loadBook(connectedBook(id));
  } catch {
    return { ok: false, error: 'ACCESS_DENIED' };
  }
}
export function connectSheet(value: unknown): DashboardResponse {
  try {
    authorizeUser();
  } catch {
    return { ok: false, error: 'ACCESS_DENIED' };
  }
  let id: string;
  try {
    id = parseSheetLink(value);
  } catch {
    return { ok: false, error: 'INVALID_SHEET_LINK' };
  }
  const lock = LockService.getUserLock();
  if (!lock.tryLock(1500)) return { ok: false, error: 'REPORT_UNAVAILABLE' };
  try {
    let book: GoogleAppsScript.Spreadsheet.Spreadsheet;
    try {
      if (
        DriveApp.getFileById(id).getSharingAccess() !== DriveApp.Access.PRIVATE
      )
        return { ok: false, error: 'SHARING_TOO_BROAD' };
      book = SpreadsheetApp.openById(id);
    } catch {
      return { ok: false, error: 'ACCESS_DENIED' };
    }
    const result = loadBook(book);
    if (!result.ok) return { ok: false, error: 'UNSUPPORTED_SHEET' };
    PropertiesService.getUserProperties().setProperty(
      'ANALYTICS_CONNECTED_SHEET',
      id,
    );
    return result;
  } catch {
    return { ok: false, error: 'REPORT_UNAVAILABLE' };
  } finally {
    lock.releaseLock();
  }
}
export function disconnectSheet() {
  try {
    authorizeUser();
  } catch {
    return { ok: false };
  }
  const lock = LockService.getUserLock();
  if (!lock.tryLock(1500)) return { ok: false };
  try {
    PropertiesService.getUserProperties().deleteProperty(
      'ANALYTICS_CONNECTED_SHEET',
    );
    return { ok: true };
  } catch {
    return { ok: false };
  } finally {
    lock.releaseLock();
  }
}
