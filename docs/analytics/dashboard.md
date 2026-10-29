# Private MVP analytics dashboard

Issue [#24](../specs/024-usage-dashboard.md) now uses a private React dashboard
rather than requiring Looker Studio. The user confirmed this implementation on
Oct 29, 2026. The producer from #88 still writes restricted aggregate Sheets;
this PR adds the actual interactive app and its authenticated read-only service.

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
no analytics read endpoint                    exact server-side email allowlist
synthetic preview only                        visitor's reporting-file permission
                                              readDashboard -> aggregates only
```

Build with `pnpm build:admin`, or the normal `pnpm build`. The generated
`build/apps-script-admin/` folder contains `Code.js`, `Dashboard.html` and
`appsscript.json`. Create a **separate FCNY-owned Apps Script project** from that
folder. Do not upload the admin bundle to the public catalog/usage project or
serve the HTML through its anonymous `doGet`.

The admin bundle exports only `doGet` and `readDashboard`; it has no logging,
refresh, clear, trigger-installation or other mutation RPC. Each page/data request
checks the Google-authenticated active identity against the configured allowlist.
It also requires active and effective identities to match, rejecting deployment
as an owner on behalf of another user. An absent identity or config fails closed.
Reading the workbook runs as the visitor, so its actual Google file ACL is a
second independent check. Do not treat an unlisted URL as authorization.

The manifest pins `executeAs=USER_ACCESSING` and `access=ANYONE`, meaning Google
account authentication, **not** `ANYONE_ANONYMOUS`. Review both in the deployment
UI. Google Workspace policy and OAuth consent must allow the intended staff.
The admin project requests email identity and Spreadsheet service access; the
latter is broad at Google's scope level even though this code only reads the
configured aggregate file. Each admin must review/authorize those scopes. No
credentials, emails or workbook IDs belong in frontend code or this repository.
The built app contains no external scripts/fonts, analytics beacons or browser
storage. Reporting facts exist only in page memory and are not logged.

References: [Google web-app execution identities](https://developers.google.com/apps-script/guides/web),
[Session identity availability](https://developers.google.com/apps-script/reference/base/session),
[HTML-service RPC](https://developers.google.com/apps-script/guides/html/communication).

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

## Admin setup

1. Verify the **entire reporting file** is restricted. Disable link, domain and
   public sharing. Grant named dashboard staff **viewer** access to this aggregate
   file; they do not need raw usage-file or YouTube channel access. Hidden tabs
   are not an access boundary.
2. Create the separate FCNY admin project from `build/apps-script-admin/` and set
   these properties in that project only:

   | Admin property                | Value                                                                                |
   | ----------------------------- | ------------------------------------------------------------------------------------ |
   | `ANALYTICS_ADMIN_ENABLED`     | Literal `true` after setup; absent/false disables page/data access                   |
   | `ANALYTICS_ACCESS_APPROVED`   | Literal `true` after the reporting-file ACL check                                    |
   | `ANALYTICS_ADMIN_EMAILS`      | JSON array of exact approved Google emails, at most 100; no wildcard/domain matching |
   | `ANALYTICS_ADMIN_ENVIRONMENT` | Expected `test` or `production`; a mismatched dataset is rejected                    |
   | `ANALYTICS_SPREADSHEET_ID`    | The corresponding aggregate reporting file                                           |

3. Deploy as **User accessing the web app** with Google sign-in required. Let
   staff authorize Google's requested scopes themselves. Confirm both allowlist
   and file access; neither alone is sufficient. Do not accept an anonymous or
   owner-executed deployment as equivalent.
4. Test signed-out/unlisted users, listed users without file access, and an
   authorized staff viewer without YouTube access. Confirm they cannot call any
   producer maintenance operation through the admin app.
5. Record the private deployment URL, FCNY owner and evidence in the private
   deployment record. Do not close #24 until native authorization and live
   synthetic reconciliation are verified. The PR preview validates the UI, not
   Google's deployment/consent configuration.

Changing access requires updating the server allowlist/file ACL, then reloading.
The UI clears facts before each reload, including failures. Revocation cannot
recall a response already delivered to a page; data is hidden at its stale
expiry, and no response is persisted in browser storage.

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
to 15 seconds. Load-test the agreed scale before production. Aggregates refresh
daily; approve derived-data retention as well as raw-log retention. Stale data is
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
`ANALYTICS_ADMIN_ENABLED=false` and remove the affected allowlist/file access.
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
