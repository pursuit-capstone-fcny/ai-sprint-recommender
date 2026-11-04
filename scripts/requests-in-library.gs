// Editor-only location change. Install the updated collector first.
// Copy the retained queue without deleting its legacy workbook, then switch
// future writes and the existing hourly retention trigger to the source tab.
function useLibraryRequestsTab() {
  var p = PropertiesService.getScriptProperties();
  var sourceId = p.getProperty('CATALOG_SPREADSHEET_ID');
  var sourceUrl = p.getProperty('LIBRARY_SOURCE_SHEET_URL') || '';
  var match = sourceUrl.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]+)/);
  if (!match || match[1] !== sourceId ||
      p.getProperty('USAGE_SPREADSHEET_ID') !== sourceId ||
      SpreadsheetApp.getActiveSpreadsheet().getId() !== sourceId)
    throw new Error('Verify the bound library and usage workbook first.');
  var previousId = p.getProperty('REQUESTS_SPREADSHEET_ID');
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1500)) throw new Error('Requests busy');
  try {
    [sourceId, previousId].filter(Boolean).forEach(function(id) {
      if (DriveApp.getFileById(id).getSharingAccess() !== DriveApp.Access.PRIVATE)
        throw new Error('Request workbooks must stay Restricted.');
    });
    var source = SpreadsheetApp.openById(sourceId);
    if (previousId && previousId !== sourceId) {
      var previous = SpreadsheetApp.openById(previousId).getSheetByName('Requests');
      if (!previous) throw new Error('Missing previous request queue.');
      var expected = previous.getDataRange().getValues();
      var target = source.getSheetByName('Requests');
      if (!target) target = previous.copyTo(source).setName('Requests');
      if (JSON.stringify(target.getDataRange().getValues()) !== JSON.stringify(expected))
        throw new Error('Queues differ; reconcile before switching destinations.');
    }
    p.setProperty('REQUESTS_SPREADSHEET_ID', sourceId);
  } finally {
    lock.releaseLock();
  }
  initializeRequests();
  installRequestRetention();
  var requests = SpreadsheetApp.openById(sourceId).getSheetByName('Requests');
  requests.setColumnWidth(1, 280);
  requests.setColumnWidth(2, 200);
  requests.setColumnWidths(3, 2, 110);
  requests.setColumnWidth(5, 460);
  requests.setColumnWidth(6, 260);
  requests.setColumnWidth(7, 280);
  requests.getRange(1, 1, 1, 7).setFontWeight('bold');
  requests.getRange(2, 5, requests.getMaxRows() - 1, 1).setWrap(true);
  SpreadsheetApp.flush();
  console.log(JSON.stringify({
    sameLibraryWorkbook: p.getProperty('REQUESTS_SPREADSHEET_ID') === sourceId,
    retainedRequests: Math.max(0, requests.getLastRow() - 1),
    retentionDays: JSON.parse(p.getProperty('REQUESTS_POLICY')).retentionDays,
  }));
}
