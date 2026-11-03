/// <reference types="google-apps-script" />
import { z } from 'zod';
import { isContributionRequest } from './contributions';
import { contributionPost } from './contributions-sheet';
import { type PublicCatalog } from '../src/contracts/publicCatalog';
import type { UsageEvent } from '../src/contracts/usageEvent';
import { captureAnalyticsCatalog } from './analytics-snapshots';
import { publishedCatalog } from './published-library';
import { requirePrivateLibraryWorkbook } from './source-workbook';
import {
  expiredUsageRows,
  MAX_USAGE_ROWS,
  receiveUsage,
  receiveUsageBatch,
  isUsageBatch,
  usageError,
  type UsagePolicy,
  type UsageRecord,
  type UsageRequest,
} from './usage';

export const usageHeaders = ['eventId', 'receivedAt', 'eventJson'];
const retention = z.number().int().min(1).max(365);
const metadata = z.array(z.tuple([z.uuid(), z.iso.datetime()]));
type Properties = GoogleAppsScript.Properties.Properties;

function propertyNumber(properties: Properties, name: string): number {
  const value = properties.getProperty(name);
  return value && /^[1-9]\d*$/.test(value) ? Number(value) : NaN;
}

function usageBook(properties: Properties) {
  const id = properties.getProperty('USAGE_SPREADSHEET_ID');
  if (!id) throw new Error('Missing usage configuration');
  if (properties.getProperty('LIBRARY_SOURCE_FORMAT') === 'tracker')
    requirePrivateLibraryWorkbook(id);
  return SpreadsheetApp.openById(id);
}

function readPolicy(properties: Properties): UsagePolicy {
  return {
    retentionDays: propertyNumber(properties, 'USAGE_RETENTION_DAYS'),
    maxPerMinute: propertyNumber(properties, 'USAGE_MAX_PER_MINUTE'),
    maxPerDay: propertyNumber(properties, 'USAGE_MAX_PER_DAY'),
    maxRows: propertyNumber(properties, 'USAGE_MAX_ROWS'),
    recommendationVersions: JSON.parse(
      properties.getProperty('USAGE_RECOMMENDATION_VERSIONS') ?? '[]',
    ),
  };
}

function checkUsageSheet(sheet: GoogleAppsScript.Spreadsheet.Sheet) {
  const header: unknown[] = sheet.getRange(1, 1, 1, 3).getValues()[0];
  if (
    sheet.getLastColumn() !== 3 ||
    header.some((value, index) => value !== usageHeaders[index]) ||
    header.length !== 3 ||
    sheet.getLastRow() > MAX_USAGE_ROWS + 1
  ) {
    throw new Error('Invalid usage table');
  }
}

function readRecords(sheet: GoogleAppsScript.Spreadsheet.Sheet): UsageRecord[] {
  checkUsageSheet(sheet);
  const count = sheet.getLastRow() - 1;
  if (count === 0) return [];
  // Read only server timestamps and IDs, bounded by the hard row ceiling.
  return metadata
    .parse(sheet.getRange(2, 1, count, 2).getValues())
    .map(([eventId, receivedAt]) => ({
      eventId: eventId.toLowerCase(),
      receivedAt,
    }));
}

export function doPost(event?: { postData?: UsageRequest }) {
  if (isContributionRequest(event?.postData))
    return contributionPost(event?.postData);
  let body: string;
  let enabled = false;
  try {
    const properties = PropertiesService.getScriptProperties();
    enabled = properties.getProperty('USAGE_LOGGING_ENABLED') === 'true';
    let sheet: GoogleAppsScript.Spreadsheet.Sheet | undefined;
    let acceptedCatalog: PublicCatalog | undefined;
    const openSheet = () => {
      if (!sheet) {
        sheet = usageBook(properties).getSheetByName('Usage') ?? undefined;
        if (!sheet) throw new Error('Missing usage table');
      }
      return sheet;
    };
    const appendRows = (rows: { event: UsageEvent; receivedAt: string }[]) => {
      if (
        properties.getProperty('ANALYTICS_ENABLED') === 'true' &&
        acceptedCatalog
      ) {
        try {
          captureAnalyticsCatalog(usageBook(properties), acceptedCatalog);
        } catch {
          console.info('analytics-snapshot', 'unavailable');
        }
      }
      const target = openSheet();
      const nextRow = target.getLastRow() + 1;
      const gridRows = target.getMaxRows();
      if (nextRow + rows.length - 1 > gridRows)
        target.insertRowsAfter(
          gridRows,
          Math.min(Math.max(100, rows.length), MAX_USAGE_ROWS + 1 - gridRows),
        );
      target
        .getRange(nextRow, 1, rows.length, 3)
        .setNumberFormat('@')
        .setValues(
          rows.map(({ event, receivedAt }) => [
            event.eventId,
            receivedAt,
            JSON.stringify(event),
          ]),
        );
      SpreadsheetApp.flush();
    };
    const ports = {
      enabled,
      feedbackEnabled: properties.getProperty('FEEDBACK_ENABLED') === 'true',
      policy: () => readPolicy(properties),
      now: () => new Date(),
      lock: LockService.getScriptLock(),
      records: () => readRecords(openSheet()),
      catalog: () => {
        const catalog = publishedCatalog();
        acceptedCatalog = catalog;
        return catalog;
      },
      append: (usage: UsageEvent, receivedAt: string) =>
        appendRows([{ event: usage, receivedAt }]),
    };
    body = isUsageBatch(event?.postData)
      ? receiveUsageBatch(
          event?.postData,
          { ...ports, appendBatch: appendRows },
          properties.getProperty('USAGE_BATCH_SECRET'),
        )
      : receiveUsage(event?.postData, ports);
  } catch {
    body = usageError('USAGE_UNAVAILABLE');
  }
  // Fixed outcomes only, never request bodies, IDs, tags or exception text.
  if (enabled) {
    const receipt: {
      error?: { code: string };
      receipts?: { status?: string }[];
    } = JSON.parse(body);
    console.info(
      'usage-post',
      receipt.error
        ? usageError(receipt.error.code)
        : receipt.receipts
          ? JSON.stringify({
              ok: true,
              status: 'batch',
              accepted: receipt.receipts.filter(
                (row) => row.status === 'accepted',
              ).length,
              duplicates: receipt.receipts.filter(
                (row) => row.status === 'duplicate',
              ).length,
              rejected: receipt.receipts.filter((row) => !row.status).length,
            })
          : body,
    );
  }
  return ContentService.createTextOutput(body).setMimeType(
    ContentService.MimeType.JSON,
  );
}

// Editor-only entry points. doGet/doPost never dispatch operations by name.
export function initializeUsageLog() {
  const lock = LockService.getScriptLock();
  let locked = false;
  try {
    const properties = PropertiesService.getScriptProperties();
    retention.parse(propertyNumber(properties, 'USAGE_RETENTION_DAYS'));
    locked = lock.tryLock(1500);
    if (!locked) throw new Error('Usage busy');
    const book = usageBook(properties);
    let sheet = book.getSheetByName('Usage');
    if (!sheet) sheet = book.insertSheet('Usage');
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, 3).setNumberFormat('@').setValues([usageHeaders]);
      SpreadsheetApp.flush();
    }
    checkUsageSheet(sheet);
  } catch {
    throw new Error(
      'Usage initialization failed; check configuration and table',
    );
  } finally {
    if (locked) lock.releaseLock();
  }
}

export function purgeUsageLog() {
  const lock = LockService.getScriptLock();
  let locked = false;
  try {
    const properties = PropertiesService.getScriptProperties();
    const days = retention.parse(
      propertyNumber(properties, 'USAGE_RETENTION_DAYS'),
    );
    locked = lock.tryLock(1500);
    if (!locked) throw new Error('Usage busy');
    const sheet = usageBook(properties).getSheetByName('Usage');
    if (!sheet) throw new Error('Missing usage table');
    const expired = expiredUsageRows(readRecords(sheet), new Date(), days);
    // Group adjacent rows into one Sheets call; work bottom to top.
    for (let index = 0; index < expired.length; index++) {
      const end = expired[index];
      let start = end;
      while (expired[index + 1] === start - 1) start = expired[++index];
      sheet.deleteRows(start, end - start + 1);
    }
    SpreadsheetApp.flush();
    return { deleted: expired.length };
  } catch {
    throw new Error('Usage purge failed; check configuration and table');
  } finally {
    if (locked) lock.releaseLock();
  }
}

// Editor-only rollout after deploying this collector and setting the shared
// server secret. Never enables ingestion or changes retention/sharing.
export function configureUsageBurst() {
  const properties = PropertiesService.getScriptProperties();
  const key = properties.getProperty('USAGE_BATCH_SECRET');
  if (!key || key.length < 32 || key.length > 256)
    throw new Error('Configure the server-only batch secret first');
  retention.parse(propertyNumber(properties, 'USAGE_RETENTION_DAYS'));
  properties.setProperties({
    USAGE_MAX_PER_MINUTE: '20000',
    USAGE_MAX_PER_DAY: '100000',
    USAGE_MAX_ROWS: '100000',
  });
}
