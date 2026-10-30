# Luna breadth trial rejected

V12 increased accepted six-to-eight-video lists from **8/30 to 20/30**, but
four provider timeouts returned. Scores were **7/10, 8/10 and 10/10**. It fails
the requested breadth-without-timeouts outcome and #19's per-trial threshold.
The repository default is restored to V11. Production LLM calls and usage
logging remain disabled, and the test endpoint is disabled with keys removed.

| Measure                                       | V11 baseline          | V12 breadth trial |
| --------------------------------------------- | --------------------- | ----------------- |
| Top-three scores                              | 9, 8, 10              | 7, 8, 10          |
| Accepted LLM lists with six to eight videos   | 8/30                  | 20/30             |
| Accepted LLM lists with fewer than six videos | 21/30                 | 6/30              |
| Benchmark timeouts                            | 0                     | 4                 |
| Other benchmark fallbacks                     | 1 diversity rejection | 0                 |
| Median client latency                         | 1.713s                | 1.8125s           |
| p95 / maximum client latency                  | 3.450s / 3.553s       | 4.601s / 4.639s   |
| Measured calls                                | 34/34                 | 30/34             |
| New allowance charge                          | $0.031765             | $0.050736         |

## What was tested

V12 keeps V11's compact rows, full catalog and positions-array schema. It asks
for useful complementary demonstrations before stopping below six, preserving
the strongest three direct matches and forbidding padding. A smaller enforced
1,000-token output cap lets the full run fit the original remaining allowance.
All ranking fields, benchmark labels, task tags, task-diversity gate, low effort
and deadlines are unchanged. The [plan](test-plan.md) records these changes.

[Run 41089309130, attempt 2](https://github.com/pursuit-capstone-fcny/ai-sprint-recommender/actions/runs/41089309130/attempts/2)
tested source `925e4d1669a1293bdca947ae3a57f48d354a9961`. Its
[fresh report](runs/41089309130-2/comparison/report.md),
[before/after comparison](runs/41089309130-2/comparison/comparison.json),
[breadth audit](runs/41089309130-2/state/breadth-audit.txt) and
[accounting audit](runs/41089309130-2/state/accounting-audit.json) retain every
outcome. Attempt 1 stopped at approval before deployment or paid calls.

- Trial one timed out for Leadership-01, Operations-01 and Fundraising-01.
  Trial two timed out for Programs-01; Fundraising-02 had one labeled top-three
  hit. Trial three passed all ten profiles. Rules remains 8/10; rules fallbacks
  never count as LLM passes.
- All four timeouts occurred in the provider after 4.300 to 4.383 seconds.
  Catalog reads took 11 to 19ms. No failed case was retried. Each retained its
  reservation, waited for the lease to expire and recovered the catalog.
- Completed responses had no invalid output or output-limit truncation. Their
  largest benchmark output was 270 tokens. Missing terminal usage on four
  timed-out calls cannot establish how much reasoning or output they generated.
  This sample does not distinguish prompt effects from provider-load variation.
- The 26 accepted LLM lists include 71 hits against existing labels and 84
  unreviewed cards. The V11 run's 29 accepted lists contain 80 existing-label
  hits and 59 unreviewed cards. These totals cover different completed cases;
  greater breadth does not establish relevance of the additional cards.
- Both reused wording probes have two labeled top-three hits and six cards.
  Nonsense and injection use rules. Reused probes are not unseen validation.
- All 34 request, four initial cache-check and four recovery diagnostics are
  present. Accounting is conservatively reconciled, but complete measured usage
  and fresh relevance evidence remain false. Workflow success does not override
  the evaluation failure.
- The V12 candidate passed 604 tests, typecheck, lint and build. Local workerd
  checks made no external requests; all 15 hosted synthetic failure checks pass.
  After restoring V11 and carrying the balance forward, all 603 final tests,
  typecheck, lint and build pass.

The frozen fingerprint remains
`298ffdb6199c3a8bdb9ef48063ccfc4e16ca5efda14267a240c93d42d20b6d09`.
No new labels, changed gates or reassigned historical results were used.

## Allowance and decision

Measured usage cost **$0.028736** across 30 calls. Four unknown calls retain
their original **$0.0055** reservations, adding **$0.022000**. The durable
increase is exactly **$0.050736**. The cumulative ceiling is **$0.861150**,
including **$0.225000** in unresolved reservations. At least **$0.138850**
remains of the original $1 allowance. No charge was refunded or repriced.

Another full V12 run would reserve $0.187; V11 would reserve $0.204. Neither
fits. No further paid calls were made. The ledger and both test configs carry
the final balance without resetting the daily, monthly or cumulative caps.

V12's source commit remains available for reproduction, but it is rejected as
the default. The repository restores V11's prompt and 2,000-token cap. V11's
last fresh result remains 9/10, 8/10 and 10/10 with no timeouts; its breadth
limitation remains unresolved. This restoration is not a new V11 trial or
production approval. Client and expanded-set review remain pending.

Test calls were disabled at 16:32:26 UTC on October 30. Provider and rate keys
were absent after cleanup at 16:32:29 UTC; an independent unpaid probe confirmed
shutdown. The temporary approval and trigger label are removed. The disabled
test deployment contains the recorded V12 run; it cannot make provider calls.
Production LLM calls and usage logging remain off.

A separate library deployment changed production during this task. Its
[run 41091337101](https://github.com/pursuit-capstone-fcny/ai-sprint-recommender/actions/runs/41091337101)
uses source `6f019c5905e4144fd9e53d9ec94547201153c34a`. The deployment log confirms
`LLM_ENABLED=false` and `VITE_USAGE_ENABLED=false`. This task changed no
production configuration. These trials evaluate the pinned test source and
frozen catalog, not a new production-readiness claim.
