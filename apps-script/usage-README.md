# Usage backend

Backend slice of [approved #16](../docs/specs/016-usage-logging.md), stacked on
#9. The page does not send events yet. No live deployment or logging flag changes
are part of this PR.

## Event contract

`src/contracts/usageEvent.ts` exports the strict version 1 schema and catalog
reference validator for the backend and future sender. A POST contains one JSON
object, encoded as `text/plain`, at most 16,384 UTF-8 bytes.

| Fields                                              | Rule                                                                                                                             |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`, `eventId`, `sessionId`, `searchId` | Version 1 and UUIDs, normalized to lowercase                                                                                     |
| `type`, `time`, `mode`, `src`, `catalogVersion`     | Search/impression/click; UTC ISO time; recommendations/topic/direct; approved source or `other`; current catalog SHA-256 version |
| Search                                              | `functionArea` as one canonical tag or `null`, unique `tools` and `tasks`, `resultCount`, `strongMatchCount`, `fallbackType`     |
| Impression/click                                    | Active `youtubeId`, one-based `rank`, `matchType`; click also requires `target` as `embed` or `youtube`                          |
| Recommendation mode                                 | `recommendationEngine` and `llmFallbackReason`; LLM success requires a configured `modelVersion`/`promptVersion` pair            |

Recommendation metadata is absent in topic/direct mode. Rules events use a reason
such as `not-requested`, `disabled` or `timeout`; LLM success uses `none`.
Model/prompt versions, when present, must be paired and match the server allowlist.
Reason codes are fixed enums, never provider error text.

The schema uses the proposed match/fallback enums in #16. Ahsan's internal
`strong`/`fallback` ranking contract is unchanged. The future sender must map
verified signals to the usage enums; it must not send `fallback` as `matchType`.
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
   production. The current #9 test deployment still serves its previous bundle.

Do not manually edit/delete log rows to reset caps, and do not share one usage
file across independently deployed scripts with different locks. Corrupt headers,
timestamps or an exceeded hard row ceiling stop ingestion/purging for inspection.
Purging removes live rows; Google revision/backup retention needs separate #8
review. Purge deletions cannot be undone by rolling back code.

The caps bound accepted Sheet writes, not anonymous request volume or Google's
execution/logging quota. Before launch, load-test the agreed peak traffic and
catalog contention. If that is insufficient, use ADR-0002's proxy design with
a server-only upstream credential. Never put a secret in the SPA.

## Remaining #16 work

- Browser sender, in-memory session/context IDs, canonical tag extraction, event
  timing/deduplication, source handling and the approved disclosure.
- Owner approval of the proposed enums and concrete retention/traffic limits.
- Live isolated deployment: signed-out `text/plain` POST, acknowledgment/CORS,
  two simultaneous copies of one event, both click targets, Unicode payload
  rejection, capped writes, and trigger-driven purge with synthetic aged rows.
  Confirm preview writes never reach production and #9 GET still works.
- Signed-out page checks for search, Show more, rerenders, navigation and offline
  behavior once the sender exists.

Local tests cover schema privacy, references, UTF-8 size, lock contention,
durable retry deduplication, caps, literal storage, initialization and retention.
`pnpm build` also checks that the generated global `doPost` forwards its event.
Rollback ingestion by setting `USAGE_LOGGING_ENABLED=false`; keep the purge
trigger running. A personal-data row is a stop-and-delete signal under #16.

References: [web app request events](https://developers.google.com/apps-script/guides/web),
[setValues formula handling](<https://developers.google.com/apps-script/reference/spreadsheet/range#setValues(Object)>),
[flush before releasing a lock](https://developers.google.com/apps-script/reference/lock/lock).
