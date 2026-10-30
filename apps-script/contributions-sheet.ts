/// <reference types="google-apps-script" />
import { z } from 'zod';
import { ContributionPolicySchema } from '../src/contracts/contribution';
import { literalCell } from './analytics-sheet';
import {
  contributionHeaders,
  MAX_CONTRIBUTION_ROWS,
  receiveContribution,
} from './contributions';
import type { UsageRequest } from './usage';

type Sheet = GoogleAppsScript.Spreadsheet.Sheet;
function configuration(requireEnabled = true) {
  const p = PropertiesService.getScriptProperties();
  if (
    (requireEnabled && p.getProperty('REQUESTS_ENABLED') !== 'true') ||
    p.getProperty('REQUESTS_ACCESS_APPROVED') !== 'true'
  )
    throw new Error('Requests are not configured');
  const id = p.getProperty('REQUESTS_SPREADSHEET_ID');
  const catalogId = p.getProperty('CATALOG_SPREADSHEET_ID');
  const usageId = p.getProperty('USAGE_SPREADSHEET_ID');
  const analyticsId = p.getProperty('ANALYTICS_SPREADSHEET_ID');
  const feedbackId = p.getProperty('FEEDBACK_REPORT_SPREADSHEET_ID');
  const boundId = SpreadsheetApp.getActiveSpreadsheet()?.getId();
  if (
    !id ||
    !catalogId ||
    !usageId ||
    !analyticsId ||
    [catalogId, usageId, analyticsId, feedbackId, boundId].includes(id)
  )
    throw new Error('Requests require a separate review workbook');
  const policy = ContributionPolicySchema.parse(
    JSON.parse(p.getProperty('REQUESTS_POLICY') ?? ''),
  );
  return { id, policy };
}
function verify(sheet: Sheet) {
  if (
    sheet.getLastRow() > MAX_CONTRIBUTION_ROWS + 1 ||
    sheet.getLastColumn() !== contributionHeaders.length ||
    JSON.stringify(
      sheet.getRange(1, 1, 1, contributionHeaders.length).getValues()[0],
    ) !== JSON.stringify(contributionHeaders)
  )
    throw new Error('Invalid review table');
}
function reviewSheet(id: string) {
  const sheet = SpreadsheetApp.openById(id).getSheetByName('Requests');
  if (!sheet) throw new Error('Initialize requests first');
  verify(sheet);
  return sheet;
}
function records(sheet: Sheet) {
  verify(sheet);
  if (sheet.getLastRow() <= 1) return [];
  return z
    .array(z.tuple([z.uuid(), z.iso.datetime()]))
    .parse(sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues())
    .map(([requestId, receivedAt]) => ({
      requestId: requestId.toLowerCase(),
      receivedAt,
    }));
}
export function contributionPost(request?: UsageRequest) {
  let body: string;
  try {
    const p = PropertiesService.getScriptProperties();
    const enabled = p.getProperty('REQUESTS_ENABLED') === 'true';
    let sheet: Sheet | undefined;
    const open = () => {
      sheet ??= reviewSheet(configuration().id);
      return sheet;
    };
    body = receiveContribution(request, {
      enabled,
      policy: () => configuration().policy,
      now: () => new Date(),
      lock: LockService.getScriptLock(),
      records: () => records(open()),
      append: (entry, receivedAt) => {
        const target = open();
        const row = target.getLastRow() + 1;
        if (row > target.getMaxRows())
          target.insertRowsAfter(target.getMaxRows(), 1);
        target
          .getRange(row, 1, 1, contributionHeaders.length)
          .setNumberFormat('@')
          .setValues([
            [
              entry.requestId,
              receivedAt,
              'new',
              entry.kind,
              entry.topic,
              entry.kind === 'demo' ? entry.email : '',
              entry.policyVersion,
            ].map(literalCell),
          ]);
        SpreadsheetApp.flush();
      },
    });
  } catch {
    body = JSON.stringify({ error: { code: 'REQUESTS_UNAVAILABLE' } });
  }
  // Never log the request body or exception, and never return private fields.
  return ContentService.createTextOutput(body).setMimeType(
    ContentService.MimeType.JSON,
  );
}
export function initializeRequests() {
  const c = configuration(false);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1500)) throw new Error('Requests busy');
  try {
    const book = SpreadsheetApp.openById(c.id);
    const sheet =
      book.getSheetByName('Requests') ?? book.insertSheet('Requests');
    if (sheet.getLastRow() === 0)
      sheet
        .getRange(1, 1, 1, contributionHeaders.length)
        .setNumberFormat('@')
        .setValues([contributionHeaders]);
    verify(sheet);
    sheet.setFrozenRows(1);
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(
        ['new', 'reviewing', 'accepted', 'declined', 'duplicate', 'spam'],
        true,
      )
      .setAllowInvalid(false)
      .build();
    sheet.getRange(2, 3, sheet.getMaxRows() - 1, 1).setDataValidation(rule);
    SpreadsheetApp.flush();
  } catch {
    throw new Error(
      'Request initialization failed; check configuration and review table',
    );
  } finally {
    lock.releaseLock();
  }
}
export function purgeRequests() {
  const c = configuration(false);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1500)) throw new Error('Requests busy');
  try {
    const sheet = reviewSheet(c.id);
    const cutoff = Date.now() - c.policy.retentionDays * 86_400_000;
    const expired = records(sheet)
      .flatMap((r, i) => (Date.parse(r.receivedAt) <= cutoff ? [i + 2] : []))
      .reverse();
    for (const row of expired) sheet.deleteRow(row);
    SpreadsheetApp.flush();
    return { deleted: expired.length };
  } catch {
    throw new Error(
      'Request cleanup failed; check configuration and review table',
    );
  } finally {
    lock.releaseLock();
  }
}
export function installRequestRetention() {
  configuration(false);
  purgeRequests();
  if (
    !ScriptApp.getProjectTriggers().some(
      (t) => t.getHandlerFunction() === 'purgeRequests',
    )
  )
    ScriptApp.newTrigger('purgeRequests').timeBased().everyHours(1).create();
}
