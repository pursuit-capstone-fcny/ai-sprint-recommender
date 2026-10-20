/// <reference types="google-apps-script" />
import { type Tab, type Workbook } from './catalog';
import { serveCatalog } from './handler';

export function doGet() {
  let body: string;
  try {
    const properties = PropertiesService.getScriptProperties();
    const enabled = properties.getProperty('CATALOG_PUBLIC_ENABLED') === 'true';
    // No spreadsheet access occurs until the public-field/access approval.
    let spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet | undefined;
    const openSheet = () => {
      if (!spreadsheet) {
        const id = properties.getProperty('CATALOG_SPREADSHEET_ID');
        if (!id) throw new Error('Missing catalog configuration');
        spreadsheet = SpreadsheetApp.openById(id);
      }
      return spreadsheet;
    };
    body = serveCatalog({
      enabled,
      lock: LockService.getScriptLock(),
      read: () => {
        const book = openSheet();
        const readTab = (tab: Tab) => {
          const sheet = book.getSheetByName(tab);
          if (!sheet) return [];
          const values: unknown[][] = sheet.getDataRange().getValues();
          // Convert only the public upload-date column. Other Date cells
          // remain invalid, and private columns never reach the parser.
          if (tab === 'Catalog') {
            const index =
              values[0]?.findIndex(
                (value) =>
                  typeof value === 'string' && value.trim() === 'addedAt',
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
        const workbook: Workbook = {
          Catalog: readTab('Catalog'),
          Dictionary: readTab('Dictionary'),
          Synonyms: readTab('Synonyms'),
          'Adjacent tools': readTab('Adjacent tools'),
        };
        return workbook;
      },
      replaceProblems: (problems) => {
        const book = openSheet();
        const sheet =
          book.getSheetByName('Problems') ?? book.insertSheet('Problems');
        const rows = [
          ['Tab', 'Row', 'Field', 'Reason'],
          ...problems.map(({ tab, row, field, reason }) => [
            tab,
            row,
            field,
            reason,
          ]),
        ];
        // Only fixed tab/field names and generated messages are written.
        sheet.clearContents();
        sheet.getRange(1, 1, rows.length, 4).setValues(rows);
        SpreadsheetApp.flush();
      },
      version: (json) => {
        const digest = Utilities.computeDigest(
          Utilities.DigestAlgorithm.SHA_256,
          json,
          Utilities.Charset.UTF_8,
        );
        return `sha256:${digest.map((byte) => (byte & 0xff).toString(16).padStart(2, '0')).join('')}`;
      },
    });
  } catch {
    body = JSON.stringify({ error: { code: 'CATALOG_UNAVAILABLE' } });
  }
  return ContentService.createTextOutput(body).setMimeType(
    ContentService.MimeType.JSON,
  );
}
