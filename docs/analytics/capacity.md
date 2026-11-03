# Capacity for a 1,000-user event

Jason confirmed on November 3, 2026 that 1,000 simultaneous users are likely
and both Deterministic and Haiku AI must be available. This supersedes treating
1,000 as only a potential audience. The implementation uses a bounded five-minute AI wait and preserves the
existing $1/day and $5/month spending caps. Existing production approvals remain in force.
The client has no approved operating budget. The [finance estimate](cost-estimate.md)
uses Jason's reported measured average of $0.55 per 1,000 calls for daily,
monthly and event projections.

The [backend scaling implementation and rollout guide](backend-scaling.md) adds
bounded AI waiting, durable event buffering, collector batch writes and larger
private reports. It includes an isolated native Workerd check for 1,000
simultaneous callers. Live provider and Apps Script throughput still require
separate validation. The offline preflight below preserves evidence of the
previous policy mismatch; its fixtures intentionally retain the old limits.

## Reproduce the previous policy mismatch

```sh
pnpm check:usage-capacity fixtures/usage-capacity-burst.json
pnpm check:usage-capacity fixtures/usage-capacity-1000-users.json
```

Both supplied scenarios intentionally exit 1 under the recorded production
policy from [production enablement](production-enablement.md). They are public,
fictional inputs, not a read of current live settings. The larger scenario uses
the current spec's model/prompt pair, not the older pair in that deployment
record. A future prompt change requires reconciling the sample allowlist too.

| Synthetic workload                                     | Generated | Accepted | Dropped | Learner appearances |
| ------------------------------------------------------ | --------: | -------: | ------: | ------------------: |
| Three eight-video searches from one page, no clicks    |        27 |       20 |       7 |                  17 |
| 1,000 pages, one eight-video search and one click each |    10,000 |       20 |   9,980 |                  16 |

The second case independently checks 1,000 AI admissions with all calls held
in flight. The recorded concurrency of two admits two and rejects 998.
The configured 10 global requests/minute is another bottleneck. No inference
is performed. At the supplied input/output token ceilings and configured prices,
the reservation ceiling is $0.016192 per full-catalog call, or $16.192 for 1,000
calls. This matches the production handler's configured input and output limits,
including its 16,384-token output reservation even though the prompt requests
at most 2,000 output tokens.
This is conservative reservation arithmetic, not measured provider usage or
a new spending authorization. Existing approved caps are $1/day and $5/month.
Those caps reflect the owner's existing allowance, not a client operating budget.
Use the reported measured average in the finance estimate for usage forecasts.

Telemetry assumes every search renders eight matches and one click, independently
of the AI admission result. This tests the desired successful workload, not a
prediction that rejected AI requests produce successful AI results. General
fallback cards can also generate events. Deterministic ranking stays local to
each browser; this check does not benchmark browser CPU, static delivery, the
provider, Cloudflare or native Apps Script execution.

## Run another scenario

Copy a fixture to a local JSON file and edit its explicit policy and actions.
The command prints aggregate JSON to stdout. Exit 0 means every generated event
was accepted and every requested AI admission succeeded **in the simulation**.
Exit 1 means loss or rejected admission. Exit 2 means an invalid scenario or
check failure. There is no automatic deployment gate or live load generator.

- `atMs` is the action's offset from optional `startTime`, up to one day.
  The default start is noon UTC on a fixed fictional date. Change `startTime`
  to exercise UTC midnight explicitly.
- `client` identifies a synthetic page within the scenario. Reuse it to test
  that page's cooldown and stopped sender. `clients`, default 1, expands a group
  to consecutive page numbers at the same timestamp, up to 1,000 pages.
- `mode` is `rules`, `llm` or optional staff `topic`. `cards` is 0–8 for a learner
  and 0–1,000 for topic browsing. `clicks` sends that many embed actions on the
  first displayed card, so it requires at least one card.
- `retained` optionally seeds existing rows with only `count` and `ageMs`.
  These rows consume caps but contain no private event data and do not enter
  the scenario's new-event dashboard totals. No purge is simulated.
- Optional `ai` supplies `requests` and the non-secret limit fields read by
  `server/config.ts`. It exercises the real reservation gate with distinct
  synthetic clients, no settlement, and the configured full-catalog token-cost
  ceiling. It does not estimate successful inference latency or actual cost.

The real event producers, sender, collector and report run with an in-memory
transport, an uncontended lock and zero network delay. All events in one action
finish before the next action starts at its simulated timestamp. These are
policy and compatibility checks, not a test of physical concurrency, cold starts,
queue waiting, Apps Script locks or provider throughput. Arrival ordering changes
which events survive, even when the global cap allows the same accepted total.
The command never changes global fetch/time, reads a private Sheet, calls a live
endpoint, publishes a catalog or increases limits. Output omits event identifiers,
goals, explanations and event bodies. Bounds are 5,000 expanded actions,
50,000 generated events and 10,000 seeded retained rows.

## Implementation and release sequence

Follow the [collector-first rollout](backend-scaling.md). The implementation
preserves the private Sheet as the final record, one-day retention, event-ID
deduplication and existing financial caps. Technical collector ceilings change
only through the editor setup function. Do not enable the browser buffer before
deploying the matching batch collector and server-only secret.

Use `pnpm dev:backend-burst` and `pnpm check:backend-burst` for the native isolated
check. It exercises actual SQLite Durable Objects, 1,000 concurrent AI callers
and both engines' event producers, then reconciles 20,000 accepted events with
the real dashboard report. It makes no paid calls or production Sheet writes.
Use a separate small authorized sample for provider throughput, Apps Script
locks/quotas, current live settings and end-to-end native receipts. Synthetic
latency must not be presented as the provider's completion time.

For workload modeling, see [Grafana's concurrency guide](https://grafana.com/docs/k6/latest/testing-guides/calculate-concurrent-users/).
[Google SRE's capacity guidance](https://sre.google/sre-book/service-best-practices/)
supports measuring the relationship between load and capacity. Neither source
establishes that this application's backend can sustain the target.
