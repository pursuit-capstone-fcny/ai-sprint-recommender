# FCNY handoff

## Staff workflow

- **Publish a catalog change.** Edit the Video Tracker, review the task tags and
  instruction format, then set **Metadata status** to `Ready`. Open
  **Library → Publish library**, select **Review changes**, and publish. Use
  **Check status** to confirm the live catalog changed. For a retirement, change
  the video's publication status and follow the same review and publish steps.
  [Video Tracker guide](analytics/tracker-maintenance.md#staff-workflow)
- **Open analytics.** Select **Admin analytics** in the learner site's footer
  and sign in with a Google account that has access to the Restricted source
  workbook. The dashboard opens that workbook automatically. Counts cover
  recorded activity in the displayed period. A click records an action to open
  or play a video. [Dashboard guide](analytics/dashboard.md#staff-access-open-the-dashboard)
- **Review suggestions and demo offers.** The designated reviewer checks the
  Restricted queue weekly and updates each entry's status. Confirm its location
  with the collector owner. The November 3 migration to the library workbook's
  `Requests` tab was verified on a private test copy. Follow the migration and
  rollback instructions before switching the live queue.
  [Requests setup](contribution-requests.md#configuration-and-isolation)

## Confirm ownership and access

Record a named FCNY primary and backup, the live target, and the last verified
version for each service in FCNY's private operations record.

| Service                       | What the incoming owner needs                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub and Cloudflare         | Repository and Actions administration, app and catalog Worker access, billing, and the ability to rotate deploy credentials.                                                                                                                                                                                                                                                          |
| Video Tracker and publisher   | Ownership of the Restricted workbook and bound Apps Script project, approved staff access, the Sheet-open trigger, and the repository-scoped publishing credential. [Publisher setup](analytics/library-publishing.md#publisher-installation)                                                                                                                                         |
| Usage, feedback, and requests | Collector project and deployment access, Script Properties, Restricted data/report access, and ownership of purge and report triggers. Record the request reviewer and approved retention. [Usage setup](../apps-script/usage-README.md#configuration-and-ownership) · [Feedback setup](private-feedback.md) · [Requests setup](contribution-requests.md#configuration-and-isolation) |
| Private analytics             | Separate Apps Script project, deployment URL, and Restricted source workbook access. Confirm that the app executes as the signed-in visitor. [Admin setup](analytics/dashboard.md#technical-deployment-once)                                                                                                                                                                          |
| Haiku AI                      | Provider account and billing access, approved data handling and spend limits, and the ability to rotate the server-side API key. [Runtime configuration](recommendation-runtime.md#separate-runtime-configuration)                                                                                                                                                                    |

Keep credential values in GitHub Actions secrets, Cloudflare Worker secrets, or
Apps Script properties, as specified by each setup guide. Confirm which features
are enabled and which approvals apply in the live environment. The
[November 2 production record](analytics/production-enablement.md) describes
that rollout. Verify current ownership, flags, and limits in the live settings.

### Transfer Apps Script deployments

Transferring an Apps Script project leaves its existing versioned deployments
owned by their original deployer. If that account will be retired, use an
FCNY-controlled account to create and verify replacement deployments first.
[Google deployment ownership](https://developers.google.com/apps-script/concepts/deployments#versioned_deployments)

1. Confirm the FCNY owner can deploy the collector and the separate private
   dashboard. Configure the Restricted workbook. Before migrating Requests,
   confirm every named workbook member is approved to view demo contact details.
2. Use **Deploy → New deployment** for each service the outgoing account owns.
   Keep the collector's approved execution and access settings. Configure the
   dashboard to execute as the signed-in visitor. Under the incoming account,
   install applicable publisher, retention and reporting triggers. Check the
   trigger schedules and remove duplicates as part of the cutover.
3. Update `CATALOG_PRODUCTION_URL` and the endpoint in `REQUESTS_CONFIG` if the
   collector URL changes. Update `ADMIN_ANALYTICS_PRODUCTION_URL` if the dashboard
   URL changes. Keep the prior URLs and versions in the private operations record
   for rollback, then run **Deploy production**.
4. Confirm the replacement collector delivers approved test submissions to the
   intended tabs and that cleanup runs. Check dashboard access with an authorized
   and an unauthorized account. Retire the old deployments or account after the
   checks pass.

## Set Haiku AI limits

FCNY decides how many Haiku requests to allow and how much to spend. The
production build currently uses these settings. Deterministic search runs in
the browser and is unaffected by these limits.

| Setting                          | Current value | What it controls                                                    |
| -------------------------------- | ------------- | ------------------------------------------------------------------- |
| `LLM_CLIENT_REQUESTS_PER_MINUTE` | `3`           | Paid requests per clock minute for one browser page on one network. |
| `LLM_REQUESTS_PER_MINUTE`        | `1000`        | Paid requests per clock minute across the site.                     |
| `LLM_MAX_CONCURRENCY`            | `32`          | Provider calls that can be in flight at once.                       |
| `LLM_DAILY_MICRODOLLARS`         | `1000000`     | $1 daily spending cap.                                              |
| `LLM_MONTHLY_MICRODOLLARS`       | `5000000`     | $5 monthly spending cap.                                            |

Changing the goal still uses the same page allowance. A request can count once
the server admits it, even if the learner cancels before seeing results. When the
page allowance runs out, Haiku returns fallback videos until the next clock minute.
The sitewide limits and spending caps also apply.

1. Have FCNY's service owner approve the limits against the expected usage,
   provider capacity, and budget. Record the approved values in the private
   operations record.
2. In a pull request, edit the production values in
   [`scripts/configure-library-app.mjs`](../scripts/configure-library-app.mjs).
   Use positive whole numbers. The app accepts up to 100 requests per page per
   minute, 10,000 sitewide per minute, and 100 concurrent calls. Enter budgets
   in microdollars ($1 = 1,000,000) and keep the daily cap at or below the monthly
   cap. [Runtime validation](../server/config.ts)
3. Run `pnpm test` and use the [local synthetic burst check](analytics/backend-scaling.md#reproduce-without-paid-calls)
   for throughput changes. After merging, confirm **Deploy production** succeeded
   and verify the deployed Worker variables in Cloudflare. The workflow regenerates
   those values on every deploy, so make lasting changes in the source script.

To pause Haiku, set the GitHub repository variable `LLM_PRODUCTION_ENABLED` to
`false` and rerun **Deploy production**. To roll back a limit change, revert the
values through a pull request and verify the redeployment. Keep the budget
storage so existing spend remains accounted for.

## Release and recovery

1. **App code.** Use a PR and check its Cloudflare preview. Merging to `main`
   runs [Deploy production](../.github/workflows/deploy.yml). It builds against
   `LIBRARY_PRODUCTION_ORIGIN` and generates the Worker configuration. For a code
   rollback, revert the change through a PR and verify the redeployment. Keep
   registered Durable Object classes and migrations in the rollback build.
   [Runtime recovery](analytics/backend-scaling.md#disable-and-recover)
   Set `ADMIN_ANALYTICS_PRODUCTION_URL` to FCNY's private dashboard deployment.
   If enabling Requests in PR previews, use `REQUESTS_PREVIEW_CONFIG` with an
   independent Apps Script project and Restricted test workbook.
   [Dashboard setup](analytics/dashboard.md#technical-deployment-once)
   · [Preview Requests setup](contribution-requests.md#enable-requests-in-a-preview)
2. **Catalog content.** The
   [catalog workflow](../.github/workflows/publish-library.yml) deploys the
   catalog independently. Check `/catalog/current.json` at the catalog origin
   and refresh the learner app after a publish. If needed, republish a known-good
   snapshot through the [catalog workflow](analytics/library-publishing.md#publisher-installation)
   to preserve historical versions.
3. **Apps Script.** Build the producer with `pnpm build:apps-script` and the
   private dashboard with `pnpm build:admin`. For routine releases, update each
   deployment in place and record the prior version for rollback. When ownership
   changes, follow [the transfer procedure](#transfer-apps-script-deployments).
   If using buffered usage, follow the
   [collector-first deployment order](analytics/backend-scaling.md#collector-first).
4. **Verify.** On an isolated preview, load the catalog, submit a fictional goal,
   and open a result. For data-path changes, confirm an accepted test event
   reaches the Restricted `Usage` tab and dashboard. Check access with both an
   authorized and unauthorized account. If feedback or requests changed, confirm
   each enabled action reaches its intended destination and its cleanup trigger runs.
5. **Pause a feature.** Set the relevant repository variable
   (`LLM_PRODUCTION_ENABLED`, `USAGE_PRODUCTION_ENABLED`,
   `FEEDBACK_PRODUCTION_ENABLED`, or `REQUESTS_PRODUCTION_ENABLED`) to `false`
   and rerun the production workflow. For a collector-side stop, use the
   corresponding Script Property in its setup guide. Keep approved retention
   jobs running. Disabling the usage buffer discards pending events. For private
   dashboard access, set `ANALYTICS_ADMIN_ENABLED=false` and review workbook
   permissions.

## Where to look when something fails

| Symptom                             | First check                                                                                                                                                                                                              |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A video change is missing           | Check the publisher status and current catalog manifest. A failed publish leaves the previous version live. [Publishing recovery](analytics/library-publishing.md#publisher-installation)                                |
| The dashboard shows **Unavailable** | Check the configured source workbook, named staff access, and the `Usage` tab. An existing empty Usage table represents zero retained events. [Dashboard access](analytics/dashboard.md#staff-access-open-the-dashboard) |
| Usage counts lag                    | If buffering is enabled, confirm the collector wrote the accepted event to the Sheet. The Worker acknowledgement confirms it entered the buffer. [Buffer delivery](analytics/backend-scaling.md#collector-first)         |
| Haiku returns fallback cards        | Capture the response reason and `x-recommendation-request-id` from `/api/recommendations`. Keep the learner's goal out of the incident report. [Failure handling](recommendation-runtime.md#spend-and-failure-handling)  |
