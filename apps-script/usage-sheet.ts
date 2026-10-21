/// <reference types="google-apps-script" />
import { z } from 'zod';
import { buildPublicCatalog } from './catalog';
import { catalogVersion, readCatalogWorkbook } from './catalog-sheet';
import {
  expiredUsageRows,
  MAX_USAGE_ROWS,
  receiveUsage,
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
  let body: string;
  let enabled = false;
  try {
    const properties = PropertiesService.getScriptProperties();
    enabled = properties.getProperty('USAGE_LOGGING_ENABLED') === 'true';
    let sheet: GoogleAppsScript.Spreadsheet.Sheet | undefined;
    const openSheet = () => {
      if (!sheet) {
        sheet = usageBook(properties).getSheetByName('Usage') ?? undefined;
        if (!sheet) throw new Error('Missing usage table');
      }
      return sheet;
    };
    body = receiveUsage(event?.postData, {
      enabled,
      policy: () => readPolicy(properties),
      now: () => new Date(),
      lock: LockService.getScriptLock(),
      records: () => readRecords(openSheet()),
      catalog: () => {
        const id = properties.getProperty('CATALOG_SPREADSHEET_ID');
        if (!id) throw new Error('Missing catalog configuration');
        const { catalog } = buildPublicCatalog(
          readCatalogWorkbook(SpreadsheetApp.openById(id)),
          catalogVersion,
        );
        if (!catalog) throw new Error('Invalid catalog configuration');
        return catalog;
      },
      append: (usage, receivedAt) => {
        const target = openSheet();
        const nextRow = target.getLastRow() + 1;
        const gridRows = target.getMaxRows();
        if (nextRow > gridRows) {
          target.insertRowsAfter(
            gridRows,
            Math.min(100, MAX_USAGE_ROWS + 1 - gridRows),
          );
        }
        // JSON always starts with "{". No user string becomes a cell formula.
        target
          .getRange(nextRow, 1, 1, 3)
          .setNumberFormat('@')
          .setValues([[usage.eventId, receivedAt, JSON.stringify(usage)]]);
        SpreadsheetApp.flush();
      },
    });
  } catch {
    body = usageError('USAGE_UNAVAILABLE');
  }
  // Fixed outcomes only, never request bodies, IDs, tags or exception text.
  if (enabled) console.info('usage-post', body);
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
