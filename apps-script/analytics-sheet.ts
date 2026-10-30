/// <reference types="google-apps-script" />
import { z } from 'zod';
import {
  AcceptedUsageSchema,
  buildAnalyticsReport,
  ReportFilterSchema,
  type AcceptedUsage,
} from '../src/analytics/report';
import {
  publishedCatalog,
  publishedHistory,
  configuredLibrarySheet,
} from './published-library';
import { MAX_USAGE_ROWS, usageBodyBytes } from './usage';
import { usageHeaders } from './usage-sheet';
import {
  captureAnalyticsCatalog,
  pruneAnalyticsSnapshots,
  SNAPSHOT_TABLE,
  snapshotHeaders,
} from './analytics-snapshots';

type Book = GoogleAppsScript.Spreadsheet.Spreadsheet;
type Sheet = GoogleAppsScript.Spreadsheet.Sheet;
type Cell = string | number | boolean;
const DAY = 86_400_000;
const tableHeaders = {
  'Analytics facts': [
    'activeInventory',
    'entity',
    'dateKey',
    'source',
    'mode',
    'youtubeId',
    'title',
    'category',
    'tag',
    'appearances',
    'embedClicks',
    'youtubeClicks',
    'directViews',
    'directEmbedClicks',
    'directYoutubeClicks',
    'searches',
  ],
  'Analytics videos': [
    'youtubeId',
    'title',
    'appearances',
    'embedClicks',
    'youtubeClicks',
    'directViews',
    'directEmbedClicks',
    'directYoutubeClicks',
  ],
  'Analytics tags': [
    'category',
    'tag',
    'appearances',
    'embedClicks',
    'youtubeClicks',
    'directViews',
    'directEmbedClicks',
    'directYoutubeClicks',
    'searches',
  ],
  'Analytics associations': [
    'youtubeId',
    'title',
    'category',
    'tag',
    'appearances',
    'embedClicks',
    'youtubeClicks',
  ],
  'Analytics status': ['metric', 'value'],
  'Analytics filters': ['filter', 'value'],
};
const configSchema = z
  .strictObject({
    catalogId: z.string().min(1),
    usageId: z.string().min(1),
    reportId: z.string().min(1),
    environment: z.enum(['test', 'production']),
    usageEnvironment: z.enum(['test', 'production']),
    retentionDays: z.coerce.number().int().min(1).max(365),
    owner: z.string().trim().min(1).max(200),
  })
  .refine(
    (c) =>
      c.reportId !== c.usageId &&
      c.reportId !== c.catalogId &&
      c.environment === c.usageEnvironment,
  );

function configuration(requireEnabled = true) {
  const p = PropertiesService.getScriptProperties();
  if (
    (requireEnabled && p.getProperty('ANALYTICS_ENABLED') !== 'true') ||
    p.getProperty('ANALYTICS_ACCESS_APPROVED') !== 'true'
  )
    throw new Error('Analytics is not configured');
  return configSchema.parse({
    catalogId: p.getProperty('CATALOG_SPREADSHEET_ID'),
    usageId: p.getProperty('USAGE_SPREADSHEET_ID'),
    reportId: p.getProperty('ANALYTICS_SPREADSHEET_ID'),
    environment: p.getProperty('ANALYTICS_ENVIRONMENT'),
    usageEnvironment: p.getProperty('USAGE_ENVIRONMENT'),
    retentionDays: p.getProperty('USAGE_RETENTION_DAYS'),
    owner: p.getProperty('ANALYTICS_OWNER'),
  });
}

// Never turn a title/tag into an executable spreadsheet formula.
export function literalCell(value: Cell): Cell {
  return typeof value === 'string' && /^[\s]*[=+\-@]/.test(value)
    ? `'${value}`
    : value;
}
function verify(sheet: Sheet, headers: string[]) {
  if (
    sheet.getLastColumn() !== headers.length ||
    JSON.stringify(sheet.getRange(1, 1, 1, headers.length).getValues()[0]) !==
      JSON.stringify(headers)
  )
    throw new Error('Unexpected analytics table');
}
function write(sheet: Sheet, headers: string[], rows: Cell[][]) {
  const values = [headers, ...rows].map((row) => row.map(literalCell));
  if (values.length > 100_001)
    throw new Error('Analytics output capacity reached');
  if (sheet.getMaxRows() < values.length)
    sheet.insertRowsAfter(
      sheet.getMaxRows(),
      values.length - sheet.getMaxRows(),
    );
  if (sheet.getMaxColumns() < headers.length)
    sheet.insertColumnsAfter(
      sheet.getMaxColumns(),
      headers.length - sheet.getMaxColumns(),
    );
  sheet.clearContents();
  sheet.getRange(1, 1, values.length, headers.length).setValues(values);
  sheet.setFrozenRows(1);
}
function table(book: Book, name: keyof typeof tableHeaders, create = false) {
  let sheet = book.getSheetByName(name);
  if (!sheet && create) sheet = book.insertSheet(name);
  if (!sheet) throw new Error('Initialize analytics first');
  if (create && sheet.getLastRow() === 0) write(sheet, tableHeaders[name], []);
  verify(sheet, tableHeaders[name]);
  return sheet;
}
function currentCatalog(id: string) {
  if (id !== configuredLibrarySheet())
    throw new Error('Catalog source does not match publisher');
  return publishedCatalog();
}
const receiptDate = (value: string) =>
  Utilities.formatDate(new Date(value), 'America/New_York', 'yyyy-MM-dd');

export function readAnalyticsRecords(
  sheet: Sheet,
  now: Date,
  retentionDays: number,
): AcceptedUsage[] {
  if (
    sheet.getLastRow() > MAX_USAGE_ROWS + 1 ||
    sheet.getLastColumn() !== 3 ||
    JSON.stringify(sheet.getRange(1, 1, 1, 3).getValues()[0]) !==
      JSON.stringify(usageHeaders)
  )
    throw new Error('Invalid usage table');
  const rows: unknown[][] =
    sheet.getLastRow() > 1
      ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues()
      : [];
  let totalBytes = 0;
  const records: AcceptedUsage[] = [];
  for (const [eventId, receivedAt, json] of rows) {
    const received = z.iso.datetime().parse(receivedAt);
    if (Date.parse(received) > now.getTime())
      throw new Error('Future usage receipt');
    if (Date.parse(received) <= now.getTime() - retentionDays * DAY) continue;
    if (typeof json !== 'string' || json.length > 16_384)
      throw new Error('Invalid usage body');
    const bytes = usageBodyBytes(json);
    if (bytes > 16_384) throw new Error('Invalid usage body');
    totalBytes += bytes;
    if (totalBytes > 8 * 1024 * 1024)
      throw new Error('Analytics input capacity reached');
    const record = AcceptedUsageSchema.parse({
      receivedAt: received,
      event: JSON.parse(json),
    });
    if (record.event.eventId !== eventId)
      throw new Error('Invalid event identifier');
    records.push(record);
  }
  return records;
}

function filters(book: Book, now: Date, retentionDays: number) {
  const sheet = table(book, 'Analytics filters');
  if (sheet.getLastRow() !== 10) throw new Error('Invalid analytics filters');
  const rows: unknown[][] = sheet.getRange(2, 1, 9, 2).getValues();
  const values = Object.fromEntries(rows);
  if (
    Object.keys(values).length !== 9 ||
    rows.some((row) => typeof row[0] !== 'string')
  )
    throw new Error('Invalid analytics filters');
  return ReportFilterSchema.parse({
    ...values,
    startDate:
      values.startDate === 'auto'
        ? receiptDate(
            new Date(now.getTime() - retentionDays * DAY).toISOString(),
          )
        : values.startDate,
    endDate:
      values.endDate === 'auto'
        ? receiptDate(now.toISOString())
        : values.endDate,
    includeTeam:
      values.includeTeam === true || values.includeTeam === 'true'
        ? true
        : values.includeTeam === false || values.includeTeam === 'false'
          ? false
          : values.includeTeam,
    youtubeId: values.youtubeId || undefined,
    category: values.category || undefined,
    tag: values.tag || undefined,
  });
}

export function initializeAnalytics() {
  const c = configuration();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1500)) throw new Error('Analytics busy');
  try {
    const usage = SpreadsheetApp.openById(c.usageId);
    let snapshots = usage.getSheetByName(SNAPSHOT_TABLE);
    if (!snapshots) snapshots = usage.insertSheet(SNAPSHOT_TABLE);
    if (snapshots.getLastRow() === 0) write(snapshots, snapshotHeaders, []);
    const report = SpreadsheetApp.openById(c.reportId);
    for (const name of Object.keys(
      tableHeaders,
    ) as (keyof typeof tableHeaders)[])
      table(report, name, true);
    const control = table(report, 'Analytics filters');
    if (control.getLastRow() === 1)
      write(control, tableHeaders['Analytics filters'], [
        ['startDate', 'auto'],
        ['endDate', 'auto'],
        ['source', 'all'],
        ['includeTeam', false],
        ['mode', 'all'],
        ['youtubeId', ''],
        ['category', ''],
        ['tag', ''],
        ['activity', 'all'],
      ]);
    control.getRange(2, 2, 9, 1).setNumberFormat('@');
    captureAnalyticsCatalog(usage, currentCatalog(c.catalogId));
    SpreadsheetApp.flush();
  } catch {
    throw new Error(
      'Analytics initialization failed; check configuration and owned tables',
    );
  } finally {
    lock.releaseLock();
  }
}

export function refreshAnalytics() {
  const c = configuration();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1500)) throw new Error('Analytics busy');
  let report: Book | undefined;
  try {
    const now = new Date();
    report = SpreadsheetApp.openById(c.reportId);
    // Validate all owned tables before replacing any content.
    for (const name of Object.keys(
      tableHeaders,
    ) as (keyof typeof tableHeaders)[])
      table(report, name);
    const selected = filters(report, now, c.retentionDays);
    const usage = SpreadsheetApp.openById(c.usageId);
    const log = usage.getSheetByName('Usage');
    const snapshots = usage.getSheetByName(SNAPSHOT_TABLE);
    if (!log || !snapshots) throw new Error('Initialize analytics first');
    const records = readAnalyticsRecords(log, now, c.retentionDays);
    const current = currentCatalog(c.catalogId);
    const versions = new Set([
      current.catalogVersion,
      ...records.map((record) => record.event.catalogVersion),
    ]);
    pruneAnalyticsSnapshots(snapshots, versions);
    captureAnalyticsCatalog(usage, current);
    const publishedSnapshots = publishedHistory(
      records.map((record) => record.event.catalogVersion),
      current,
    );
    const result = buildAnalyticsReport(
      {
        records,
        current,
        snapshots: publishedSnapshots,
        filter: selected,
      },
      receiptDate,
    );
    const factsFilter = ReportFilterSchema.parse({
      startDate: receiptDate(
        new Date(now.getTime() - c.retentionDays * DAY).toISOString(),
      ),
      endDate: receiptDate(now.toISOString()),
      includeTeam: true,
    });
    const allData = buildAnalyticsReport(
      {
        records,
        current,
        snapshots: publishedSnapshots,
        filter: factsFilter,
      },
      receiptDate,
    );
    const datasets = {
      'Analytics facts': allData.facts,
      'Analytics videos': result.videos,
      'Analytics tags': result.tags,
      'Analytics associations': result.associations,
    };
    const generationId = Utilities.getUuid();
    write(table(report, 'Analytics status'), tableHeaders['Analytics status'], [
      ['state', 'refreshing'],
      ['generationId', generationId],
      ['attemptedAt', now.toISOString()],
      [
        'lastSuccessAt',
        PropertiesService.getScriptProperties().getProperty(
          'ANALYTICS_LAST_SUCCESS_AT',
        ) ?? 'unavailable',
      ],
    ]);
    SpreadsheetApp.flush();
    for (const [name, values] of Object.entries(datasets)) {
      const label = name as keyof typeof datasets;
      const headers = tableHeaders[label];
      write(
        table(report, label),
        headers,
        values.map((value) =>
          headers.map((header) => {
            const cell: unknown = Reflect.get(value, header);
            if (
              typeof cell !== 'string' &&
              typeof cell !== 'number' &&
              typeof cell !== 'boolean'
            )
              throw new Error('Invalid analytics output');
            return cell;
          }),
        ),
      );
    }
    const refreshedAt = now.toISOString();
    write(table(report, 'Analytics status'), tableHeaders['Analytics status'], [
      ['state', allData.diagnostics.selectedEvents ? 'ready' : 'empty'],
      ['catalogVersion', current.catalogVersion],
      ['generationId', generationId],
      ['lastSuccessAt', refreshedAt],
      ['attemptedAt', refreshedAt],
      ['startDate', factsFilter.startDate],
      ['selectionStartDate', selected.startDate],
      ['endDate', factsFilter.endDate],
      ['selectionEndDate', selected.endDate],
      ['source', factsFilter.source],
      ['selectionSource', selected.source],
      ['mode', factsFilter.mode],
      ['selectionMode', selected.mode],
      ['includeTeam', factsFilter.includeTeam],
      ['selectionIncludeTeam', selected.includeTeam],
      ['selectionState', result.diagnostics.selectedEvents ? 'ready' : 'empty'],
      ['selectionSelectedEvents', result.diagnostics.selectedEvents],
      ['selectionUnmappedEvents', result.diagnostics.unmappedEvents],
      ['environment', c.environment],
      ['retentionDays', c.retentionDays],
      ['staleAfterHours', 26],
      ['staleAt', new Date(now.getTime() + 26 * 3_600_000).toISOString()],
      ['percentWatched', 'unavailable'],
      ...Object.entries(allData.diagnostics).map(([name, value]): Cell[] => [
        name,
        value ?? 'unavailable',
      ]),
    ]);
    SpreadsheetApp.flush();
    PropertiesService.getScriptProperties().setProperty(
      'ANALYTICS_LAST_SUCCESS_AT',
      refreshedAt,
    );
    return {
      state: allData.diagnostics.selectedEvents ? 'ready' : 'empty',
      refreshedAt,
    };
  } catch {
    if (report) {
      const failedReport = report;
      const attemptCleanup = (operation: () => void) => {
        try {
          operation();
        } catch {
          console.info('analytics-refresh', 'cleanup-unavailable');
        }
      };
      // A damaged table must not prevent clearing the remaining owned datasets.
      for (const name of [
        'Analytics facts',
        'Analytics videos',
        'Analytics tags',
        'Analytics associations',
      ] as const) {
        attemptCleanup(() =>
          write(table(failedReport, name), tableHeaders[name], []),
        );
      }
      attemptCleanup(() =>
        write(
          table(failedReport, 'Analytics status'),
          tableHeaders['Analytics status'],
          [
            ['state', 'error'],
            ['attemptedAt', new Date().toISOString()],
            [
              'lastSuccessAt',
              PropertiesService.getScriptProperties().getProperty(
                'ANALYTICS_LAST_SUCCESS_AT',
              ) ?? 'unavailable',
            ],
          ],
        ),
      );
      attemptCleanup(() => SpreadsheetApp.flush());
    }
    throw new Error(
      'Analytics refresh failed; inspect configuration and tables, not raw execution logs',
    );
  } finally {
    lock.releaseLock();
  }
}

// These editor-only helpers are never routed through public doGet/doPost.
export function installAnalyticsTriggers() {
  const c = configuration();
  refreshAnalytics();
  const existing = ScriptApp.getProjectTriggers();
  if (
    !existing.some(
      (trigger) => trigger.getHandlerFunction() === 'refreshAnalytics',
    )
  )
    ScriptApp.newTrigger('refreshAnalytics')
      .timeBased()
      .everyDays(1)
      .atHour(3)
      .inTimezone('America/New_York')
      .create();
  const editTriggers = existing.filter(
    (trigger) => trigger.getHandlerFunction() === 'refreshAnalyticsOnEdit',
  );
  const matchingEdit = editTriggers.some(
    (trigger) => trigger.getTriggerSourceId() === c.reportId,
  );
  for (const trigger of editTriggers)
    if (trigger.getTriggerSourceId() !== c.reportId)
      ScriptApp.deleteTrigger(trigger);
  if (!matchingEdit)
    ScriptApp.newTrigger('refreshAnalyticsOnEdit')
      .forSpreadsheet(c.reportId)
      .onEdit()
      .create();
}
export function refreshAnalyticsOnEdit(
  event?: GoogleAppsScript.Events.SheetsOnEdit,
) {
  if (!event) return;
  const c = configuration();
  if (
    event.source.getId() === c.reportId &&
    event.range.getSheet().getName() === 'Analytics filters'
  )
    refreshAnalytics();
}
export function analyticsReportLinks() {
  const c = configuration();
  const book = SpreadsheetApp.openById(c.reportId);
  return (
    [
      'Analytics facts',
      'Analytics videos',
      'Analytics tags',
      'Analytics associations',
    ] as const
  ).map((name) => {
    const sheet = table(book, name);
    const params = {
      'ds.connector': 'googleSheets',
      'ds.spreadsheetId': c.reportId,
      'ds.worksheetId': String(sheet.getSheetId()),
      'ds.hasHeader': 'true',
      'r.reportName': `FCNY ${name}`,
    };
    return {
      table: name,
      url: `https://lookerstudio.google.com/reporting/create?${Object.entries(
        params,
      )
        .map(
          ([key, value]) =>
            `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
        )
        .join('&')}`,
    };
  });
}

export function clearAnalytics() {
  const c = configuration(false);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1500)) throw new Error('Analytics busy');
  try {
    const report = SpreadsheetApp.openById(c.reportId);
    let failed = false;
    const attempt = (operation: () => void) => {
      try {
        operation();
      } catch {
        failed = true;
      }
    };
    attempt(() =>
      write(
        table(report, 'Analytics status'),
        tableHeaders['Analytics status'],
        [
          ['state', 'refreshing'],
          ['operation', 'clear'],
          ['generationId', Utilities.getUuid()],
          ['attemptedAt', new Date().toISOString()],
        ],
      ),
    );
    attempt(() => SpreadsheetApp.flush());
    for (const name of [
      'Analytics facts',
      'Analytics videos',
      'Analytics tags',
      'Analytics associations',
    ] as const) {
      attempt(() => write(table(report, name), tableHeaders[name], []));
    }
    attempt(() =>
      write(
        table(report, 'Analytics status'),
        tableHeaders['Analytics status'],
        [
          ['state', failed ? 'error' : 'cleared'],
          ['operation', 'clear'],
          ['attemptedAt', new Date().toISOString()],
        ],
      ),
    );
    attempt(() => SpreadsheetApp.flush());
    if (failed) throw new Error('Incomplete analytics clearing');
  } catch {
    throw new Error('Analytics clearing failed; verify owned tables');
  } finally {
    lock.releaseLock();
  }
}
