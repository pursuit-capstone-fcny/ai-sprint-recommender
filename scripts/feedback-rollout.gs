// Editor-only setup for Jason's November 2, 2026 rollout.
// Add as a separate Apps Script file alongside the built collector.
// Run prepareFeedbackStorage, verify both workbooks are owner-only and Restricted,
// Add hourly purgeRequests and refreshFeedbackReport triggers in the editor,
// then run activateFeedbackCollection. No web endpoint dispatches these functions.
function prepareFeedbackStorage() {
  const p = PropertiesService.getScriptProperties();
  if (
    SpreadsheetApp.getActiveSpreadsheet().getId() !==
    p.getProperty('CATALOG_SPREADSHEET_ID')
  )
    throw new Error('Wrong collector project');
  const destinations = {
    FEEDBACK_REPORT_SPREADSHEET_ID: 'FCNY - Private video feedback',
    REQUESTS_SPREADSHEET_ID: 'FCNY - Private topic suggestions and demo offers',
  };
  for (const key of Object.keys(destinations)) {
    if (!p.getProperty(key)) {
      const book = SpreadsheetApp.create(destinations[key]);
      p.setProperty(key, book.getId());
    }
    console.log(
      key + ': ' + SpreadsheetApp.openById(p.getProperty(key)).getUrl(),
    );
  }
  // The live analytics app reads the existing source/usage workbook directly.
  if (!p.getProperty('ANALYTICS_SPREADSHEET_ID'))
    p.setProperty(
      'ANALYTICS_SPREADSHEET_ID',
      p.getProperty('USAGE_SPREADSHEET_ID'),
    );
  p.setProperty(
    'REQUESTS_POLICY',
    JSON.stringify({
      version: 'jason-2026-11-02-v1',
      topicPrompt: 'What topic would you like us to cover?',
      demoInvitation: 'Would you like to share a demo?',
      purpose:
        'We use suggestions to plan Sprint videos and demo-offer emails to follow up about recording a demo.',
      access: 'Submissions are private and reviewed by Jason Zeng.',
      owner: 'Jason Zeng',
      retentionDays: 30,
      demoOffers: true,
    }),
  );
}

function activateFeedbackCollection() {
  const p = PropertiesService.getScriptProperties();
  p.setProperties({
    REQUESTS_ACCESS_APPROVED: 'true',
    FEEDBACK_REPORT_ACCESS_APPROVED: 'true',
  });
  initializeRequests();
  purgeRequests();
  refreshFeedbackReport();
  p.setProperties({ FEEDBACK_ENABLED: 'true', REQUESTS_ENABLED: 'true' });
  console.log(
    'Feedback and requests enabled. Verify hourly editor triggers separately.',
  );
}
