# V12 Fast validation passed

Luna low with Fast processing scored **10/10, 9/10 and 9/10**, with no
timeouts, invalid responses or benchmark fallbacks. Accepted six-to-eight
lists increased from V12's **20/30 to 27/30**. The candidate passes this
sample's timeout, breadth and #19 numeric/evidence checks. Expanded-set and
client review remain pending; production LLM calls and logging stay disabled.

| Measure                      | V12 Standard    | V12 Fast        |
| ---------------------------- | --------------- | --------------- |
| Top-three scores             | 7, 8, 10        | 10, 9, 9        |
| Accepted six-to-eight lists  | 20/30           | 27/30           |
| Accepted lists below six     | 6/30            | 3/30            |
| Benchmark timeouts           | 4               | 0               |
| Invalid responses            | 0               | 0               |
| Median client latency        | 1.8125s         | 1.391s          |
| p95 / maximum client latency | 4.601s / 4.639s | 2.901s / 3.103s |
| Measured requests            | 30/34           | 34/34           |
| Measured cost                | $0.028736       | $0.064224       |
| New unknown reservations     | $0.022000       | $0              |

## Change and evidence

The request differs from V12 only in `service_tier: fast`. Ten request-hash
tests verify the unchanged instructions, full catalog, input fields, output
schema, low effort and 1,000-token output cap. Server and browser deadlines
remain 4.5 and five seconds. All 34 returned service tiers are `fast`, with
no downgrade. The [plan](test-plan.md) records the processing-tier hypothesis.
This sample supports Fast as a latency mitigation; it does not prove that
scheduling caused V12's failures or guarantee future latency.

[Run 41094923123, attempt 2](https://github.com/pursuit-capstone-fcny/ai-sprint-recommender/actions/runs/41094923123/attempts/2)
tested source `3d8b51fa9d70dcf3b2b0539b1b873a7deb33a662`. Attempt 1 stopped
at the approval gate without deployment or paid calls. The
[fresh report](runs/41094923123-2/comparison/report.md),
[comparison](runs/41094923123-2/comparison/comparison.json),
[breadth audit](runs/41094923123-2/state/breadth-audit.txt) and
[accounting audit](runs/41094923123-2/state/accounting-audit.json) preserve all outcomes.

- Rules remains 8/10. Fundraising-02 has one labeled top-three hit in trials
  two and three; the other 28 cases pass. Fallbacks never count as LLM passes.
- Three lists contain fewer than six videos: Operations-01 in trial one,
  Programs-01 in trial two and Fundraising-02 in trial three. No accepted list
  was shortened by the browser, and all lists stay within eight videos.
- Expanded lists contain 83 existing-label hits and 104 unreviewed cards.
  Sparse top-three labels cannot establish those additional cards' relevance.
- Both reused wording probes have two labeled top-three hits and six videos.
  Nonsense and injection use rules. These inspected probes are not unseen tests.
- All 34 request and four cache-check diagnostics are present. Usage is fully
  measured and reconciled; `relevanceEvidenceComplete` is true. No failed
  paid case was retried and no cooldown or recovery request was needed.
- All 611 tests, typecheck, lint and build pass. Local Worker checks make no
  external requests; all 15 hosted synthetic failure checks pass.

The benchmark fingerprint remains
`298ffdb6199c3a8bdb9ef48063ccfc4e16ca5efda14267a240c93d42d20b6d09`.
Labels, catalog tags, task-diversity gate and historical results are unchanged.

## Allowance and shutdown

Jason's additional $1 raises the cumulative Luna test allowance to $2.
The previous $0.861150 ceiling is preserved, including $0.225000 of historical
unknown reservations. This run adds **$0.064224**, about **$0.001889 per call**.
The new cumulative ceiling is **$0.925374**, leaving at least **$1.074626**.
No historical charge was reset, refunded or repriced. Fast's per-token rate
is twice Standard; the table separates measured cost from unknown reservations.

Test calls were disabled at 17:05:20 UTC on October 30. Cleanup confirmed both
provider keys and the rate key absent at 17:05:23 UTC. An independent unpaid
probe confirmed shutdown. The temporary approval and trigger label are removed.
V12 Fast remains the disabled test candidate; no production enablement occurred.

The latest production [deployment 41092025394](https://github.com/pursuit-capstone-fcny/ai-sprint-recommender/actions/runs/41092025394)
uses source `8f5e4a6662e653f041a52ea399433d38d152daae`. Its logs confirm
`LLM_ENABLED=false` and `VITE_USAGE_ENABLED=false`. That separately changed
production source is not the source evaluated here.

Unpaid reproduction from the repository root:

```sh
python3 docs/evaluation/2026-10-30-luna-fast/audit-accounting.py docs/evaluation/2026-10-30-luna-fast/runs/41094923123-2
python3 docs/evaluation/2026-10-30-luna-breadth/audit-breadth.py docs/evaluation/2026-10-30-luna-fast/runs/41094923123-2
```
