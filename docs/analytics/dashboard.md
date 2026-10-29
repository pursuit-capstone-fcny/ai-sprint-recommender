# MVP analytics dashboard

Implements [#24](../specs/024-usage-dashboard.md) on the existing
[#16 usage contract](../specs/016-usage-logging.md). This code does not enable
production logging, publish a report, or grant any staff account access.

## Data path

```text
accepted #16 events + event-time public catalog snapshots
  private usage workbook, read under the ingestion lock
  validate, exclude expired records, deduplicate and aggregate
  separate restricted reporting workbook
    Analytics facts          daily/source/mode aggregates + zero inventory
    Analytics videos         selected-window video totals
    Analytics tags           selected-window tag totals and search counts
    Analytics associations   selected-window video-keyword co-occurrences
    Analytics status         refresh, coverage and error state
    Analytics filters        shared owner verification controls
  FCNY-owned Looker report, restricted to named staff
```

Neither `doGet` nor `doPost` serves reports, snapshots, workbook IDs or maintenance
operations. There is no analytics route in the public SPA. No raw events,
session/search/event IDs, goal text, or personal identifiers enter report tables.
The report workbook must be separate from both the catalog and usage files.

The `facts` table includes team-source aggregates, allowing an authorized admin
to opt in. The Looker parameter defaults below exclude them. It never mixes test
and production files. The three verification tables exclude team by default.
Counts remain estimates from anonymous, best-effort events, not identified people.

## Owner setup and release gates

The FCNY reporting owner performs these steps in their own environment. Use
separate synthetic test files first. No live production configuration is supplied
in this PR.

1. Confirm #8 approval of production collection, fields, retention and staff
   access. Name the reporting/refresh/recovery owner. Confirm the catalog and
   usage files belong to the intended environment.
2. Create an FCNY-owned **restricted** reporting spreadsheet. Disable link,
   domain and public sharing. Grant named reporting staff access only; do not
   grant them raw-log access merely to view reports. Verify denied access in an
   unauthorized signed-out session. A hidden/protected tab is not access control.
3. Build and deploy the Apps Script bundle using `pnpm build:apps-script` or
   `pnpm build:apps-script:test`. The manifest adds `script.scriptapp` for the
   explicit trigger installer. The FCNY owner must review and authorize that new
   scope before installing triggers. No Drive or external-fetch scope is added.
4. Set the Script Properties below, then run `initializeAnalytics` from the
   script editor. It creates only the named analytics tables, refuses unexpected
   headers, and captures the current public catalog. Keep production ingestion
   off until its separate #16 validation is complete.
5. Run `refreshAnalytics` with synthetic retained events. Reconcile the tables
   and the tests below before installing `installAnalyticsTriggers`. This helper
   first verifies a successful refresh, then installs one daily refresh in the
   03:00 America/New_York hour and one reporting-file edit trigger for the current
   owner. Repeated calls by that owner do not add duplicates. Only one owner
   should install triggers; review/remove former owners' triggers during handoff.
6. Run `analyticsReportLinks` in the editor and copy the returned **Analytics
   facts** link. Open it as the FCNY reporting owner and save the generated Looker
   report in FCNY's account. This helper initiates Google's report creation flow;
   it does not create or share a report automatically. Add `Analytics status` as
   a second restricted Sheets source using the same reporting file.
7. Configure the report below. Keep the report and its data sources restricted
   to named staff. If using owner credentials for data access, report sharing is
   the access boundary. Verify both an authorized staff account without YouTube
   channel access and an unauthorized account. Do not publish or embed publicly.
8. Record the FCNY report URL, owner, test/release version and evidence in the
   private deployment record. Leave #24 unchecked until the live report, access,
   freshness, filter and reconciliation checks pass. This code alone is not that
   evidence.

| Script Property                                  | Required value                                                                                                                 |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `ANALYTICS_ENABLED`                              | Literal `true` opts in to reporting and ingestion snapshot capture; absent/false is off                                        |
| `ANALYTICS_ACCESS_APPROVED`                      | Literal `true` only after the owner checks the restricted reporting-file ACL; a declaration, not an automatic permission audit |
| `ANALYTICS_SPREADSHEET_ID`                       | Explicit restricted reporting file, different from catalog and usage files                                                     |
| `ANALYTICS_ENVIRONMENT`                          | `test` or `production`                                                                                                         |
| `USAGE_ENVIRONMENT`                              | Same environment as analytics; verify the file IDs independently                                                               |
| `ANALYTICS_OWNER`                                | Named FCNY reporting/retention/recovery owner, stored in Script Properties, not exported to reports                            |
| `USAGE_RETENTION_DAYS`                           | Existing approved integer 1–365                                                                                                |
| `USAGE_SPREADSHEET_ID`, `CATALOG_SPREADSHEET_ID` | Existing explicit sources from #16/#9                                                                                          |

## Looker report configuration

Connect only to the reporting workbook. Use **Analytics facts**, not the raw
usage file or a blend of tags and video totals. One fact row is an aggregate at
`entity/dateKey/source/mode/youtubeId/category/tag`. `entity` is `video`, `tag` or
`association`. Metrics are numeric counts; identity/category/tag columns are
text. `dateKey` is a numeric New York receipt date, `YYYYMMDD`.

`activeInventory` identifies videos/tags still present in the current active
catalog/dictionary. Use `activeInventory=true` on the unused-content tables so
retired historical tags/videos do not appear unused. Keep historical rows
available on trend/association views, labeled as historical.

There are zero-weight inventory rows with `dateKey=0`, including videos and
canonical dictionary tags with no events. Keep those rows in the source. A
normal date/source dimension filter would remove them and make unused content
disappear. Instead, configure these **per-view parameters** and calculated
metrics. Changing a viewer's Looker controls does not change another viewer's
selection or edit the shared reporting workbook.

| Parameter        | Type / allowed values                                                | Default |
| ---------------- | -------------------------------------------------------------------- | ------- |
| `p_start`        | Number, `YYYYMMDD`; `0` means no lower bound within retained data    | `0`     |
| `p_end`          | Number, `YYYYMMDD`; `0` means no upper bound within retained data    | `0`     |
| `p_source`       | Text: `all`, `website`, `email`, `session`, `pilot`, `team`, `other` | `all`   |
| `p_mode`         | Text: `all`, `recommendations`, `topic`, `direct`                    | `all`   |
| `p_include_team` | Text: `no`, `yes`                                                    | `no`    |

Create `In selected period` as a row-level field. Set all numeric count source
fields to numbers. Date controls use the explicit New York date keys, so a viewer's
local timezone cannot shift the boundary.

```text
CASE
  WHEN dateKey > 0
    AND (p_start = 0 OR dateKey >= p_start)
    AND (p_end = 0 OR dateKey <= p_end)
    AND (p_source = "all" OR source = p_source)
    AND (p_mode = "all" OR mode = p_mode)
    AND (p_include_team = "yes" OR source != "team")
  THEN 1
  ELSE 0
END
```

Create row-level metrics such as `Selected appearances`:

```text
CASE WHEN In selected period = 1 THEN appearances ELSE 0 END
```

Repeat for `searches`, `embedClicks`, `youtubeClicks`, `directViews`,
`directEmbedClicks` and `directYoutubeClicks`. Set each selected metric's default
aggregation to **Sum**. Set `Selected clicks` to the selected embed plus YouTube
clicks. Zero inventory rows remain available when all their selected metrics sum
to zero. Do not use Record Count, count inventory rows as appearances, or filter
out `dateKey=0` at source/page/chart level.

Create these report pages, with each table filtered to its stated entity:

| Page/table           | Entity and dimensions                                | Summed metrics / controls                                                                                           |
| -------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Videos               | `entity=video`; `youtubeId`, `title`                 | Selected appearances, embed/YouTube clicks, direct views/clicks; video dropdown and metric sliders                  |
| Tags and keywords    | `entity=tag`; `category`, `tag`                      | Selected appearances, clicks and searches; category/tag dropdowns and metric sliders                                |
| Keyword associations | `entity=association`; `youtubeId`, `category`, `tag` | Selected appearances and clicks; video/category/keyword dropdowns                                                   |
| Reporting health     | `Analytics status` metric/value table                | State, last success, stale-at, coverage, unmapped/unattributed counts; display even when an activity table is empty |

Group content dropdowns with their relevant tables. `tag` on the association page
means a canonical search keyword; `tag` on the tag page means a catalog tag.
Association counts cannot be summed across keywords to obtain video totals.
Neither can keyword frequencies be summed to obtain total searches.

Enable metric sliders for the video and tag tables. Set selected appearances to
`0..0` to show unused items. For shown-but-not-clicked items, use appearances
`>=1` and selected clicks `0..0`. On tags, searches `0..0` finds unused keywords.
These conditions apply to the **aggregated selected metrics**, never the raw
per-day counts. Include separate prefiltered copies of these tables if sliders
are insufficient in the selected Looker template. Check zero-use membership
against the corresponding Sheet control results before acceptance.

Label the tables "Recorded activity in the selected period". A zero is not proof
of never-used content, especially when rows were purged or browser delivery was
lost. Show the reporting coverage and warn when the requested period extends
beyond retained data. An inverted date range has no selected activity; the UI
instructions should tell admins to correct it.

The `Analytics filters` Sheet provides an independent reconciliation view. Edit
only its value column, then run `refreshAnalytics` or use the installed edit
trigger. Dates are literal ISO `YYYY-MM-DD` or `auto`; other values follow the
`ReportFilterSchema` enums. A tag requires its category. Selecting team also
requires `includeTeam=true`. `zero-searches` applies to the tag table, not videos.
These controls are shared owner/test controls; the Looker parameters are the
per-view admin filters. The all-retained-data facts are rebuilt independently of
these shared controls.

## Metric definitions and limitations

- Video appearances count one displayed video per session/search/catalog
  context, even if a retry/rerender sends a new event ID. They are not viewport
  visibility or completed watches. Direct views/clicks remain separate.
- Tag appearances count displayed video/context pairs carrying each tag in the
  **event-time** catalog. Multiple tags do not multiply video totals. Keyword
  searches count a canonical category/value once per submitted search context.
  Aliases were normalized before ingestion; no original wording is retained.
- Associations join an impression and its immutable search context using
  session/search/catalog version, source and mode. They indicate co-occurrence,
  not the reason the recommender chose a video. Searches outside the selected
  receipt period can still supply context for later displayed videos. Direct
  views and events without retained search/impression context stay unattributed.
- New catalog versions are snapshotted best effort during accepted ingestion.
  Snapshot failure does not block #16 event delivery; it records a fixed failure
  outcome. Missing snapshots produce explicit unmapped counts, with no guessed
  tag/keyword attribution. Previously purged or never-captured history cannot be
  reconstructed. Snapshots contain only validated public catalog metadata.
- Refreshes exclude expired records even before #16's purge runs. Snapshots not
  referenced by retained events/current catalog are pruned. The report is a daily
  materialization and Looker can cache it; approve derived-aggregate/cache
  retention and set the shortest appropriate data freshness before launch.
- Hard limits are 10,000 usage rows, 8 MiB of parsed retained event bodies, 500
  snapshot chunks of 10,000 characters, and 100,000 rows per output table. A
  capacity/validation failure clears generated datasets where writes remain
  available and marks error instead of silently truncating metrics. Load-test the
  agreed catalog/traffic size before production.

## Refresh failures and rollback

`Analytics status` records `ready`, `empty`, `error` or `cleared`, last successful
refresh, attempted refresh, coverage and the explicit unavailable watched metric.
Display an alert when now exceeds `staleAt`, 26 hours after the last refresh.
A trigger that never runs cannot update its own status; owner trigger-failure
notifications and the stale-at alert are both required. If a write/cleanup also
fails, the last success remains stale and the trigger raises a fixed error.

1. For wrong totals or access exposure, restrict the report immediately.
2. Run `clearAnalytics` to remove generated facts/totals, then set
   `ANALYTICS_ENABLED=false`. Clearing also works after that flag is disabled
   while the remaining configuration is intact. Remove analytics triggers or
   expect them to fail closed while disabled. Clear Looker cached data/access too.
3. Keep `purgeUsageLog` running and use #16's stop switch if collection is at
   fault. Analytics clearing never deletes source log rows.
4. Repair configuration/snapshots, rerun reconciliation, then refresh/re-enable
   only the approved environment. Do not copy test rows into production.

Changing a corrupt header deliberately prevents overwriting unrelated staff
content. Repair the owned table under the owner's review; do not delete log rows
to make a refresh pass.

## Playback percentage feasibility

The current #16 schema has no playback progress, and a YouTube click is not a
watch. The [IFrame Player API](https://developers.google.com/youtube/iframe_api_reference)
provides current position and duration for an instrumented embed. Their ratio is
playback position, not percent actually watched: seeking can jump ahead, replays
can inflate elapsed time, and external YouTube opens are unobservable here.
Reliable observed progress would require approved played-segment instrumentation,
a revised versioned event schema, notices/retention and missing-data rules.
No progress instrumentation is added. Percentage watched remains unavailable and
does not block the basic MVP dashboard.

## Acceptance evidence to collect

- Local tests cover #16 ingestion through snapshots to the aggregate tables,
  deduplication, historical/missing catalog versions, zero inventory, source/mode
  isolation, NY midnight/DST, cross-period context, retention, fixed failure
  messages, stale-data clearing, table guards and trigger idempotence.
- In FCNY's isolated test environment, reconcile a hand-counted reporting day,
  including repeated events, multi-keyword searches, no-result searches, team
  traffic and zero-activity tags. Compare each Looker view to the shared Sheet
  controls for the same range/source/mode.
- Verify zero-use filters still show never-impressed inventory, and that a video
  with earlier activity becomes zero for a later selected period. Verify missing
  snapshots and unmatched searches do not invent keywords or claim full coverage.
- Exercise authorized and unauthorized access, daily refresh, edit refresh,
  empty/error/stale states, trigger failure notifications and the stop switch.
- Record these live checks and the FCNY-owned report URL before closing #24.

References: [Looker Linking API](https://developers.google.com/data-studio/integrate/linking-api),
[metric sliders](https://docs.cloud.google.com/data-studio/metric-slider),
[calculated fields](https://docs.cloud.google.com/data-studio/about-calculated-fields),
[clock triggers](https://developers.google.com/apps-script/reference/script/clock-trigger-builder),
[Sheet formula interpretation](https://developers.google.com/apps-script/reference/spreadsheet/range).
