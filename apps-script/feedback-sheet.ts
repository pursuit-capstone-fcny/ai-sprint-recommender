/// <reference types="google-apps-script" />
import { buildFeedbackReport } from '../src/feedback/report';
import { readAnalyticsRecords } from './analytics-sheet';
import { z } from 'zod';

// Editor-only. Google file sharing restricts reports to the approved staff list.
// No doGet, public RPC or learner route dispatches this operation.
export function refreshFeedbackReport() {
  const p = PropertiesService.getScriptProperties();
  if (p.getProperty('FEEDBACK_REPORT_ACCESS_APPROVED') !== 'true')
    throw new Error('Feedback reporting access is not approved');
  const reportId = p.getProperty('FEEDBACK_REPORT_SPREADSHEET_ID');
  const usageId = p.getProperty('USAGE_SPREADSHEET_ID');
  const catalogId = p.getProperty('CATALOG_SPREADSHEET_ID');
  const requestId = p.getProperty('REQUESTS_SPREADSHEET_ID');
  if (
    !reportId ||
    !usageId ||
    !catalogId ||
    [usageId, catalogId, requestId].includes(reportId)
  )
    throw new Error('Feedback requires a restricted reporting workbook');
  const days = z.coerce
    .number()
    .int()
    .min(1)
    .max(365)
    .parse(p.getProperty('USAGE_RETENTION_DAYS'));
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1500)) throw new Error('Feedback report busy');
  let report: GoogleAppsScript.Spreadsheet.Sheet | undefined;
  try {
    const book = SpreadsheetApp.openById(reportId);
    report = book.getSheetByName('Feedback') ?? book.insertSheet('Feedback');
    const log = SpreadsheetApp.openById(usageId).getSheetByName('Usage');
    if (!log) throw new Error('Missing usage log');
    const rows = buildFeedbackReport(
      readAnalyticsRecords(log, new Date(), days),
    );
    const values = [
      ['youtubeId', 'helpful', 'notHelpful', 'responses', 'helpfulRate'],
      ...rows.map((row) => [
        row.youtubeId,
        row.helpful,
        row.notHelpful,
        row.responses,
        row.helpfulRate,
      ]),
    ];
    if (report.getMaxRows() < values.length)
      report.insertRowsAfter(
        report.getMaxRows(),
        values.length - report.getMaxRows(),
      );
    report.clearContents();
    report.getRange(1, 1, values.length, 5).setValues(values);
    report.setFrozenRows(1);
    SpreadsheetApp.flush();
  } catch {
    // Clear stale aggregates if refresh/retention validation fails.
    report?.clearContents();
    SpreadsheetApp.flush();
    throw new Error(
      'Feedback refresh failed; verify configuration and retained usage',
    );
  } finally {
    lock.releaseLock();
  }
}
export function installFeedbackReporting() {
  refreshFeedbackReport();
  if (
    !ScriptApp.getProjectTriggers().some(
      (t) => t.getHandlerFunction() === 'refreshFeedbackReport',
    )
  )
    ScriptApp.newTrigger('refreshFeedbackReport')
      .timeBased()
      .everyHours(1)
      .create();
}
