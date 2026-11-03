# Private MVP analytics dashboard

Issue [#24](../specs/024-usage-dashboard.md) now uses a private React dashboard
rather than requiring Looker Studio. The user confirmed this implementation on
Oct 29, 2026. The producer from #88 still writes restricted aggregate Sheets;
this PR adds the actual interactive app and its authenticated read-only service.
The [isolated test deployment](test-deployment.md) records native Google consent,
Sheet-link connection and browser-to-dashboard reconciliation.

## What ships

- Videos, Tags & keywords, and Keyword associations views with sortable tables
  and 25-row pages. Each admin has their own in-memory filters.
- Receipt-date range in America/New_York; source, discovery mode, video/keyword
  search, category/tag, team and historical-item filters.
- All activity, zero appearances, appeared-with-no-clicks and zero keyword-search
  views. Inventory stays visible with zeros when selected dates/sources have no
  events. Keyword-search frequency and catalog-tag appearances remain distinct.
- A video-to-keyword drill-down. Associations mean co-occurrence with a search,
  not the cause of a recommendation. Clicks never imply watches; direct-view
  metrics are separately available. Percentage watched is explicitly unavailable.
- Loading, access-denied, empty, cleared, refresh-in-progress, failed and stale
  states. Reloading never falls back to sample or previously authorized data.
  Counts disappear when the snapshot reaches its stale deadline.
- A public, clearly labeled **synthetic-only** review route at
  `/admin/analytics/preview`. No live private data or admin service URL is embedded
  in that route. It does not send usage events or connect to a reporting file.

## Separate deployment and access boundary

```text
Public recommender deployment                 Private admin deployment
catalog GET / usage POST                      Google sign-in, execute as visitor
no analytics read endpoint                    per-user saved Sheet link
synthetic preview only                        visitor's restricted Sheet permission
                                              readDashboard -> aggregates only
```

Build with `pnpm build:admin`, or the normal `pnpm build`. The generated
`build/apps-script-admin/` folder contains `Code.js`, `Dashboard.html` and
`appsscript.json`. Create a **separate FCNY-owned Apps Script project** from that
folder. Do not upload the admin bundle to the public catalog/usage project or
serve the HTML through its anonymous `doGet`.

The admin bundle exports `doGet`, `readDashboard`, `connectSheet` and
`disconnectSheet`. Connection helpers only change the current user's binding in
Apps Script User Properties. They never edit a Sheet, alter sharing, enable
collection, install triggers or call producer maintenance operations. Every RPC
requires a Google identity and matching active/effective users, rejecting an
owner-executed deployment. File reads execute as the visiting user and require
actual Google file permission. The reader also rejects public, domain and link
sharing. Named membership of the private file authorizes its dashboard data.

The manifest pins `executeAs=USER_ACCESSING` and `access=ANYONE`, meaning Google
account authentication, **not** `ANYONE_ANONYMOUS`. Review both in the deployment
UI. Google Workspace policy and OAuth consent must allow the intended staff.
The admin project requests email identity, Spreadsheet service access and Drive read-only access to verify sharing, plus external-request access to the public static catalog; the
latter is broad at Google's scope level even though this code only reads the
user-selected file. Each admin must review/authorize those scopes. No
credentials, emails or workbook IDs belong in frontend code or this repository.
The built app contains no external scripts/fonts, analytics beacons or browser
storage. Reporting facts exist only in page memory and are not logged.

References: [Google web-app execution identities](https://developers.google.com/apps-script/guides/web),
[Session identity availability](https://developers.google.com/apps-script/reference/base/session),
[HTML-service RPC](https://developers.google.com/apps-script/guides/html/communication).

## Learner browsing events, November 3, 2026

The revised browser producer follows AC-16.7. Initial default cards and cards
restored by Clear send no automatic search or impression events. Playing a card
or following its YouTube link records one direct impression per video in that
browsing context and a direct click per action. These feed the existing separate
direct-view metrics, not recommendation appearances or keyword associations.
Submitted searches retain their search/impression/click events, including the
actual weak/start-here/cross-area classifications on general fallback cards.
Explicit feedback remains available even when automatic usage is disabled.

This producer change takes effect when its browser build is deployed; existing
open pages keep their loaded producer until reload. Record that deployment's
commit and time when comparing collection volumes. Do not relabel historical
events as browsing clicks or infer missing submissions. The report's existing
AC-24.19 filter for real submitted matches continues to apply to retained events.

## Producer setup

The producer remains in the existing Apps Script project from #88. Configure
these Script Properties separately for each environment. Keep production
collection off until #8/#16's existing approval and validation gates pass.

| Producer property                                | Value                                                                         |
| ------------------------------------------------ | ----------------------------------------------------------------------------- |
| `ANALYTICS_ENABLED`                              | Literal `true` opts into aggregate materialization and ingestion snapshots    |
| `ANALYTICS_ACCESS_APPROVED`                      | Literal `true` after verifying the reporting file's restricted sharing        |
| `ANALYTICS_SPREADSHEET_ID`                       | Explicit FCNY-owned reporting file, separate from raw usage and catalog files |
| `ANALYTICS_ENVIRONMENT`, `USAGE_ENVIRONMENT`     | Matching `test` or `production`; independently verify file IDs                |
| `ANALYTICS_OWNER`                                | Named FCNY refresh/access/retention/recovery owner                            |
| `USAGE_RETENTION_DAYS`                           | Existing approved integer 1–365                                               |
| `USAGE_SPREADSHEET_ID`, `CATALOG_SPREADSHEET_ID` | Existing explicit sources                                                     |

Run `initializeAnalytics`, then `refreshAnalytics` and reconcile synthetic counts.
`installAnalyticsTriggers` adds daily refresh in the 03:00 New York hour and an
edit trigger for the shared verification filters. Only one FCNY owner should
install them. Replacing the reporting file replaces obsolete edit triggers for
that owner. Review previous owners' triggers during handoff. The producer's
`script.scriptapp` scope is for this explicit installer only; the admin app has
no trigger scope.

The producer writes a unique generation and a `refreshing` status before replacing
facts, then publishes `ready`/`empty` and its coverage metadata. The admin reader
validates every returned field, expected headers, row limits, and the generation
before/after reading facts. In-progress, failed, cleared or stale reports do not
return fact rows. A mixed-generation read yields a recoverable load error.

## Staff setup: one Sheet link

After the technical team deploys the private app, Ali and Eliot each sign in with
Google, authorize the app, paste their Google Sheets link and choose **Connect
Sheet**. The app remembers that connection for that Google account. No file ID,
Script Property, duplicate email allowlist, reporting workbook or refresh trigger
is required from them. **Change Sheet** validates the new file before replacing
the saved connection. **Disconnect** forgets only that account's binding.

The link must identify the configured private source/usage Sheet. Arbitrary
catalog or aggregate workbooks are rejected. Inventory comes exclusively from
the versioned Cloudflare catalog. The publisher validates normalized Catalog
workbooks or approved integration rows; the dashboard never reads draft catalog
cells. Connecting cannot grant missing Google access. See
[library publishing](library-publishing.md) for the one-time technical setup.

A source workbook can be connected before it has a `Usage` tab. Inventory loads,
but usage counts display **Unavailable** and unused-content/date/source/mode
controls stay disabled. An existing, valid but empty `Usage` table instead means
zero retained recorded events. Connecting does not create that table or turn on
production logging. The collection owner must still deploy and approve #16's
event collection. Events must be in the selected source workbook to be read
there. Legacy multi-file producers retain their owner reconciliation tables,
but those tables cannot be connected to the dashboard.

Direct source reads aggregate on each reload and expire after 15 minutes. If the
owner supplies approved reporting policy as workbook developer metadata
`FCNY_ANALYTICS_POLICY_V1`, JSON
`{"schemaVersion":1,"retentionDays":30,"environment":"production"}`, the reader
uses that policy. This is optional technical owner configuration, never a staff
onboarding field. Without it the reader conservatively includes only receipts
from the last 24 hours and labels the coverage. It does not extend retention or
approve collection. Historical versions without a matching snapshot stay
explicitly unmapped. Historical metadata comes only from hash-verified public
snapshots, never mutable Sheet snapshot cells.

## Technical deployment, once

1. Create a separate FCNY-owned Apps Script project from
   `build/apps-script-admin/`. Configure `LIBRARY_SOURCE_SHEET_URL` and
   `LIBRARY_PUBLIC_ORIGIN` once as described in library publishing. The optional `ANALYTICS_ADMIN_ENABLED=false` kill switch disables
   access. Never deploy this bundle on the public catalog/usage endpoint.
2. Deploy as **User accessing the web app**, with Google sign-in required. Each
   staff member authorizes Google's scopes. Review Workspace/OAuth policy with
   the FCNY owner. Test missing identity, incorrect owner execution, revoked file
   access, broadly shared files and per-account binding isolation.
3. Verify an authorized viewer can connect using only the Sheet URL and can
   inspect aggregates without YouTube channel access. Confirm no raw event
   records or private review notes reach the browser. Test disconnect/reconnect
   and reload after revocation.
4. Record the private deployment URL, owner and native reconciliation evidence
   in the private deployment record. The public synthetic preview validates UI;
   it cannot validate Google sign-in or connect a real Sheet. Do not close #24
   until native deployment/consent and live reconciliation have been verified.

Changing access uses Google's file sharing controls. Every reload rechecks it
and clears visible facts first. Revocation cannot recall an already-delivered
response; facts hide at their stale expiry and never persist in browser storage.

## Metrics and limits

The producer deduplicates accepted events and repeated impressions before receipt
window selection. Historical tags come from event-time public catalog snapshots;
missing metadata remains explicitly unmapped. Video IDs with missing metadata
retain counts with an unavailable-title label. Canonical keyword searches are
counted once per submission; sums across multiple keywords are not total searches.
Associations and tag appearances cannot be summed as video totals. Direct views
and unjoinable events do not invent keyword attribution.

Active zero-weight inventory rows survive client-side date/source filtering.
Historical/retired items are hidden by default and can be included explicitly.
A zero means no **recorded** activity in the selected period, never proof of
never-used content. Coverage and missing/unattributed counts are visible.

Producer limits: 10,000 usage rows, 8 MiB retained event bodies, 500 public-catalog
chunks of 10,000 characters, and 100,000 rows per output table. Admin reads at most
100,000 strict aggregate facts, renders 25 rows at a time, and bounds RPC waiting
to 30 seconds. Load-test the agreed scale before production. Precomputed aggregates refresh
daily; direct source reads refresh on reload. approve derived-data retention as well as raw-log retention. Stale data is
not served by the admin reader. Snapshots contain public metadata only.

`Analytics filters` still provides a shared owner reconciliation view in Sheets.
Dashboard filters operate locally on the independently published daily facts and
never change that shared selection or another admin's view.

## Errors, retention and rollback

If a refresh fails, independently clear every writable owned dataset and attempt
an error-status write. Corrupt headers are guarded, not overwritten. The rollback
helper `clearAnalytics` also continues across individual table failures, records
partial failure and throws a fixed error instead of claiming complete clearing.
Repair remaining damaged tables under the owner's review. If writes/status updates
also fail, the previous last-success deadline and trigger failure notifications
remain the external operational backstop.

For access exposure or wrong totals, first disable the admin app with
`ANALYTICS_ADMIN_ENABLED=false` and remove the affected file access.
Run producer `clearAnalytics`, disable producer analytics and its triggers as
appropriate, and keep the raw usage purge running. None of these code changes
enable production logging or change Google permissions automatically.

## Percentage watched

The current event contract contains no progress events. The
[YouTube IFrame API](https://developers.google.com/youtube/iframe_api_reference)
exposes position/duration for an instrumented embed, but that ratio does not
measure actual watched segments. Seeking, replays and external YouTube opens need
separate semantics and collection approval. This dashboard displays unavailable;
it does not infer watches from clicks or introduce new tracking.

## Staff topic search

The Topic search view finds videos in the same published catalog used for
analytics. Blank input browses all active videos. Searches match titles,
descriptions and canonical tags, using the published synonym table and bounded
long-word typos. All topic concepts must match. Function-area and tool groups
combine with AND, with OR within a group. These filters are independent of
report dates/activity. Every match is accessible immediately, without task
deduplication, recommendation caps or fallback padding. Staff can play, open or
copy each video.

Rebuild and redeploy the private admin app to supply its catalog metadata. Older
responses without catalog metadata show search unavailable. Reload and access
failures clear search results. The public preview uses fictional metadata only.

Collection is disabled by default. After #8 approval, set TOPIC_USAGE_ENABLED,
TOPIC_USAGE_URL and TOPIC_USAGE_RETENTION_DAYS on the admin project as described
in spec #21. Use an approved existing collector, redeployed with topic-mode
functionAreas support. Staff traffic is src=team and excluded by default.
Original topic wording is never included in events or URLs. Usage delivery
remains best effort under existing limits. This feature does not change any
deployment property, source data, sharing or collection consent.
