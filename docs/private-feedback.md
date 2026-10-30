# Private usefulness feedback

Implementation for spec #29. Collection is disabled by default. Ali and Eliot
still need to approve question wording, any separate search question, staff access,
retention and ownership through #8. No approval or live delivery is claimed.

## Configuration and delivery

The existing #16 usage collector must be configured and verified first. The
browser currently supports the existing test-only usage deployment, with
`VITE_USAGE_ENABLED=true`, `VITE_USAGE_ENVIRONMENT=test` and
`VITE_USAGE_TEST_URL`. Fixture/demo catalogs do not log usage. Production usage
remains disabled under the existing release gate.

After wording approval, set `VITE_FEEDBACK_ENABLED=true` and
`VITE_FEEDBACK_QUESTION` to the approved text. On the collector, set
`FEEDBACK_ENABLED=true` only after reporting access and collection approval.
Without either browser setting, controls are hidden. Without collector enablement,
feedback is rejected. Legacy search/impression/click events retain schema version 1. Feedback uses schema version 2 with the same allowlisted
catalog and engine context plus `helpful` and positive integer `voteRevision`.

Votes share the existing random page-visit session. Re-searching and route
remounts retain each video's increasing revision in page memory. Reloading starts
a new session. Changing a vote creates a new event with the current search ID,
rank, match type and engine context. Retrying an unconfirmed vote reuses the exact
original event, ID, revision and source context. Controls announce sending, saved
and unconfirmed states, preserve the selected response and provide retry. No
response is called saved without an accepted/duplicate acknowledgement. Buttons
use native keyboard activation and `aria-pressed`. Explicit learner actions may
retry feedback after a temporary rate limit, preserving the event ID and context.
Automatic usage remains suppressed; disabled or full collectors remain stopped.

The usage log stays append-only except its approved retention cleanup. Reporting
reduces the whole retained log to the highest revision per session/video before
excluding team traffic. Reordered delivery cannot restore an older vote.
Conflicting event IDs/revisions fail reporting rather than silently choosing a
response. Feedback does not count as a click or appearance and never changes
ranking. No public response counts are returned.

## Restricted feedback report

Create a separate FCNY reporting workbook with general access **Restricted** and
only the approved staff viewers. Never publish it to the web or grant link-wide
access. Set collector Script Properties:

- `FEEDBACK_REPORT_SPREADSHEET_ID`: restricted report workbook, different from
  catalog, usage and contribution review workbooks.
- `FEEDBACK_REPORT_ACCESS_APPROVED=true`: set only after verifying actual Google
  sharing with a staff account and an unauthorized/signed-out account.
- Existing `USAGE_SPREADSHEET_ID`, `CATALOG_SPREADSHEET_ID` and approved
  `USAGE_RETENTION_DAYS` must be configured.

Run `refreshFeedbackReport` in the Apps Script editor, then
`installFeedbackReporting` to refresh hourly. The `Feedback` tab contains
`youtubeId`, helpful/not-helpful counts, response count and helpful rate. It
contains no event/session/search IDs or free text. It excludes team traffic.
Google workbook permissions enforce access. This first report is an editor-only
Sheet report; it is not exposed in the learner app or the analytics dashboard.
No public `doGet` or POST action dispatches report operations. Report refresh
uses the existing retention cutoff and clears the output on refresh failure.
Monitor trigger failures. To withdraw reporting access, remove staff sharing as
appropriate and clear the Feedback tab; stopping collection alone does not erase
previously retained aggregates.

## Release verification and rollback

Record the tested commit, Cloudflare preview, collector version, restricted
workbook access checks and unresolved failures in spec #29. Verify a keyboard-only
response, changed response and failed/retried delivery. Verify both revisions in
Usage and one effective latest vote in Feedback. Check signed-out and unauthorized
workbook access is denied, and that retention excludes expired events. Check
mobile, 200% zoom and screen-reader announcements before release.

Rollback by disabling `VITE_FEEDBACK_ENABLED` and rebuilding, then disabling
collector `FEEDBACK_ENABLED`. Keep approved retention/report refresh jobs while
retained data exists. Older deployed readers must support retained version-2
feedback before rolling back the collector. The feature never changes ranking.
