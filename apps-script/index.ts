/// <reference types="google-apps-script" />
import { catalogVersion, readCatalogWorkbook } from './catalog-sheet';
import { serveCatalog } from './handler';

export {
  clearAnalytics,
  initializeAnalytics,
  refreshAnalytics,
  installAnalyticsTriggers,
  refreshAnalyticsOnEdit,
  analyticsReportLinks,
} from './analytics-sheet';

export { doPost, initializeUsageLog, purgeUsageLog } from './usage-sheet';

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
      read: () => readCatalogWorkbook(openSheet()),
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
      version: catalogVersion,
    });
  } catch {
    body = JSON.stringify({ error: { code: 'CATALOG_UNAVAILABLE' } });
  }
  return ContentService.createTextOutput(body).setMimeType(
    ContentService.MimeType.JSON,
  );
}
