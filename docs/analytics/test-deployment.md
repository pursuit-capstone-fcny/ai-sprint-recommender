# Analytics end-to-end test deployment

## Static catalog cutover on October 30, 2026

The existing test collector is now version 4, built from `8f5e4a6`. Its GET
returns the same 89 public catalog items and version as
[the published test manifest](https://ai-sprint-library-test.jason-zeng151.workers.dev/catalog/current.json):
`sha256:fcc3f9c7a1b7a18566fdd5132c0d79663b1945a057b4e99c8e317b596c04336d`.
Google granted the approved `script.external_request` scope. Both the manifest
and snapshot returned HTTP 200, and the snapshot digest matched its version.

A controlled backend test accepted one `src=team` topic search for the canonical
keyword **AI policy drafting**, one impression for **Placeholder AI Guidelines**
(`6d2bKhdmqqA`), and one embed click. Repeating the impression returned
`duplicate`. These events used the published version above. No raw goal was sent.

`LIBRARY_TEST_COLLECTION_READY=true` now enables usage delivery in newly built
PR previews. Production collection and paid LLM recommendations remain disabled.
The collector keeps its existing URL and anonymous POST access, private usage
Sheet, one-day retention, 20 events/minute, 100/day and 1,000-row caps.

The private dashboard is now version 3 from the same source, configured with
`LIBRARY_PUBLIC_ORIGIN` and `LIBRARY_SOURCE_SHEET_URL`. It preserves visitor
execution, Google-account access and Restricted Sheet membership checks.
The test owner completed the updated Google consent and connected the private
Sheet. The authenticated report loaded all 89 videos. With team traffic included,
**AI policy drafting** showed one keyword search, one appearance and one embed
click. Its **Placeholder AI Guidelines** association showed one appearance and
one embed click. A signed-out request returned HTTP 302 to Google sign-in.

Older test events still produce the report's explicit missing-history and
unattributed-event warnings; they are not assigned guessed keyword associations.
Temporary editor authorization probes were removed after verification.
The [new collection-enabled preview](https://ffab5699-ai-sprint-recommender.jason-zeng151.workers.dev/?src=team)
was then tested in the browser. Selecting Leadership, searching for the
synthetic goal **AI policy drafting**, and clicking the first video's embed
added one appearance and one embed click to **Placeholder AI Guidelines**.
After **Reload data**, its video totals increased from 2/1 to 3/2
(appearances/embed clicks), including one earlier unattributed appearance.
The **AI policy drafting** association increased from 1/1 to 2/2. The
**Tags & keywords** row showed two keyword searches, two catalog-tag appearances
and two embed clicks. These totals include the controlled backend test above.
The browser search recorded multiple canonical keywords from the existing
matcher; association rows are co-occurrences and must not be added together.

Typecheck, lint, all 536 tests and all application/Apps Script/admin builds
passed locally. The preview deployment passed. No application source changes
were required for this cutover.

## Historical verification

Historical verification of the pre-publishing deployment on October 29, 2026.
At that time the Google deployment still used the pre-publishing catalog.
The record below describes that earlier verification. Deployment instructions
are in [library publishing](library-publishing.md). It used the isolated test collector and
private test copy of the library. The production integration workbook and
production collection were not changed.

## Open the test

- [Private analytics dashboard](https://script.google.com/macros/s/AKfycbzw_0TUPaW2VbEEiLonCU_AsG7KJkf7H2iB2zg4oG2dmq3SNZFv2zNY-LRW73sCFS7J/exec)
- [Historical test recommender with team attribution](https://e4cdf1ae-ai-sprint-recommender.jason-zeng151.workers.dev/?src=team)
- [Private test Sheet](https://docs.google.com/spreadsheets/d/1UO6Biq_clsL8kqmHyBN2qChJ8nbLSwclY_Jdg499xHY/edit)

The recommender footer links **Admin analytics** to the private dashboard in a
new tab. This navigation grants no access and passes no credentials.

Sign in to the dashboard, authorize Google's scopes, and paste the test Sheet
link. The test owner completed consent and successfully connected it. Other
staff need their own Google account with access to the test Sheet. No sharing
permissions were widened during setup.

Select **Include team traffic**, filter to a video or keyword, and apply filters
to inspect test events. The default view excludes team traffic. Use **Reload
data** after generating events in the recommender. Dashboard filters are local
to each viewer and do not edit shared Sheet content.

## Deployment

The separate **FCNY Analytics — Test** Apps Script project is
`1Ta3c_6ZZ3-54dooDEYQKIdZVLXe20j9uV8UT8xEpTNEkyZ0HvscYxsEw`.
Version 2 runs as **User accessing the web app**, with access limited to
**Anyone with Google account**. File reads also require actual permission to a
Restricted Sheet. An unauthenticated HTTP request returned a 302 to
accounts.google.com. The app has no anonymous analytics read endpoint.

The service comes from `build/apps-script-admin/Code.js`, with the built
`Dashboard.html` and manifest. STACKDRIVER exception logging was retained.
Version 2 fixes HtmlService inline-script processing: its rewriter stripped part
of a URL inside a JavaScript template literal. The build now converts template
literals to ordinary strings and checks both JavaScript parsing and the absence
of template-literal AST nodes before producing the private app.

Use **Deploy → Manage deployments → Edit → New version** to update this same
URL. Build from the reviewed PR head and replace only the app's generated files.
Keep visitor execution and Google-account access. Reverify native rendering,
consent, file ACLs and totals after an update. Do not roll back to version 1,
which had the blank-page syntax error. Disable access with the optional
`ANALYTICS_ADMIN_ENABLED=false` kill switch if required.

## Collection and retention

The existing test collector remains deployed at the endpoint documented in
[the catalog/usage deployment record](../../apps-script/test-deployment.md).
Its current catalog contains 89 videos; existing content and collector source
were preserved.

Verified Script Properties are `USAGE_LOGGING_ENABLED=true`, retention **1 day**,
maximum **20 events/minute**, **100/day**, and **1,000 rows**. The usage file is the
same private test Sheet linked above. Browser previews use the test endpoint for
both catalog reads and usage delivery and display the matching test notice.
The existing hourly `purgeUsageLog` trigger has daily failure notifications.
Its latest observed run was Oct 29 at 1:06 PM with a 0% error rate. The trigger
settings confirmed Every hour; no replacement trigger was installed. Production
builds keep logging disabled.

Direct dashboard reads use the labeled conservative last-24-hours window because
this Sheet has no approved reporting-policy metadata. No reporting workbook,
policy metadata, producer triggers or production approvals were invented for the
test. Historical events without matching catalog metadata remain unmapped.

## Reconciliation evidence

- A controlled backend test sent one canonical-keyword search, one impression
  and one embed click, all with `src=team`. Each returned `accepted`. Resending
  the same impression returned `duplicate`.
- The actual browser preview loaded the 89-video test catalog. A synthetic grant
  reporting search with ChatGPT selected displayed three results. Clicking the
  first video's embed generated a click.
- The authenticated dashboard connected by Sheet link and loaded 89 videos from
  the real test Sheet. With team traffic included and that video's ID selected,
  it showed **1 appearance, 1 embed click, 0 YouTube clicks**.
- Its keyword drill-down showed four canonical associations, each with one
  appearance and one embed click: three task keywords and ChatGPT. The original
  typed goal was not an analytics field. These associations are not additive
  video totals and do not prove causation or watched percentage.
- The public `/admin/analytics/preview` route stays synthetic. Use the private
  Google URL above for collected data. Percentage watched remains unavailable.

Native Google authorization and a real browser-to-collector-to-Sheet-to-dashboard
path are verified for the test owner. This does not prove every intended staff
member's file permission, production traffic readiness or production approval.
