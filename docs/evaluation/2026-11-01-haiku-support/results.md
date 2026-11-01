# Supporting-method test results

V46 is withdrawn. The source-to-goal mapping did not preserve V44's quality,
breadth or reliability, so the branch restores V44's ranking request. The
remaining weak supporting picks are **not fixed**. No relevance label or
task-diversity rule changed.

| Candidate                       | Top-three scores    | Accepted six-to-eight lists | Reliability                                                                             |
| ------------------------------- | ------------------- | --------------------------- | --------------------------------------------------------------------------------------- |
| V44, retained historical result | 10/10, 10/10, 10/10 | 30/30                       | Forty measured requests; no invalid responses, timeout or transport failure             |
| V46, withdrawn                  | 9/10, 6/10, 6/10    | 20/30                       | Ten duplicate responses rejected across forty requests; no timeout or transport failure |

V46 source `6ccd60d5b5751660749168f28f8a829211d61cad`,
[run 41265344175 attempt two](https://github.com/pursuit-capstone-fcny/ai-sprint-recommender/actions/runs/41265344175),
completed all forty requests. The workflow completed successfully, but the
unchanged stricter [validation audit](runs/41265344175-2/state/validation.json)
failed. Nine benchmark requests fell back to rules. The remaining accepted
Leadership-02 list in trial one had only four cards. Fundraising-01 fell back in
all three trials; Fundraising-02 fell back in trials two and three.

All four instruction-only probes and the nonsense goal abstained correctly.
Operations wording and mixed-goal controls passed. Fundraising wording produced
a duplicate rejection; mixed Fundraising and blank browsing did not produce
sufficient results for the unchanged browser gate. Median client latency was
2,024ms, p95 2,603ms and maximum 2,792ms.

## Supporting picks

The [expanded review](v46-expanded-review.md) preserves every displayed list and
identifies existing labels and unreviewed cards. The
[unpaid V44 replay](v44-replay.json) reproduces 22 appearances of previously
questioned supports. V46 still displays eight of those concerns, including
policy guidance for a staff conversation, a slide deck for internal FAQ answers,
equipment negotiation for staff conversations, and strategic-plan tracking for
student follow-up.

That count reduction is not a quality win: nine lists use rules fallback and
one accepted list is short. Their output cannot substitute for a successful
LLM comparison. V46's accepted lists also need review of replacements, such as
coding adoption for internal FAQ answers. No unreviewed card was promoted to an
ideal/good label. Local serialization tests do not establish semantic quality.

The tested hypothesis was that explicitly pairing a taught operation with its
needed work step would improve supporting relevance. The observed output rejects
this version of the approach. The evidence does not isolate whether the extra
instruction, schema description or attention spent on the mapping caused the
new duplicates. No raw auxiliary statements were stored or returned to users.

## Allowance and shutdown

The input cap was tightened from 65,000 to 63,000 without changing prices,
output tokens or the 4,096-token framing allowance. All benchmark and control
requests, including full-catalog versions, fit: the largest conservative wire
bound is 62,627. An oversized request still stops before provider dispatch.
Forty calls could reserve at most $0.262240, below the starting $0.262836 balance.
The exact-source and exact-attempt approval checks remained intact.

The run charged **$0.061581**, all measured, with no new unknown reservation.
Cumulative spend is **$3.798745**, leaving **$0.201255** under the unchanged $4 cap.
All **$0.366876** historical unknown reservations remain charged. No reset,
refund, repricing or replacement case occurred. The preliminary attempt made
no paid calls. Every saved result and the durable budget readback are retained.

The remaining balance is **$0.060985 below** the current $0.262240 maximum
reservation for another complete forty-case run. No further paid calls were
made. This is a reservation requirement, not a claim that a normal run costs
that amount. Further complete validation needs additional allowance or a
separately verified reduction in the enforced request bounds.

Test calls are disabled, provider/rate keys removed, and the temporary Actions
approval and trigger removed. An [independent invalid-intake probe](runs/41265344175-2/state/independent-disabled.json)
confirms shutdown without a paid call. The deployed test artifact is disabled
V46. Branch ranking code is restored exactly to tested V44, retaining the lower
input cap and cumulative budget floor. There is no fresh paid run of that final
bookkeeping commit. [Production evidence](production-disabled.json) still shows
LLM calls and usage logging disabled.

V44's historical 10/10 scores and breadth remain the retained evidence, not a
new result or approval of its weak supporting picks. Production enablement and
expanded-set human review remain pending. No merge, approval, reviewer request,
message to another person or follow-up automation was performed.

Final local checks pass: 661 tests, typecheck, lint, build and an unpaid Worker
runtime check with zero external requests. Frozen benchmark/catalog files,
retrieval, browser diversity code and production deployment configuration match
the starting revision. The auxiliary selection module matches V44 exactly.
