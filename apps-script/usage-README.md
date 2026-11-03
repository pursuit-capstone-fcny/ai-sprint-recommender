# Usage backend

Implements [approved #16](../docs/specs/016-usage-logging.md). The test Apps Script
deployment serves version 3. The browser sender is enabled only in configured
test previews; production logging remains off.

## Browser sender

The preview workflow sets `VITE_USAGE_ENVIRONMENT=test`, `VITE_USAGE_ENABLED=true`
and `VITE_USAGE_TEST_URL` only when `CATALOG_TEST_URL` exists. The URL must be an
HTTPS Apps Script `/exec` endpoint and equal the remote catalog URL. Fixtures
never log. Production explicitly sets environment `production`, flag `false`
and an empty usage URL; the sender also rejects production configuration.

Find videos commits the draft inputs and creates a search context. Typing does
not submit. Initial picks and Clear log displayed-card impressions without a
search event. Show more keeps the context and logs only new cards. Embed and
YouTube clicks retain that context and rank, even while inputs have unsent edits.
Copy link is not logged. Session IDs and source tags live only in page memory;
there are no cookies, storage entries, background sync or persistent retries.

Goal tasks recognize the published task wording, its equivalent engine task
name and published task aliases, and return only the original served dictionary
values. For example, RFP wording can log `grant opportunity review` without
serializing an internal task name. This is keyword co-occurrence, not proof of
semantic usefulness, and never derives search keywords from returned videos.
The sender never serializes raw goals, reasons, titles, URLs or referrers.
Only the `src` query parameter is read for attribution, with
missing/unknown values normalized to `website`/`other`.

Only deterministic `strong` results count as strong. Other cards map to
`start-here` when that designation has no matching signals, `cross-area` when outside a selected
area, or `weak`. Search fallback type describes cross-area/start-here cards in
the initial result set, or `none` when neither is used. Empty sets use
`unavailable`. This mapping does not change ranking or infer LLM success.

Delivery is serial, with at most 32 waiting events plus one in flight. Queued
events expire after 60 seconds. Each attempt has a ten-second deadline covering
both fetch and response parsing. Requests use `keepalive`, omit credentials and
referrers, and set no custom headers. Only `USAGE_BUSY` gets one immediate retry
with the identical payload. Network, opaque and invalid responses are dropped;
disabled/full responses stop automatic delivery for the rest of the visit.
A rate-limit response with a valid `retryAfterMs` suppresses automatic traffic
until that cooldown expires. Only fresh actions after expiry may send; blocked
and previously queued automatic events are dropped, with no scheduled retry or
replay. Missing or invalid cooldown metadata retains the legacy stop until
reload. Spec #29 still allows a new explicit learner action to retry feedback
during a temporary rate limit, reusing its event ID and context. Shorter later
hints never shorten an existing cooldown. Disabled/full collectors stay stopped.
Navigation may lose queued events, and an acknowledgment is required to count
delivery as confirmed. Counts remain estimates.

The test notice states one-day retention with hourly cleanup. Keep that notice
and the test Script Properties in agreement. This is not production approval.

## Event contract

`src/contracts/usageEvent.ts` exports the strict version 1 schema and catalog
reference validator for the backend and browser sender. A POST contains one JSON
object, encoded as `text/plain`, at most 16,384 UTF-8 bytes.

| Fields                                              | Rule                                                                                                                                                                                         |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`, `eventId`, `sessionId`, `searchId` | Version 1 and UUIDs, normalized to lowercase                                                                                                                                                 |
| `type`, `time`, `mode`, `src`, `catalogVersion`     | Search/impression/click; UTC ISO time; recommendations/topic/direct; approved source or `other`; current catalog SHA-256 version                                                             |
| Search                                              | `functionArea` as one canonical tag or `null`, optional unique `functionAreas` for topic-mode multi-selection, unique `tools` and `tasks`, `resultCount`, `strongMatchCount`, `fallbackType` |
| Impression/click                                    | Active `youtubeId`, one-based `rank`, `matchType`; click also requires `target` as `embed` or `youtube`                                                                                      |
| Recommendation mode                                 | `recommendationEngine` and `llmFallbackReason`; LLM success requires a configured `modelVersion`/`promptVersion` pair                                                                        |

Recommendation metadata is absent in topic/direct mode. Rules events use a reason
such as `not-requested`, `disabled` or `timeout`; LLM success uses `none`.
Model/prompt versions, when present, must be paired and match the server allowlist.
Reason codes are fixed enums, never provider error text.

The schema uses the proposed match/fallback enums in #16. Ahsan's internal
`strong`/`fallback` ranking contract is unchanged. The sender maps
verified signals to the usage enums and never sends `fallback` as `matchType`.
`semantic` requires LLM recommendations; direct views use `matchType=direct`
and never emit a search event. Enum agreement with #11–#14/#24 remains open.

Missing `src` means `website`; unrecognized strings become `other`. Search tags
must match the server's current dictionary exactly, with no aliases or raw goals.
Unknown fields, including `receivedAt`, are rejected. Tags are limited to 120
characters, 50 per array; counts/ranks to 1,000. These are validation ceilings,
not approved traffic limits.

Events more than one hour old or five minutes ahead of server time are dropped.
A stale catalog version is also dropped, without remapping the event. This bounds
retry lifetime and prevents an unchanged retry from recreating a purged row.
Use the same event ID for any bounded retry. Missing/opaque responses are not
proof of delivery; counts remain estimates because anyone can forge events.

## Storage and acknowledgments

`Usage` has exactly three columns: `eventId`, `receivedAt`, `eventJson`.
The server supplies `receivedAt`; `eventJson` contains only the parsed schema.
Cells use plain-text format. The JSON cell starts with `{`, so even a canonical
tag starting with `=` cannot become a formula. No raw client field is written
directly as a spreadsheet cell.

One script lock covers reading retained IDs and server timestamps, checking
limits, validating catalog references, appending and flushing. Duplicate IDs
return success without another append, including a retry after an uncertain
flush. Deduplication lasts for retained rows; changing an ID or event time is
a new forged submission, not authenticated activity.

The backend enforces a rolling-minute cap, a UTC-day cap, and a retained-row
cap using durable rows. All accepted event types count toward the caps. No IPs,
cookies, per-user rate keys or client secrets are needed. The hard ceiling is
10,000 rows; each request reads at most that many IDs/timestamps.

ContentService returns JSON envelopes, not custom HTTP status codes:

- `{"ok":true,"status":"accepted"}` after append and flush.
- `{"ok":true,"status":"duplicate"}` for an existing ID.
- `{"error":{"code":"USAGE_…"}}` for disabled, invalid, busy, full,
  rate-limited or unavailable requests. Responses never echo submitted values.
- Rate limits add integer `retryAfterMs` from 1 through 86,400,000. The delay
  covers the latest required expiry of the currently exceeded rolling-minute
  and UTC-day caps. It is a cooldown, not a delivery promise: other traffic may
  consume capacity before the next action. All configured caps still apply.

### Cooldown rollout

Deploy the rebuilt collector bundle through the existing Apps Script release
process before the browser build. Older browsers ignore the additional receipt
field and keep their previous suppression behavior. New browsers talking to an
older collector also retain that behavior until reload; no cap is inferred or
increased. Existing open pages keep their loaded sender until reload.

Use isolated synthetic events to verify rolling-minute expiry, UTC midnight,
duplicate acknowledgments and retained-row stops before production rollout.
The sender/collector tests exercise these rules in memory; they do not establish
live deployment or Sheet reconciliation. Keep existing collection enablement,
retention, sharing, and traffic settings.

With logging enabled, execution logs record only these fixed `usage-post`
outcomes. Count error outcomes for server-observed drops; browser/network losses
before `doPost` are unknowable. Count accepted rows by receipt date and parsed
event type/source for #24. The public GET never reads or returns `Usage`.

## Configuration and ownership

Set these Script Properties separately in each environment. No defaults enable
logging or choose a retention/traffic policy.

| Property                        | Value                                                                                                                        |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `USAGE_LOGGING_ENABLED`         | Only literal `true` enables ingestion; absent/false disables it                                                              |
| `USAGE_SPREADSHEET_ID`          | Explicit private usage spreadsheet ID; never inferred from the active Sheet                                                  |
| `USAGE_RETENTION_DAYS`          | Approved integer 1–365                                                                                                       |
| `USAGE_MAX_PER_MINUTE`          | Approved positive integer, at most the daily cap                                                                             |
| `USAGE_MAX_PER_DAY`             | Approved positive integer, at most the row cap                                                                               |
| `USAGE_MAX_ROWS`                | Approved positive integer, at most 10,000                                                                                    |
| `USAGE_RECOMMENDATION_VERSIONS` | Optional JSON array of exact `{"modelVersion":"…","promptVersion":"…"}` pairs, at most 20; absent means no versions accepted |
| `CATALOG_SPREADSHEET_ID`        | Existing #9 catalog source for authoritative tags, IDs and version                                                           |

1. Keep production logging off until Ali approves #8's collection, retention,
   notice and limits. Production script, usage spreadsheet and purge trigger
   must belong to FCNY. Use synthetic events in a separate private test file.
2. Restrict the **entire usage spreadsheet** to the approved staff accounts.
   Hiding or protecting a tab does not restrict who can read it. A shared catalog
   spreadsheet is suitable only if all its readers may read usage data.
3. Build with `pnpm build:apps-script` or `pnpm build:apps-script:test`, then
   update the existing environment's Apps Script bundle and deployment version.
   The bundle exposes `doPost`, `initializeUsageLog` and `purgeUsageLog` alongside
   #9's `doGet`. It requires no additional OAuth scope.
4. Configure the private file and approved retention. Run `initializeUsageLog`
   from the editor. It creates an empty `Usage` tab or verifies its header,
   and refuses to overwrite other content. Public requests never create tabs.
5. Have the FCNY owner install a time-driven `purgeUsageLog` trigger and monitor
   failures. Choose its cadence to meet the approved deletion window and state
   the maximum delay in the notice. It removes rows at or past the receipt-time
   retention boundary, in groups from the bottom, under the same lock. It runs
   even with ingestion disabled and does not depend on the write-cap properties.
6. Verify the test POST, duplicate, cap and purge cases below before enabling
   production. Version 3 of the test deployment serves the #16 backend.

Do not manually edit/delete log rows to reset caps, and do not share one usage
file across independently deployed scripts with different locks. Corrupt headers,
timestamps or an exceeded hard row ceiling stop ingestion/purging for inspection.
Purging removes live rows; Google revision/backup retention needs separate #8
review. Purge deletions cannot be undone by rolling back code.

The caps bound accepted Sheet writes, not anonymous request volume or Google's
execution/logging quota. Before launch, load-test the agreed peak traffic and
catalog contention. If that is insufficient, use ADR-0002's proxy design with
a server-only upstream credential. Never put a secret in the SPA.

Run `pnpm check:usage-capacity fixtures/usage-capacity-1000-users.json` for the
offline 1,000-user policy preflight. The recorded limits intentionally fail this
scenario. See [capacity target, simulation limits and release sequence](../docs/analytics/capacity.md)
before interpreting a passing simulation as release readiness.

## Remaining #16 work

- Topic/direct-video event contexts when those routes are implemented.
- Production disclosure and environment configuration after #8 approval.
- Owner approval of the proposed enums and concrete retention/traffic limits.
- Trigger-driven purge with synthetic aged rows and peak-traffic load testing.
  Test POST, CORS, concurrent duplicates, both targets, Unicode limits and capped
  writes passed on version 3. See the test deployment record for browser checks.

Local tests cover schema privacy, references, UTF-8 size, lock contention,
durable retry deduplication, caps, literal storage, initialization and retention.
`pnpm build` also checks that the generated global `doPost` forwards its event.
Rollback ingestion by setting `USAGE_LOGGING_ENABLED=false`; keep the purge
trigger running. A personal-data row is a stop-and-delete signal under #16.

References: [web app request events](https://developers.google.com/apps-script/guides/web),
[setValues formula handling](<https://developers.google.com/apps-script/reference/spreadsheet/range#setValues(Object)>),
[flush before releasing a lock](https://developers.google.com/apps-script/reference/lock/lock).

## MVP analytics

The #24 reporting adapter builds restricted aggregate tables in a **separate**
reporting spreadsheet and captures public catalog snapshots when opted in.
See [dashboard setup and acceptance](../docs/analytics/dashboard.md) for explicit
properties, per-view Looker filters, trigger authorization, retention, error
recovery and the remaining FCNY deployment gates. No analytics read operation is
added to the public web app, and production logging remains off.

### Staff topic search

The private analytics app can send mode=topic, src=team events to the existing
approved collector. Search events may include functionAreas, an array of
canonical filter tags. When present, functionArea is its only entry or null for
zero/multiple entries. This additive field is topic-only. Older events remain
readable. Reporting counts each selected function area once per search. Deploy
the updated collector and private report before enabling admin TOPIC_USAGE_*
settings. No raw topic wording is collected. Existing caps, retention and
best-effort delivery remain in force.
