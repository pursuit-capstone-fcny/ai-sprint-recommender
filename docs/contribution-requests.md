# Topic requests and demo offers

Implementation for spec #26. Collection is disabled by default. The
[November 2 rollout](live-feedback-requests.md) records Jason's approved prompts,
consented demo email, private review, 30-day retention and weekly ownership.
The November 3 location correction uses a tab in the library workbook, as Eliot
requested and Jason authorized. This does not assert additional client approval.

## Configuration and isolation

Use a `Requests` tab in the configured library workbook, alongside `Video Tracker`
and `Usage`. The entire workbook must have general access **Restricted**, with
only the named staff who may review requests and demo email addresses. The
collector checks sharing on setup, submission and cleanup. Verify unauthorized
and signed-out access is denied. Requests have no session/search identifiers and
never enter usage events, catalog snapshots or analytics. Only fixed
acknowledgements leave the request collector, and it never logs request bodies
or exception contents.

Explicitly configured separate Restricted review workbooks remain supported for
existing deployments. Other catalog/usage/report destinations are rejected
unless they are the configured library workbook.

Set collector Script Properties:

- `LIBRARY_SOURCE_SHEET_URL`: the configured Restricted library workbook.
- `REQUESTS_SPREADSHEET_ID`: set to that workbook's ID. If absent, the configured
  library workbook is the default. An explicit legacy review destination takes
  precedence until the owner switches it.
- `REQUESTS_ACCESS_APPROVED=true`: records completion of the actual sharing check.
- `REQUESTS_POLICY`: approved policy JSON described below.
- Existing `CATALOG_SPREADSHEET_ID`, `USAGE_SPREADSHEET_ID` and
  `ANALYTICS_SPREADSHEET_ID`: identify existing data/report destinations.
- `REQUESTS_ENABLED=true`: set last, after initialization and retention setup.

The policy has `version`, `topicPrompt`, `demoInvitation`, `purpose`, `access`,
`owner`, `retentionDays` and `demoOffers`. Text values are required and must state
approved wording, purpose, access and review owner. Retention is 1–365 days.
`demoOffers=false` rejects demo submissions at the collector and hides the contact
fields in the form. A demo offer requires only email and explicit consent after
the notice. Topics cannot carry contact or consent fields. There are no uploads
or automatic catalog additions.

For an existing separate request queue, deploy the updated collector source,
then add [requests-in-library.gs](../scripts/requests-in-library.gs) as a separate
editor-only script file and run `useLibraryRequestsTab`. It verifies the bound
source/usage IDs and Restricted sharing, copies the retained queue with its
statuses and validation, checks the copy before switching destinations, and
keeps the prior workbook for rollback. A conflicting existing `Requests` tab
stops migration without switching. It runs initialization and the existing
request-retention installer; it does not change consent, policy or collection
flags. The previous queue is a private archive; keep its original retention
deadline and remove it under the approved retention policy after rollback is no
longer needed. Historical test copies contain fictional submissions only.

Run `initializeRequests` in the editor. It creates the `Requests` table with
`requestId`, `receivedAt`, `status`, `kind`, `topic`, `email`, `policyVersion`.
Sheet values are written as text with formula prefixes escaped. Statuses are
new, reviewing, accepted, declined, duplicate or spam. Then run
`installRequestRetention`; it immediately purges expired entries and installs an
hourly purge. Cleanup continues with collection disabled. It deletes the whole
expired entry, including contact and topic, using the currently approved policy.
Monitor trigger failures and confirm deletions. The policy retention applies to
all retained entries, including entries collected under a prior version.

Set browser `VITE_REQUESTS_ENABLED=true` and `VITE_REQUESTS_CONFIG` to JSON with
`endpoint` and `policy`. The endpoint is the existing Apps Script `/exec` URL;
the policy must match the collector. Never put workbook IDs or credentials in
browser configuration. Only public notice text is in this configuration. An
example shape, using deliberately fictional wording, is:

```json
{
  "endpoint": "https://script.google.com/macros/s/fictional/exec",
  "policy": {
    "version": "fictional-v1",
    "topicPrompt": "Fictional missing-topic question",
    "demoInvitation": "Fictional demo invitation",
    "purpose": "Fictional purpose notice",
    "access": "Fictional restricted staff access notice",
    "owner": "Fictional review owner",
    "retentionDays": 7,
    "demoOffers": false
  }
}
```

Missing/invalid configuration hides the form. Every fallback set, including an
empty catalog, links to the form when configured. Submitted text is not prefilled
from the search. Only accepted/duplicate acknowledgements show success. Failed
submissions retain entered values; unchanged retries reuse the submission ID.
Editing creates a new submission ID. Server rejection of a stale policy requires
reloading to receive the new approved notice. Delivery expires after one hour;
edit an unconfirmed entry before resubmitting after that window. The collector
limits submissions to 10/minute, 200/day and 5,000 retained entries, under the
same script lock as usage writes. These are global capacity limits, not identity
tracking or a guarantee against spam.

## Weekly review

The named policy owner checks the queue at least weekly, records a status for
each entry, and dismisses duplicate/spam entries. An accepted idea is still only
an idea for staff review. Adding a video requires the separate vetted Sprint
catalog publication process. Review entries without copying contact/free text to
public tickets. Track submissions per week from `receivedAt` in the restricted
review workbook. If entries go unanswered for two weeks, disable
`VITE_REQUESTS_ENABLED` and rebuild to unlink the form, then resolve ownership.

## Release verification and rollback

Record the tested commit, Cloudflare preview, collector version, workbook access
checks and unresolved failures in spec #26. Verify a contact-free topic and a
consented demo offer appear only in the source workbook's `Requests` tab. Verify `doGet` and Usage
never return/store their text, unauthorized workbook access is denied, expired
contacts are purged and hourly cleanup runs. Check mobile, 200% zoom and
screen-reader status announcements. Production release still depends on #17.

Rollback by disabling `VITE_REQUESTS_ENABLED` and rebuilding, then disabling
collector `REQUESTS_ENABLED`. Keep approved cleanup running while data remains.

## Same-workbook verification, November 3, 2026

Collector version 6 on the existing private-copy endpoint now writes to `Requests`
beside `Video Tracker` and `Usage`. Seven existing fictional requests were copied
exactly, including IDs and review statuses. The previous test queue remains a
Restricted rollback copy. A new browser topic request and a consented demo offer
each produced one `new` row in the source workbook; the unconsented demo attempt
added none. Both accepted submissions showed the success acknowledgement.
The queue contains nine unique requests. Usage stayed at 121 rows with no
request text or contact details, and the public catalog contract still returns
the unchanged 91-video snapshot. Native Sheet layout was checked at 100% zoom.
All 1,328 tests, typecheck, lint and application/collector/admin builds pass.
See the [aggregate verification record](analytics/requests-in-library-verification-2026-11-03.json).
This verifies the user-designated private test environment, not a production cutover.
