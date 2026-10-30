# Topic requests and demo offers

Implementation for spec #26. Collection is disabled by default. Eliot's wording,
contact fields, purpose, staff access, retention and a named weekly reviewer are
still unapproved through #8. The user confirmed no approvals are available.
No approval or live delivery is claimed.

## Configuration and isolation

Create a separate FCNY review workbook with general access **Restricted**, only
the approved reviewers, and no public publication. It must differ from catalog,
usage, analytics and feedback reporting workbooks. Verify unauthorized/signed-out
access is denied. Requests have no session/search identifiers and never enter
usage events, catalog snapshots or analytics. Only fixed acknowledgements leave
the request collector, and it never logs request bodies or exception contents.

Set collector Script Properties:

- `REQUESTS_SPREADSHEET_ID`: the restricted review workbook.
- `REQUESTS_ACCESS_APPROVED=true`: records completion of the actual sharing check.
- `REQUESTS_POLICY`: approved policy JSON described below.
- Existing `CATALOG_SPREADSHEET_ID`, `USAGE_SPREADSHEET_ID` and
  `ANALYTICS_SPREADSHEET_ID`: used to reject shared destinations.
- `REQUESTS_ENABLED=true`: set last, after initialization and retention setup.

The policy has `version`, `topicPrompt`, `demoInvitation`, `purpose`, `access`,
`owner`, `retentionDays` and `demoOffers`. Text values are required and must state
approved wording, purpose, access and review owner. Retention is 1–365 days.
`demoOffers=false` rejects demo submissions at the collector and hides the contact
fields in the form. A demo offer requires only email and explicit consent after
the notice. Topics cannot carry contact or consent fields. There are no uploads
or automatic catalog additions.

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
consented demo offer appear only in the review workbook. Verify `doGet` and Usage
never return/store their text, unauthorized workbook access is denied, expired
contacts are purged and hourly cleanup runs. Check mobile, 200% zoom and
screen-reader status announcements. Production release still depends on #17.

Rollback by disabling `VITE_REQUESTS_ENABLED` and rebuilding, then disabling
collector `REQUESTS_ENABLED`. Keep approved cleanup running while data remains.
