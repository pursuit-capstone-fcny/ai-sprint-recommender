/// <reference types="google-apps-script" />
import { parseSheetLink } from '../src/admin/sheetLink';
import { publishedCatalog } from './published-library';
import { initializeUsageLog } from './usage-sheet';
import { requirePrivateLibraryWorkbook } from './source-workbook';
import { InstructionFormSchema } from '../src/contracts/publicCatalog';
import {
  TRACKER_TAB,
  TRACKER_HEADER_ROW,
  trackerColumns,
  planTrackerMigration,
  buildTrackerCatalog,
  type TrackerRow,
} from './tracker-catalog';

export class TrackerSourceError extends Error {}

function checkPreviousUsage(
  properties: GoogleAppsScript.Properties.Properties,
  targetId: string,
) {
  const previousId = properties.getProperty('USAGE_SPREADSHEET_ID');
  if (!previousId || previousId === targetId) return;
  let previous: GoogleAppsScript.Spreadsheet.Sheet | null;
  try {
    previous = SpreadsheetApp.openById(previousId).getSheetByName('Usage');
  } catch {
    throw new Error(
      'Cannot check the previous activity workbook. Preserve its collector and retention cleanup before switching.',
    );
  }
  if (previous && previous.getLastRow() > 1)
    throw new Error(
      'The previous activity workbook still has records. Keep its collector and retention cleanup configured until they expire, or use a separate collector project for this tracker.',
    );
}

export function readTracker(
  book: GoogleAppsScript.Spreadsheet.Spreadsheet,
  setup = false,
) {
  const sheet = book.getSheetByName(TRACKER_TAB);
  if (!sheet || sheet.getLastRow() > 5004 || sheet.getLastColumn() > 50)
    throw new TrackerSourceError(
      'Video Tracker is missing or exceeds publishing limits.',
    );
  const width = sheet.getLastColumn();
  const names: unknown[] = sheet
    .getRange(TRACKER_HEADER_ROW, 1, 1, width)
    .getValues()[0];
  const positions = new Map<string, number>();
  for (const name of trackerColumns) {
    const matches = names.flatMap((value, index) =>
      value === name ? [index + 1] : [],
    );
    const optional =
      ['Task keywords', 'Metadata status', 'Instruction format'].includes(
        name,
      ) &&
      (setup || name === 'Instruction format');
    if (matches.length !== 1 && !(optional && matches.length === 0))
      throw new TrackerSourceError(
        `Video Tracker row 4: ${name} header is missing or duplicated.`,
      );
    if (matches.length) positions.set(name, matches[0]);
  }
  const height = Math.max(0, sheet.getLastRow() - TRACKER_HEADER_ROW);
  // Never read source files, staff details, private links or review notes.
  const columns = trackerColumns.map((name) => {
    const position = positions.get(name);
    return height && position
      ? sheet.getRange(TRACKER_HEADER_ROW + 1, position, height, 1).getValues()
      : [];
  });
  const rows: TrackerRow[] = Array.from({ length: height }, (_, i) => ({
    row: TRACKER_HEADER_ROW + 1 + i,
    cells: Object.fromEntries(
      trackerColumns.map((name, j) => [name, columns[j][i]?.[0] ?? '']),
    ) as TrackerRow['cells'],
  }));
  return { sheet, rows, positions, width };
}

// Editor-only setup. It neither publishes content nor enables usage collection.
export function initializeTrackerFromPublished() {
  const properties = PropertiesService.getScriptProperties();
  const book = SpreadsheetApp.getActiveSpreadsheet();
  if (
    !book ||
    book.getId() !==
      parseSheetLink(properties.getProperty('LIBRARY_SOURCE_SHEET_URL'))
  )
    throw new Error('Run setup from the configured source workbook.');
  requirePrivateLibraryWorkbook(book.getId());
  const retention = Number(properties.getProperty('USAGE_RETENTION_DAYS'));
  if (!Number.isInteger(retention) || retention < 1 || retention > 365)
    throw new Error(
      'Configure the approved usage retention before tracker setup.',
    );
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1500)) throw new Error('Library setup is busy.');
  let result: { catalogVersion: string; updatedCells: number };
  try {
    // The existing purge trigger follows USAGE_SPREADSHEET_ID. Redirecting it
    // while rows remain would abandon their approved retention cleanup.
    checkPreviousUsage(properties, book.getId());
    const { sheet, rows, positions, width } = readTracker(book, true);
    const baseline = publishedCatalog();
    const plan = planTrackerMigration(rows, baseline);
    // Check all existing dropdowns before changing any cell or adding headers.
    const writes = plan.updates.map((update) => {
      let value = update.value;
      const position = positions.get(update.field);
      const rule = position
        ? sheet.getRange(update.row, position, 1, 1).getDataValidation()
        : null;
      if (
        rule &&
        rule.getCriteriaType() ===
          SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST
      ) {
        const allowed = rule.getCriteriaValues()[0] as string[];
        const option = allowed.find((term) => term.trim() === value.trim());
        if (value && !option)
          throw new Error(
            `Video Tracker row ${update.row}: reconcile the ${update.field} dropdown before setup.`,
          );
        value = option ?? value;
      }
      return {
        ...update,
        value: /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value,
      };
    });
    let next = width;
    for (const name of [
      'Task keywords',
      'Metadata status',
      'Instruction format',
    ]) {
      if (!positions.has(name)) {
        next++;
        if (next > sheet.getMaxColumns())
          sheet.insertColumnsAfter(sheet.getMaxColumns(), 1);
        sheet.getRange(TRACKER_HEADER_ROW, next, 1, 1).setValues([[name]]);
        positions.set(name, next);
      }
      sheet.setColumnWidth(
        positions.get(name)!,
        name === 'Task keywords' ? 370 : 180,
      );
      sheet
        .getRange(TRACKER_HEADER_ROW, positions.get(name)!, 1, 1)
        .setFontWeight('bold')
        .setWrap(true);
    }
    for (const [name, values] of [
      ['Metadata status', ['Draft', 'Ready']],
      ['Instruction format', InstructionFormSchema.options],
    ] as const) {
      sheet
        .getRange(
          TRACKER_HEADER_ROW + 1,
          positions.get(name)!,
          sheet.getMaxRows() - TRACKER_HEADER_ROW,
          1,
        )
        .setDataValidation(
          SpreadsheetApp.newDataValidation()
            .requireValueInList([...values], true)
            .setAllowInvalid(false)
            .build(),
        );
    }
    // Ready markers are written last. An interrupted setup cannot publish partly
    // migrated rows. All values are literals and existing formatting is retained.
    for (const update of writes.filter((u) => u.field !== 'Metadata status')) {
      const range = sheet.getRange(
        update.row,
        positions.get(update.field)!,
        1,
        1,
      );
      range.setValues([[update.value]]);
    }
    SpreadsheetApp.flush();
    for (const update of writes.filter((u) => u.field === 'Metadata status'))
      sheet
        .getRange(update.row, positions.get(update.field)!, 1, 1)
        .setValues([[update.value]]);
    SpreadsheetApp.flush();
    const rebuilt = buildTrackerCatalog(readTracker(book).rows, baseline);
    if (
      !rebuilt.catalog ||
      rebuilt.catalog.catalogVersion !== baseline.catalogVersion
    )
      throw new Error(
        'Tracker changed during setup. Review the source before publishing.',
      );
    properties.setProperty('LIBRARY_SOURCE_FORMAT', 'tracker');
    properties.setProperty('CATALOG_SPREADSHEET_ID', book.getId());
    properties.setProperty('USAGE_SPREADSHEET_ID', book.getId());
    result = {
      catalogVersion: plan.catalog.catalogVersion,
      updatedCells: plan.updates.length,
    };
  } finally {
    lock.releaseLock();
  }
  // This initializer acquires its own lock. Existing retention limits and enable
  // flags are preserved; no rows are copied from another environment.
  initializeUsageLog();
  return result;
}
