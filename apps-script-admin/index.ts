/// <reference types="google-apps-script" />
import { z } from 'zod';
import type { DashboardResponse } from '../src/admin/snapshot';

import { sheetLink } from '../src/admin/sheetLink';
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
export function doGet() {
  try {
    authorizeUser();
    return HtmlService.createHtmlOutputFromFile('Dashboard')
      .setTitle('FCNY · Library analytics')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } catch {
    return HtmlService.createHtmlOutput(
      '<h1>Google sign-in required</h1><p>Use your Google account to view the library analytics. Your account must have access to the library Sheet.</p>',
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
  let id: string;
  try {
    id = configuredLibrarySheet();
  } catch {
    return { ok: false, error: 'SOURCE_NOT_CONFIGURED' };
  }
  try {
    // Read the main app's configured source under the visiting user's identity.
    if (DriveApp.getFileById(id).getSharingAccess() !== DriveApp.Access.PRIVATE)
      return { ok: false, error: 'SHARING_TOO_BROAD' };
    return loadBook(SpreadsheetApp.openById(id));
  } catch {
    return { ok: false, error: 'ACCESS_DENIED' };
  }
}
