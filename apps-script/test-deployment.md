# Test catalog deployment

Verified October 20, 2026. This environment uses the user's test copy; production
configuration was not changed.

- [Test Sheet](https://docs.google.com/spreadsheets/d/1UO6Biq_clsL8kqmHyBN2qChJ8nbLSwclY_Jdg499xHY/edit#gid=1125105544)
- [Bound Apps Script project](https://script.google.com/home/projects/144EKtE55YFjUMCvgH0PBOr7-58qYChjXL8oBjVXrnZFIBi337CyuINW-/edit)
- [Public test endpoint](https://script.google.com/macros/s/AKfycbz-MZXRuXo997pUlBO_bZa3ClUAp-vZSOHbpszXcHJ7N6BtqCdeGi4CNXUxWy39pTev/exec)
- [Verified Cloudflare preview](https://facb3172-ai-sprint-recommender.jason-zeng151.workers.dev)

## Configuration

| Setting                    | Value                                                                       |
| -------------------------- | --------------------------------------------------------------------------- |
| Project                    | FCNY Catalog — Test                                                         |
| Owner / execute as         | `jason.zeng151@gmail.com`                                                   |
| Access                     | Anyone, including signed-out visitors                                       |
| Script ID                  | `144EKtE55YFjUMCvgH0PBOr7-58qYChjXL8oBjVXrnZFIBi337CyuINW-`                 |
| Deployment ID              | `AKfycbz-MZXRuXo997pUlBO_bZa3ClUAp-vZSOHbpszXcHJ7N6BtqCdeGi4CNXUxWy39pTev`  |
| Current / previous version | 2 / 1                                                                       |
| Deployed source            | `ef9aff2`, generated `build/apps-script-test/Code.js` saved as `Catalog.gs` |
| `CATALOG_ENVIRONMENT`      | `test`                                                                      |
| `CATALOG_SPREADSHEET_ID`   | `1UO6Biq_clsL8kqmHyBN2qChJ8nbLSwclY_Jdg499xHY`                              |
| `CATALOG_PUBLIC_ENABLED`   | `true`                                                                      |
| GitHub variable            | `CATALOG_TEST_URL`, set to the endpoint above                               |

Google Sheets access was authorized by the user. The copied formatting script
in `Code.gs` and existing manifest settings were preserved. The Sheet itself
remains private; the web app exposes only validated public catalog fields.

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
- Updating the existing deployment from version 1 to version 2 retained the
  deployment ID and URL. Both versions use the same tested source.

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
will show its unavailable state.

Clasp automation, FCNY production deployment, production browser checks and
#16 POST acceptance remain open. Test approval does not approve production data
or anonymous production access.
