# Test catalog and usage deployment

Verified October 20, 2026. This environment uses the user's test copy; production
configuration was not changed.

- [Test Sheet](https://docs.google.com/spreadsheets/d/1UO6Biq_clsL8kqmHyBN2qChJ8nbLSwclY_Jdg499xHY/edit#gid=1125105544)
- [Bound Apps Script project](https://script.google.com/home/projects/144EKtE55YFjUMCvgH0PBOr7-58qYChjXL8oBjVXrnZFIBi337CyuINW-/edit)
- [Public test endpoint](https://script.google.com/macros/s/AKfycbz-MZXRuXo997pUlBO_bZa3ClUAp-vZSOHbpszXcHJ7N6BtqCdeGi4CNXUxWy39pTev/exec)
- [Verified browser-sender preview](https://8767134e-ai-sprint-recommender.jason-zeng151.workers.dev/?src=pilot)
- [Private Usage tab](https://docs.google.com/spreadsheets/d/1UO6Biq_clsL8kqmHyBN2qChJ8nbLSwclY_Jdg499xHY/edit#gid=1794036058)

## Configuration

| Setting                    | Value                                                                       |
| -------------------------- | --------------------------------------------------------------------------- |
| Project                    | FCNY Catalog — Test                                                         |
| Owner / execute as         | `jason.zeng151@gmail.com`                                                   |
| Access                     | Anyone, including signed-out visitors                                       |
| Script ID                  | `144EKtE55YFjUMCvgH0PBOr7-58qYChjXL8oBjVXrnZFIBi337CyuINW-`                 |
| Deployment ID              | `AKfycbz-MZXRuXo997pUlBO_bZa3ClUAp-vZSOHbpszXcHJ7N6BtqCdeGi4CNXUxWy39pTev`  |
| Current / previous version | 3 / 2                                                                       |
| Deployed source            | `e6d0107`, generated `build/apps-script-test/Code.js` saved as `Catalog.gs` |
| `CATALOG_ENVIRONMENT`      | `test`                                                                      |
| `CATALOG_SPREADSHEET_ID`   | `1UO6Biq_clsL8kqmHyBN2qChJ8nbLSwclY_Jdg499xHY`                              |
| `CATALOG_PUBLIC_ENABLED`   | `true`                                                                      |
| `USAGE_LOGGING_ENABLED`    | `true`, test project only                                                   |
| `USAGE_SPREADSHEET_ID`     | Same private test Sheet                                                     |
| `USAGE_RETENTION_DAYS`     | `1`                                                                         |
| `USAGE_MAX_PER_MINUTE`     | `20`                                                                        |
| `USAGE_MAX_PER_DAY`        | `100`                                                                       |
| `USAGE_MAX_ROWS`           | `1000`                                                                      |
| GitHub variable            | `CATALOG_TEST_URL`, set to the endpoint above                               |

Google Sheets access was authorized by the user. The copied formatting script
in `Code.gs` and existing manifest settings were preserved. The Sheet itself
remains private; GET exposes only validated public catalog fields. POST accepts
validated events and never returns stored usage data. The test owner installed
an hourly `purgeUsageLog` trigger with daily failure notifications.

The initializer created Catalog, Dictionary, Synonyms, Adjacent tools and
Problems. It imported ten published videos and 53 dictionary entries. Mapping
tabs have headers only. Proposed tags remain unapproved in the source tab.
Upload dates and lengths are unknown; no start-here designations were invented.

## Verification

- Unauthenticated GET followed Google's ContentService redirect and returned
  JSON matching the shared contract, with no extra fields.
- The preview loaded the real catalog without Google sign-in. Its function-area
  choices, ChatGPT option, ranking and unknown-length labels worked.
- Changing `Catalog!B2` appeared on the next GET in 4.2 seconds and in the
  preview after refresh. The catalog version changed.
- Setting `Catalog!I2` to `retired` removed the video from the endpoint and
  preview. The endpoint returned nine items.
- Both cells were restored. The endpoint returned ten items and its original
  version, `sha256:a53648caa7bf1b84ac288548358ae85ef0094e892edb385453c2d9b8c89c2f81`.
  Problems contained only its header.
- Updates through version 3 retained the deployment ID and URL. Version 3 adds
  the #16 backend; version 2 remains available for rollback.
- Version 3 passed synthetic POST, CORS, concurrent-duplicate, both-target,
  Unicode-size and capped-write checks. Five accepted backend-test events were
  verified in `Usage!C2:C6`.

### Browser sender

[PR #73](https://github.com/pursuit-capstone-fcny/ai-sprint-recommender/pull/73),
commit `fb23edb`, was checked on the preview above, signed out of Google. Actual
saved payloads were read from `Usage!C7:C21`; `C22` was blank afterward.

- Initial rendering saved three impressions and no search. Typing a synthetic
  goal and selecting ChatGPT left the results and next log row unchanged.
- Find videos saved exactly one search and three impressions. The search had
  canonical `tools: ["ChatGPT"]`, empty tasks, three strong results and `src=pilot`.
  The raw goal and its marker were absent from every saved payload.
- Show more appended only ranks 4–6 in the same search context. Embed and
  YouTube actions each appended one rank-1 click with the correct target.
- Reload appended three initial impressions with a new session and context.
  All 15 event IDs were unique. The notice displayed one-day retention and
  hourly cleanup, matching the test configuration.

The 257 automated tests also cover StrictMode/rerender deduplication, repeated
submissions, Clear, offline/stalled delivery and production configuration sending
no POST even with a test URL present. Both PR CI and preview checks passed.
The production workflow hard-codes logging off; this check did not deploy or
enable production logging.

Observed GET checks took 3.6–7.8 seconds. These are individual test measurements,
not a latency guarantee.

## Update or roll back

Build with `pnpm build:apps-script:test`, then replace only `Catalog.gs`.
Do not rerun the initializer or replace the existing source tabs.

Use **Deploy → Manage deployments → Edit** on the deployment above, select
**New version**, and deploy. Keep its owner, access and Script Properties.
Run `pnpm check:catalog <endpoint>` and verify the preview after updating.

For rollback, select the previous version on the same deployment. To stop
serving catalog data immediately, set `CATALOG_PUBLIC_ENABLED=false`; the page
will show its unavailable state. Stop ingestion with `USAGE_LOGGING_ENABLED=false`
and leave the purge trigger running.

Clasp automation, FCNY production deployment, production browser checks,
trigger-driven purge with aged rows and peak-traffic testing remain open. Topic
and direct-video event contexts await their routes. Test approval does not
approve production collection, data or anonymous access.
