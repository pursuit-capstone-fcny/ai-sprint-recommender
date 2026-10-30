# Luna provider timeout rerun

Luna low scored **9/10, 8/10 and 10/10** with no timeouts or invalid responses.
All 34 calls have diagnostics and measured usage. Fresh relevance evidence is
complete, but shorter recommendation lists are a regression requiring review.
Production LLM calls and usage logging remain disabled.

| Measure                                       | Previous V10    | Compact V11                |
| --------------------------------------------- | --------------- | -------------------------- |
| Top-three scores                              | 9, 9, 9         | 9, 8, 10                   |
| Benchmark timeouts                            | 1               | 0                          |
| Accepted LLM lists with six to eight videos   | 23/30           | 8/30                       |
| Accepted LLM lists with fewer than six videos | 6/30            | 21/30                      |
| Rules fallbacks                               | 1 timeout       | 1 task-diversity rejection |
| Median client latency                         | 1.381s          | 1.713s                     |
| p95 / maximum client latency                  | 3.634s / 4.541s | 3.450s / 3.553s            |
| Measured calls                                | 33/34           | 34/34                      |
| New allowance charge                          | $0.046867       | $0.031765                  |

The previous charge includes a $0.007 unknown reservation. These samples show
lower tail latency and no repeated provider timeout, not a guarantee that the
provider will always finish within the unchanged deadline.

## Change and evidence

The remaining V10 failure spent 4.295 seconds in the provider. V11 sends the
same public catalog fields as rows with one shared field list and requests a
short array of positions instead of eight named rank slots. It preserves all
89 videos, ranking instructions, task tags, low effort, standard tier, disabled
caching, the 2,000-output-token cap and the 4.5-second server deadline. Labels,
browser selection and the two-real-primary-task gate are unchanged.

The compact request fits a conservative 50,000-input-token bound. Its maximum
reservation is $0.006. Historical $0.007 reservations remain unchanged. Tests
verify lossless field encoding, strict output validation and cost bounds.
The [payload audit](payload-audit.json) records request bytes, not latency or
measured tokens. The deployed run measured 307,787 input and 1,947 output tokens.

[Run 41085742178, attempt 2](https://github.com/pursuit-capstone-fcny/ai-sprint-recommender/actions/runs/41085742178/attempts/2)
tested source `b906fd388fd9ed2f30442522904d9051cb92135e`.
The [fresh report](runs/41085742178-2/comparison/report.md),
[comparison](runs/41085742178-2/comparison/comparison.json) and
[accounting audit](runs/41085742178-2/state/accounting-audit.json) preserve every
outcome. Attempt 1 stopped before deployment because exact-attempt approval
was absent; it made no paid calls.

- All three trials meet #19's original eight-of-ten threshold. Rules remains
  8/10. Rules fallbacks never count as LLM passes.
- Fundraising-02 has one labeled top-three hit in trials one and two.
  Communications-02's second trial fails the diversity gate and uses rules.
- Every list stays within the eight-video cap, with no duplicates or unknown
  IDs. Only eight accepted LLM lists reach the preferred six-to-eight range.
  Shorter output must not be presented as an unqualified quality improvement.
- Both reused wording probes have two labeled top-three hits. Nonsense and
  injection probes return empty model lists and use rules. These inspected
  wording regressions are not unseen validation.
- All 34 request and four unpaid cache-check diagnostics are present. There
  are no rate limits, cooldowns or missing terminal usage records.
- All 602 candidate tests, typecheck, lint and build pass. Local workerd checks
  make no external calls. All 15 hosted synthetic failure checks pass.
  Final ledger checks pass with 603 tests, including rejection of another
  full run at the remaining balance.

The frozen benchmark fingerprint remains
`298ffdb6199c3a8bdb9ef48063ccfc4e16ca5efda14267a240c93d42d20b6d09`.
Full-set quality, semantic and weak-profile review, unseen wording, production
approvals and demo evidence remain pending. Historical results are preserved.

## Allowance and shutdown

The durable budget increased by exactly the measured **$0.031765**. No new
unknown reservation was added. The cumulative ceiling is **$0.810414**,
including **$0.203000** of historical unresolved reservations. At least
**$0.189586 remains** of the unchanged $1 allowance. Another complete
34-request run needs $0.204000 at the current maximum reservation, so no
further paid run was attempted. Costs are usage estimates, not invoices.

The ledger and both test configs carry the final ceiling. The original daily,
monthly and cumulative $1 caps are unchanged. No reservation was refunded or
repriced to create room for another run.

The test endpoint was disabled at 16:05:22 UTC on October 30. Provider and rate
keys were absent after cleanup at 16:05:24 UTC. An independent unpaid probe
also confirmed shutdown. The temporary approval and trigger label are removed.
A separate documentation-only merge redeployed production at
`5731dae0d0357f463b59c96b1a310e596e50e054` during final verification.
[Deployment 41087494022](https://github.com/pursuit-capstone-fcny/ai-sprint-recommender/actions/runs/41087494022)
uses the unchanged assets-only config and `VITE_USAGE_ENABLED=false`. Production
LLM calls and usage logging remain off. Evaluation usage logging also stayed off.
