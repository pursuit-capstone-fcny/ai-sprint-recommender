# Luna low reliability validation

Fresh deployed trials score **10/10, 9/10, 9/10**, against rules **8/10**.
There were no timeouts or invalid responses among 34 benchmark/probe calls.
All have final measured usage, reconciled to the durable budget; the report sets
`relevanceEvidenceComplete: true`. Production enablement still awaits owner review.

[Run 40921060651, attempt 2](https://github.com/pursuit-capstone-fcny/ai-sprint-recommender/actions/runs/40921060651)
tested source `8669f2a4792a925b53397386059ea454f8a24547` on October 29.
GPT-6 Luna low, standard processing/reasoning, V7, all labels, catalog task tags,
selection and the two-real-primary-task gate are unchanged. Fingerprint:
`298ffdb6199c3a8bdb9ef48063ccfc4e16ca5efda14267a240c93d42d20b6d09`.
No paid retries or response cache were used.

## Changes and limits

- An unpaid catalog GET refreshes snapshots with less than 30 seconds of
  freshness left, within the existing 60-second TTL. Previously it could return
  a snapshot about to expire during submissions. All 30 benchmark catalog reads
  took 3–7 ms; no live Sheet fetch entered their paid path.
- Timed-out requests retain settlement work through `waitUntil`. A local test
  returns the timeout at 4.5 seconds and records measured usage arriving at five
  seconds without replacing the response or making another call. Requests that
  never dispatch a provider call now record zero, with explicit dispatch state.
  Unknown dispatched usage still retains its full reservation and missing metrics.
- Luna validation now distinguishes content shape, refusal, incomplete output,
  JSON/schema, duplicates and out-of-range positions. It still rejects the whole
  invalid result. The earlier response body was not retained and the failure did
  not recur, so its original cause is unresolved; this run does not establish
  that malformed model output can never happen.

The previous provider timeout also did not recur. Its exact latency cause was
not captured previously; new stage timings separate catalog, budget and provider
work. Neither the 4.5-second server deadline nor five-second client deadline changed.

## Fresh results

| Measure                     | Previous deployed run | Reliability rerun |
| --------------------------- | --------------------- | ----------------- |
| Trial scores                | 9/10, 8/10, 8/10      | 10/10, 9/10, 9/10 |
| Benchmark rules fallbacks   | 0, 1, 2               | 0, 0, 0           |
| Rules baseline              | 8/10                  | 8/10              |
| Median / p95 client latency | 2.610s / 4.530s       | 2.336s / 3.414s   |
| Longest client request      | 4.532s                | 4.506s            |
| Measured accounting         | Incomplete            | 34/34 calls       |

The maximum server latency was 4.436s; maximum provider time was 4.116s.
Sampling variation contributes to score and latency differences; the prompt and
ranking behavior did not change in this rerun.

| Profile           | Trial 1 hits | Trial 2 hits | Trial 3 hits |
| ----------------- | -----------: | -----------: | -----------: |
| leadership-01     |            2 |            2 |            2 |
| leadership-02     |            3 |            3 |            3 |
| operations-01     |            2 |            2 |            2 |
| operations-02     |            3 |            2 |            2 |
| programs-01       |            3 |            3 |            3 |
| programs-02       |            2 |            2 |            2 |
| communications-01 |            3 |            3 |            3 |
| communications-02 |            2 |            2 |            2 |
| fundraising-01    |            3 |            3 |            3 |
| fundraising-02    |            2 |            1 |            1 |

Two unchanged-label hits among the first three displayed cards pass a profile.
Funder rehearsal remains the weakest profile and needs semantic review.

Both reused wording probes reached two existing label hits. They are regression
checks, not fresh unseen wording or additions to the benchmark denominator.
Nonsense and injection goals returned empty model picks and used the rules path.
Fifteen deployed synthetic failure checks passed without provider calls.
These checks do not prove safety against every possible injection.

## Allowance and shutdown

| Accounting                      |                 Amount |
| ------------------------------- | ---------------------: |
| Prior cumulative ceiling        |              $0.398955 |
| 30 benchmark calls, measured    |              $0.037717 |
| Four separate probes, measured  |              $0.004829 |
| Added this run, measured        |          **$0.042546** |
| New unknown reservations        |              $0.000000 |
| Cumulative ceiling              |          **$0.441501** |
| Remaining original $1 allowance | **at least $0.558499** |

The [accounting audit](runs/40921060651-2/state/accounting-audit.json) matches all
34 distinct request IDs to final usage. Their sum exactly matches the
[durable budget increase](runs/40921060651-2/state/luna-budget.json).
Historical unknown reservations of $0.161000 remain charged. No historical
result, reservation or label was altered or refunded.

The test endpoint was disabled after the run. Both provider keys and the rate
key were confirmed absent; the one-run approval variable and trigger label were
removed. Production remains the static deployment at `5f63002`, with LLM calls
and usage logging disabled. Test usage logging also remained off.

## Validation and remaining review

554 local tests, typecheck, lint, build and the synthetic workerd adapter check
passed before deployment. PR CI and preview passed. The workflow saved all 34
paid diagnostics, four cache checks and its unpaid readiness check, with no raw
goals, provider output, reasoning text, IPs or credentials in the captures.

The current numeric and measured-evidence gate passes. Ali/Eliot's final
semantic/weak-profile review, fresh unseen wording, FCNY runtime/privacy/budget
approval and #23 demo evidence remain pending. This report does not authorize
production enablement or PR merge.
