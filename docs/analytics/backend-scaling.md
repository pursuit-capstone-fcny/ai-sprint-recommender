# Deploying the 1,000-user backend

This implements the [backend scaling spec](../specs/backend-burst-scaling.md).
Deterministic ranking still runs in each browser. Haiku admission waits in the
existing budget Durable Object, and automatic usage events pass through a
same-origin durable buffer before the existing private Sheet collector.

AI spending remains $1/day and $5/month. Token ceilings and the $0.016192
maximum reservation per call are unchanged. Actual usage settlements release
unused reservation amounts. At the owner's reported average, 1,000 successful
calls cost about $0.55, provided budget is available. Unknown outcomes retain
their full reservation. Queueing cannot guarantee 1,000 successes after budget
depletion or provider failure. The [finance estimate](cost-estimate.md) remains
the source for daily/monthly projections; this change approves no new spending.

## Collector first

1. Build with `pnpm build:apps-script`. Deploy the production collector bundle
   through the existing Apps Script deployment procedure. Keep the current URL,
   Sheet, access controls, one-day retention and hourly purge.
2. Configure a fresh server-only `USAGE_BATCH_SECRET`, 32–256 characters, in
   Apps Script properties and the matching GitHub Actions secret. Never use a
   `VITE_` variable for it. The Worker secret installer preserves existing
   secrets; an intentional rotation requires updating both server copies.
3. Preserve the existing permitted recommendation versions and include the
   current `claude-haiku-5-5` / `catalog-pick-evidence-v9` pair. Run the editor-only
   `configureUsageBurst()` function. It sets technical ceilings to 20,000
   events/minute, 100,000/day and 100,000 retained rows. It does not enable logging,
   change retention, create a public read route or alter sharing.
4. Verify a small authenticated batch in an isolated collector deployment. Check
   individual accepted receipts, one write/flush and duplicate receipts on an
   identical replay. Check private dashboard counts and the purge trigger.
   Use fictional data only. A buffer receipt alone does not establish Sheet
   delivery. Native Apps Script lock/write quotas require this separate check.
5. Enable repository variable `USAGE_BUFFER_PRODUCTION_ENABLED=true` after the
   collector is ready. Existing `USAGE_PRODUCTION_ENABLED` still controls whether
   automatic collection is on. `CATALOG_PRODUCTION_URL` must be the existing exact
   HTTPS Apps Script `/exec` URL; the configuration script rejects invalid URLs
   or missing batch secrets before deployment.
6. Deploy through the existing production workflow. It first deploys the runtime
   with paid calls off, installs missing server secrets, then deploys the
   configured flags. Both deployment steps preserve the configured buffer flag
   so routine releases do not purge acknowledged events. Explicitly disabling
   buffering still erases pending events. No source file contains the shared secret.

The Worker validates strict schema, time, trusted public catalog references and
the model/prompt pair before enqueue. Eight shards each hold at most 4,000
pending events. Delivery is asynchronous, so dashboard counts can lag. Events
expire within one hour of their event time even during collector cooldowns.
Retries reuse event IDs; the collector deduplicates retained IDs under its lock.
Explicit feedback uses the existing direct collector and accepted receipt.
Anonymous events remain forgeable, so counts remain estimates.

## AI admission and provider capacity

Production admits up to 1,000 paid calls/minute and 32 in flight, bounded further
by maximum-cost reservations. It holds at most 1,000 waiters in memory, with no
raw goals in the Durable Object. A browser has a five-minute overall deadline;
each provider dispatch retains its 6.5-second deadline and has no paid retry.
Clear or a disconnected request cancels waiting work. Worker restarts may lose
waiters, while durable reservations continue to protect the spending caps.

An ephemeral page UUID lets separate browsers on one conference network use
their own three-per-minute allowance. It lives only in page memory and is never
sent to the provider, analytics or logs. It is not an identity or abuse-proof
credential. Global admission, queue, concurrency and spending limits remain
authoritative. Old clients without it retain their network limit.

Check the provider account's request/token throughput before the event. The
native synthetic check below proves application behavior with a fake provider,
not Anthropic throughput, latency, Cloudflare account quotas or Apps Script
write capacity. A separate small authorized native sample should establish those
dependencies before promising the event's completion time.

## Reproduce without paid calls

```sh
# Terminal 1, fresh SQLite state on every start; all internet access denied
pnpm dev:backend-burst
# Terminal 2
pnpm check:backend-burst
```

The pinned Workerd binary executes the actual Worker, budget and buffer classes
with an 89-item fictional public catalog, synthetic provider and SQLite-backed
collector running the real batch validation/report code. The provider holds
responses until all 1,000 requests arrive, so the check asserts 1,000 overlapping
client requests. It then processes 1,000 Deterministic and 1,000 Haiku searches,
each with eight impressions and one click, through the actual browser event
producer and buffered sender. The aggregate report is written to
`build/evaluation/backend-burst/report.json`.

Assertions require 1,000 AI successes, peak paid concurrency at most 32,
20,000 accepted events, 2,000 report searches, 16,000 appearances, 2,000 clicks
and 550,000 microdollars of simulated daily/monthly spending. Paid calls and
production Sheet writes are zero. Latencies describe only the local synthetic
dependencies. Start a fresh server before each run. This fixture is not imported
by either production Worker entry point and exposes no production diagnostic
route. Unit regressions separately cover unknown charges, cancellation, queue
overflow, restarts, redirects, cooldowns, expiry and lost receipts.

The November 3, 2026 native run passed with an input-token bound of 62,287,
1,000 overlapping requests, 1,000 AI successes, peak concurrency 32 and all
20,000 events reconciled. All 2,000 telemetry batches queued on their first
attempt. Local synthetic AI latency was p50 1,514 ms, p95 1,705 ms and p99
1,714 ms. Simulated spend was $0.55 against the unchanged caps. These timings
include the artificial arrival barrier and 25 ms fake provider, not real
inference. The recorded aggregate is [backend-burst-evidence.json](backend-burst-evidence.json).

## Disable and recover

- Disable `LLM_PRODUCTION_ENABLED` and/or `USAGE_BUFFER_PRODUCTION_ENABLED`, then
  redeploy to stop the corresponding feature. To stop all automatic collection,
  disable `USAGE_PRODUCTION_ENABLED` and collector `USAGE_LOGGING_ENABLED` too.
  The deployed buffer alarm erases pending events when disabled. With buffering
  alone off, the browser uses the existing direct sender and its lower capacity.
- Preserve the exported `UsageBuffer` class, binding and `usage-buffer-v1`
  migration after registration. Roll back behavior with flags or a forward fix;
  blindly deploying an older bundle that removes a registered class can fail.
  Do not reset the budget namespace or ledger.
- After collector outages, check aggregate buffer retry/removal logs, private
  accepted counts and dashboard joins. No raw event bodies or goals are logged.
  Expired or permanently rejected events are removed; delivery is best effort.
  If caps stop ingestion, report that loss instead of calling queued events
  delivered. Keep the existing purge and private Sheet access checks.
