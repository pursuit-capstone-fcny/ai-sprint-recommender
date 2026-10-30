/// <reference types="google-apps-script" />
import { z } from 'zod';
import type { DashboardResponse } from '../src/admin/snapshot';

import { parseSheetLink, sheetLink } from '../src/admin/sheetLink';
import { readLibraryDashboard } from './library';
import { configuredLibrarySheet } from '../apps-script/published-library';

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
  if (id !== configuredLibrarySheet()) throw new Error('Unconfigured library');
  // Restricted file membership replaces a duplicated, manually managed app allowlist.
  if (DriveApp.getFileById(id).getSharingAccess() !== DriveApp.Access.PRIVATE)
    throw new Error('Sharing too broad');
  return SpreadsheetApp.openById(id);
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
    return {
      ok: true,
      snapshot: readLibraryDashboard(book),
      connection: {
        title: book.getName(),
        url: sheetLink(book.getId()),
        kind: 'library',
      },
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
      book = connectedBook(id);
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
