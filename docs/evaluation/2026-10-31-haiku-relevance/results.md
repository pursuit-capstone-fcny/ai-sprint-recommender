# Haiku expanded-relevance follow-up

The requested fix is not achieved. None of V26–V29 improves weak expanded picks
and short lists while retaining the existing validation targets. All four are
withdrawn. The branch restores V25's request construction and numeric provider
behavior exactly; it does not claim a fresh V25 evaluation or production readiness.

V25's prior run passes the fixed automated audit at 10/10 each and 25/30 accepted
six-to-eight lists. It still has five short lists and the weak picks identified
in its [expanded review](../2026-10-31-haiku-breadth/expanded-review.md).
Those concerns remain open. Test and production LLM calls are disabled.

## Results without changed labels or gates

| Candidate                                               | Change                                         | Scores     | Accepted six-to-eight lists | Cards                         | Recorded charge    | Outcome                                                                           |
| ------------------------------------------------------- | ---------------------------------------------- | ---------- | --------------------------- | ----------------------------- | ------------------ | --------------------------------------------------------------------------------- |
| [V26](runs/41218987637-3/state/validation.json)         | Require a concrete work connection             | 10, 10, 10 | 23/30                       | 190                           | $0.081568          | Fixed breadth check fails; original four flagged appearances disappear            |
| [V27](runs/41219954995-2/state/validation.json)         | Include implied preparation and follow-through | 10, 10, 10 | 23/30                       | 194                           | $0.082224          | Seven short lists; original flags absent but other weak picks remain              |
| [V28](runs/41221186981-2/state/partial-validation.json) | Exact position/title output choices            | Incomplete | Not established             | Not established               | $0.067560 reserved | Ten provider timeouts; runner stops before remaining trials and probes            |
| [V29](runs/41222563302-2/state/validation.json)         | Numeric output with named catalog fields       | 10, 9, 10  | 21/30                       | 197, including rules fallback | $0.089704          | One duplicate response, two injection failures and mixed-goal breadth regressions |

V26 and V27 have forty final diagnostics, reconciled measured usage and clean
transport, timeout, duplicate and injection checks. However, removing the three
original flagged titles does not establish full expanded-set quality. V27 still
returns staff training or Spanish Tutor for attendance follow-up, and a fundraising
webinar for a board deck. See the [withdrawn V27 selections](expanded-review.md).
These observations add no positive or negative benchmark labels.

V28 returns no measured usage. All ten full reservations remain charged. Nine
requests have final diagnostics; the first has only a nonfinal diagnostic. The
exact provider-side cause is unknown. The new output protocol, adapter and tests
are removed from active code; its source and partial evidence remain archived.

V29 completes forty requests with final diagnostics and reconciled measured
usage, no timeout or transport failure. Median latency is 1,211ms, p95 1,811ms,
and maximum 2,534ms. Its duplicate response correctly falls back for Fundraising-02
trial two. Two instruction-only probes incorrectly receive recommendations;
mixed Operations and Fundraising have five and four cards. The original podcast
review flag reappears twice. This candidate is withdrawn despite workflow success.

Preliminary attempts ran no paid work. One V26 preflight attempt stopped on an
unpaid HTTP 200 response missing the required diagnostic header; no benchmark
request ran and additional spend was zero. Every attempt is preserved. No paid
case was retried, omitted or replaced. See the [plan](test-plan.md) for hypotheses,
source changes and local failures caught before dispatch.

## Allowance and shutdown

Starting ceiling $2.325255 plus **$0.321056** gives **$2.646311**, leaving
**$0.353689** under the unchanged $3 cap. This follow-up includes $0.253496 measured
usage and $0.067560 unknown reservations. Cumulative unknown reservations are
$0.292560, including the original $0.225000. No reset, refund or repricing occurred.
The [durable balance](runs/41222563302-2/state/comparison-budget.json) is carried
into the ledger and both disabled test configurations.

The fixed audit is unchanged. Its accounting helper was also run with its existing
prior-unknown argument of 292560 to include V28's reservations; this corrects only
the descriptive carry-forward total. Scores, checks and all charges remain intact.

[Independent shutdown](runs/41222563302-2/state/independent-disabled.json) confirms
test calls are off, and [cleanup](runs/41222563302-2/state/secret-cleanup.json)
confirms provider and rate keys are absent. The temporary Actions approval and
trigger were removed. The deployed test artifact is disabled V29; branch code
restores V25. No further paid experiment or enabled deployment was performed.

Production stays on source `639fe465dff12ea6c925b0dad1c38d1792918547`, deployment
`41127387660`, with LLM calls and usage logging disabled. Frozen catalog values,
benchmark labels, task-diversity logic and production settings are unchanged.
No merge, approval, review request or follow-up automation was created.
