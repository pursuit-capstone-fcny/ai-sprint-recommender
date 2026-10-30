/// <reference types="google-apps-script" />
import {
  parsePublicCatalog,
  type PublicCatalog,
} from '../src/contracts/publicCatalog';

export const snapshotHeaders = ['catalogVersion', 'chunkIndex', 'chunkJson'];
export const SNAPSHOT_TABLE = 'Analytics snapshots';
const MAX_SNAPSHOT_ROWS = 500;
const CHUNK_SIZE = 10_000;

export function snapshotRows(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
): unknown[][] {
  if (sheet.getLastRow() > MAX_SNAPSHOT_ROWS + 1 || sheet.getLastColumn() !== 3)
    throw new Error('Invalid snapshot table');
  const rows: unknown[][] = sheet.getDataRange().getValues();
  if (JSON.stringify(rows[0]) !== JSON.stringify(snapshotHeaders))
    throw new Error('Invalid snapshot header');
  return rows.slice(1);
}

export function readAnalyticsSnapshots(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
): PublicCatalog[] {
  const grouped = new Map<string, string[]>();
  for (const row of snapshotRows(sheet)) {
    const [version, index, value] = row;
    if (
      typeof version !== 'string' ||
      typeof index !== 'number' ||
      !Number.isSafeInteger(index) ||
      index < 0 ||
      typeof value !== 'string' ||
      value.length > CHUNK_SIZE * 2 + 2
    )
      throw new Error('Invalid snapshot chunk');
    const chunk: unknown = JSON.parse(value);
    if (typeof chunk !== 'string' || chunk.length > CHUNK_SIZE)
      throw new Error('Invalid snapshot chunk');
    const chunks = grouped.get(version) ?? [];
    if (index !== chunks.length) throw new Error('Invalid snapshot order');
    chunks.push(chunk);
    grouped.set(version, chunks);
  }
  return [...grouped].map(([version, chunks]) => {
    const catalog = parsePublicCatalog(JSON.parse(chunks.join('')));
    if (catalog.catalogVersion !== version)
      throw new Error('Invalid snapshot version');
    return catalog;
  });
}

// Called under the same script lock as ingestion or refresh. Stores public metadata only.
export function captureAnalyticsCatalog(
  book: GoogleAppsScript.Spreadsheet.Spreadsheet,
  catalog: PublicCatalog,
) {
  const sheet = book.getSheetByName(SNAPSHOT_TABLE);
  if (!sheet) throw new Error('Initialize analytics snapshots first');
  const existing = snapshotRows(sheet);
  if (existing.some((row) => row[0] === catalog.catalogVersion)) return;
  const json = JSON.stringify(parsePublicCatalog(catalog));
  const rows: unknown[][] = [];
  for (let index = 0; index < json.length; index += CHUNK_SIZE) {
    // Encoding each chunk as a JSON string prevents formula interpretation, even mid-string.
    rows.push([
      catalog.catalogVersion,
      rows.length,
      JSON.stringify(json.slice(index, index + CHUNK_SIZE)),
    ]);
  }
  if (existing.length + rows.length > MAX_SNAPSHOT_ROWS)
    throw new Error('Snapshot capacity reached');
  const last = sheet.getLastRow();
  if (last + rows.length > sheet.getMaxRows())
    sheet.insertRowsAfter(
      sheet.getMaxRows(),
      last + rows.length - sheet.getMaxRows(),
    );
  sheet.getRange(last + 1, 1, rows.length, 3).setValues(rows);
  SpreadsheetApp.flush();
}

export function pruneAnalyticsSnapshots(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  versions: Set<string>,
) {
  const rows = snapshotRows(sheet).filter(
    (row) => typeof row[0] === 'string' && versions.has(row[0]),
  );
  sheet.clearContents();
  sheet
    .getRange(1, 1, rows.length + 1, 3)
    .setValues([snapshotHeaders, ...rows]);
}
