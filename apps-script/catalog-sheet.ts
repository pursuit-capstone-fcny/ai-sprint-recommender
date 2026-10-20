/// <reference types="google-apps-script" />
import { type Tab, type Workbook } from './catalog';

export function readCatalogWorkbook(
  book: GoogleAppsScript.Spreadsheet.Spreadsheet,
): Workbook {
  const readTab = (tab: Tab) => {
    const sheet = book.getSheetByName(tab);
    if (!sheet) return [];
    const values: unknown[][] = sheet.getDataRange().getValues();
    // Only the public upload-date column accepts Sheet Date cells.
    if (tab === 'Catalog') {
      const index =
        values[0]?.findIndex(
          (value) => typeof value === 'string' && value.trim() === 'addedAt',
        ) ?? -1;
      if (index >= 0) {
        values.slice(1).forEach((row) => {
          const date = row[index];
          if (date instanceof Date && Number.isFinite(date.getTime())) {
            row[index] = Utilities.formatDate(
              date,
              book.getSpreadsheetTimeZone(),
              'yyyy-MM-dd',
            );
          }
        });
      }
    }
    return values;
  };
  return {
    Catalog: readTab('Catalog'),
    Dictionary: readTab('Dictionary'),
    Synonyms: readTab('Synonyms'),
    'Adjacent tools': readTab('Adjacent tools'),
  };
}

export function catalogVersion(json: string): string {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    json,
    Utilities.Charset.UTF_8,
  );
  return `sha256:${digest.map((byte) => (byte & 0xff).toString(16).padStart(2, '0')).join('')}`;
}
