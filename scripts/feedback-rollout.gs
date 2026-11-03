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

// Counts only. Do not log submitted text, contact details or usage identifiers.
function verifyFeedbackCollection() {
  const p = PropertiesService.getScriptProperties();
  const usage = SpreadsheetApp.openById(
    p.getProperty('USAGE_SPREADSHEET_ID'),
  ).getSheetByName('Usage');
  const events =
    usage.getLastRow() > 1
      ? usage
          .getRange(2, 3, usage.getLastRow() - 1, 1)
          .getValues()
          .map((row) => JSON.parse(row[0]))
      : [];
  const votes = events.filter((event) => event.type === 'feedback');
  const requests = SpreadsheetApp.openById(
    p.getProperty('REQUESTS_SPREADSHEET_ID'),
  ).getSheetByName('Requests');
  const rows =
    requests.getLastRow() > 1
      ? requests.getRange(2, 1, requests.getLastRow() - 1, 7).getValues()
      : [];
  refreshFeedbackReport();
  console.log(
    JSON.stringify({
      feedbackEnabled: p.getProperty('FEEDBACK_ENABLED'),
      requestsEnabled: p.getProperty('REQUESTS_ENABLED'),
      feedbackRevisions: votes.map((event) => ({
        helpful: event.helpful,
        revision: event.voteRevision,
        team: event.src === 'team',
      })),
      topicCount: rows.filter((row) => row[3] === 'topic').length,
      demoCount: rows.filter((row) => row[3] === 'demo').length,
      topicsHaveNoEmail: rows
        .filter((row) => row[3] === 'topic')
        .every((row) => !row[5]),
      demosHaveEmail: rows
        .filter((row) => row[3] === 'demo')
        .every((row) => !!row[5]),
      allPolicyVersionsMatch: rows.every(
        (row) => row[6] === 'jason-2026-11-02-v1',
      ),
    }),
  );
}
