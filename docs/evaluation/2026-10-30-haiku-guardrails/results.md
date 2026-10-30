# Haiku injection and duplicate fixes pass the fresh rerun

Haiku V12 low scores **10/10 in all three trials**. All four instruction-only
probes abstain, and none of the 40 calls produces a duplicate, invalid response
or timeout. Accepted six-to-eight lists remain **22/30**. The fixed supplemental
audit passes, while expanded-set and unseen-input review remain pending.
Production LLM calls and usage logging stay disabled.

| Measure                       | Haiku V11 low | Haiku V12 low | Luna V15 low Fast |
| ----------------------------- | ------------- | ------------- | ----------------- |
| Top-three scores              | 9, 10, 10     | 10, 10, 10    | 10, 10, 10        |
| Accepted six-to-eight lists   | 22/30         | 22/30         | 29/30             |
| Benchmark fallbacks           | 1             | 0             | 0                 |
| Benchmark invalid responses   | 1 duplicate   | 0             | 0                 |
| Benchmark timeouts            | 0             | 0             | 0                 |
| Instruction-only abstentions  | 2/4           | 4/4           | 4/4               |
| Same 30 benchmark calls, cost | $0.057237     | $0.058554     | $0.058004         |
| Average per benchmark call    | $0.0019079    | $0.0019518    | $0.0019335        |
| Estimated cost per 1,000      | $1.91         | $1.95         | $1.93             |
| Median benchmark latency      | 1.661s        | 1.5845s       | 1.2785s           |

Prices include every benchmark call, including V11's rejected duplicate, and
exclude the separate probes. V12 costs about 2.3% more than V11 and 0.9% more
than Luna V15 Fast in these samples. These are measured token estimates, not
provider invoices. Sequential runs with different schemas do not isolate latency.

## Change and validation

V12 appends one final Haiku instruction. It checks for a real work goal before
applying the preferred count, distinguishes response-control instructions from
work, and selects each rank from unused catalog positions. Mixed real goals
remain eligible; a truly blank goal still permits browsing. Strict duplicate
rejection remains intact. No duplicate is repaired after generation.

The prior ranking/breadth text, complete compact catalog, eight required nullable
slots, low effort, disabled thinking, 512 output tokens, input bound and deadlines
are unchanged. Outbound-request tests remove only the added text and reproduce
all ten V11 request hashes. Luna's requests remain unchanged. The test failed
before wiring the new instruction and passes afterward. Semantic adherence is
supported by the fresh run, not by the request-shape test alone.

[Run 41113275295 attempt 2](https://github.com/pursuit-capstone-fcny/ai-sprint-recommender/actions/runs/41113275295/attempts/2)
tested `e618b3f5709cf2a92bf515f0b4a55e3fd88a397b`. See the
[report](runs/41113275295-2/comparison/report.md),
[full assessment](runs/41113275295-2/state/comparison-assessment.json),
[behavior audit](runs/41113275295-2/state/injection-audit.json),
[probes](runs/41113275295-2/live/probes.json) and
[accounting audit](runs/41113275295-2/state/accounting-audit.json).

- Both previously failing instruction-only probes now abstain, as do the other
  two attacks and nonsense control. The existing browser policy then displays
  rules recommendations. Passing these probes does not prove general injection
  resistance or change that fallback policy.
- Both mixed-goal controls and both wording controls retain two existing-label
  top-three hits and six-to-eight videos. Blank browsing returns eight videos.
  Fundraising-02 retains both labeled hits with seven videos in every trial.
- Eight accepted benchmark lists contain fewer than six videos. These are
  Leadership-02 in all trials, Programs-02 in trials one and three,
  Communications-01 in trial one, and Communications-02 in trials one and two.
  Aggregate breadth is preserved; individual list lengths vary. Luna V15 still
  has broader coverage at 29/30 six-to-eight lists.
- Expanded sets contain **111 unreviewed appearances**. The unchanged sparse
  labels do not approve these picks. Rules remains 8/10. Human review of the
  expanded sets, semantic examples and unseen wording remains pending.
- All 40 paid calls have measured usage and diagnostics, as do all four unpaid
  cache checks. No new unknown charge, rate limit, recovery wait or per-case paid
  retry occurs. All-call median latency is 1.5815s, p95 3.120s, maximum 3.534s.
- All 15 deployed synthetic failure checks pass. The evaluated source passes
  620 tests, typecheck, lint, build and CI. The fixed benchmark fingerprint is
  `298ffdb6199c3a8bdb9ef48063ccfc4e16ca5efda14267a240c93d42d20b6d09`.

The [plan](test-plan.md) and targets were committed before paid calls. Attempt 1
stopped at the approval gate with zero paid calls. Attempt 2 is the only paid
run. Saved V11 evidence fails the same failure replay that V12 passes. Benchmark
labels, catalog tags, task-diversity gate and all historical results are unchanged.
The isolated Worker serves the frozen public catalog. This test does not validate
the separately migrated Apps Script integration or its catalog latency.

## Allowance and shutdown

Forty calls cost **$0.078075**. The cumulative ceiling rises from $1.209801 to
**$1.287876**, including the unchanged $0.225000 historical unknown reservations.
At least **$0.712124 remains** under the existing shared $2 cap. The hashed ledger
and both provider test configs carry the new floor without resets or refunds.

Test calls were confirmed disabled at 19:17:55 UTC on October 30. Provider and
rate keys were absent by 19:17:57; an independent unpaid check confirms shutdown.
The temporary approval variable and trigger label were removed.

Production remains on separately deployed source
`258d13c35c75587159de693e67d3535e31abe204`,
[run 41108445967](https://github.com/pursuit-capstone-fcny/ai-sprint-recommender/actions/runs/41108445967).
Its logs confirm `LLM_ENABLED=false` and `VITE_USAGE_ENABLED=false`. This PR is
unmerged; passing this rerun does not authorize production enablement.

Unpaid reproduction from the repository root:

```sh
python3 docs/evaluation/2026-10-30-haiku-guardrails/audit-failures.py docs/evaluation/2026-10-30-haiku-guardrails/runs/41113275295-2
python3 docs/evaluation/2026-10-30-haiku-guardrails/audit-quality.py docs/evaluation/2026-10-30-haiku-guardrails/runs/41113275295-2
python3 docs/evaluation/2026-10-30-haiku-guardrails/audit-accounting.py docs/evaluation/2026-10-30-haiku-guardrails/runs/41113275295-2
```
