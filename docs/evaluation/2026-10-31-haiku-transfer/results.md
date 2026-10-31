# Haiku candidate-retrieval results

V36 improves breadth and passes the fixed #19 audit, but the requested quality
fix is incomplete. Keep V36's test-only retrieval and row presentation. Restore
its V25 ranking instructions after V37 failed to improve the expanded review.
Production LLM calls and usage logging remain disabled.

Compared with the starting V25 run, accepted six-to-eight lists rise from 25/30
to **29/30**, while all three trials still score **10/10**. There are 213 LLM
cards versus 193. Fundraising-01 trial three has five cards; no list is padded
after model output. The [expanded review](v36-expanded-review.md) identifies
129 unreviewed appearances, including three podcast-for-board-deck flags.
AI-concerns and equipment-negotiation demos for a staff conversation, and a grant
flier for evaluating an application, also need review. More cards and passing
first-three scores do not establish that these supporting picks are useful.

## What changed

Use the existing lexical relevance scorer to shortlist up to 48 candidates for
the test-only Haiku adapter. Preserve every selected function-area candidate,
then fill remaining slots with cross-area matches. Retain original order and
all metadata. Blank, small, no-evidence and oversized-area cases keep the full
catalog. Generate the numeric schema and trusted ID map from the same subset.
The public catalog still serves all 89 videos; rules and other providers retain
their original path. The shared scorer changes only its input type, not its logic.

V35 exposed a concrete recall defect: lexical retrieval excluded previously
labeled good videos from both wording probes. V36's area-coverage correction
retains every existing ideal/good candidate for the original profiles and wording
probes. [Before](v35-wording-coverage.json) and [after](v36-wording-coverage.json)
record that unpaid check. Coverage alone is not a recommendation score.

## Complete trial history

| Candidate | Approach                                       | Trial scores | Six-to-eight lists | Fixed audit | Recorded cost |
| --------- | ---------------------------------------------- | ------------ | ------------------ | ----------- | ------------- |
| V32       | Transfer-method paragraph, full catalog        | 10/10/9      | 21/30              | Fail        | $0.080433     |
| V33       | V25 prompt, one catalog row per line           | 10/10/10     | 24/30              | Pass        | $0.080715     |
| V34       | Consolidated ranking instructions              | 10/10/9      | 26/30              | Fail        | $0.077353     |
| V35       | Lexical candidate retrieval                    | 10/10/10     | 26/30              | Fail        | $0.052410     |
| **V36**   | **Preserve area coverage during retrieval**    | **10/10/10** | **29/30**          | **Pass**    | **$0.052496** |
| V37       | V36 retrieval plus stricter transfer paragraph | 10/10/10     | 29/30              | Pass        | $0.052574     |

All six paid runs and preliminary attempts are preserved under [runs](runs/).
V32 regresses breadth and Fundraising-02 ranking. V33 still has six short lists
and new weak picks. V34 has a duplicate response in Programs-01 trial three and
a short Fundraising wording control. V35 loses required wording candidates and
has a short mixed-Operations control. V36 corrects those failures.

V37 has 221 cards and 137 unreviewed appearances, but still includes the same
podcast flag in all three board-deck trials. It adds a landlord-letter demo for
a funder conversation and spreadsheet formulas for a board deck. Programs-02
trial one has four cards. Its [expanded review](v37-expanded-review.md) does not
establish a quality gain over V36, so the stricter paragraph is withdrawn.
Passing an automated audit is not approval of the expanded set.

V36 source is `4e05d5c09ed6cffcea3882cdc3ac0e30617abcc8`, run
`41238818267`, attempt 2. [Validation](runs/41238818267-2/state/validation.json)
records all wording and mixed controls passing, four instruction-only
abstentions and eight blank-browsing cards. All forty requests have final
measured diagnostics. There are no invalid responses, duplicates, timeouts or
transport failures. Median latency is 1,213ms, p95 1,672ms and maximum 2,599ms.
Thirty benchmark requests cost $0.038301, averaging $0.0012767 per request.

Across all 240 paid requests there is one duplicate response, in rejected V34,
and no missing final accounting, timeout, transport failure or new unknown
reservation. No paid case was retried, omitted or replaced. No paid warm-up was
made. All eligibility, output validation, frozen labels and task-diversity gates
remain unchanged. V36 runtime behavior is restored exactly; no fresh V36 paid
run is claimed after restoration.

## Allowance and shutdown

Jason's [additional $1 grant](allowance.json) raises the cumulative comparison
cap from $3 to $4 without resetting prior charges. Starting spend $2.810692 plus
**$0.395981** for these six candidates gives **$3.206673**, leaving **$0.793327**.
All **$0.292560** historical unknown reservations remain charged. The final
[durable balance](runs/41239298055-2/state/comparison-budget.json) is hashed into
the append-only ledger and carried into both disabled test configurations.
No refund or repricing occurred. The existing accounting helper's explicit
292560 prior-unknown argument corrects descriptive totals only.

[Independent shutdown](runs/41239298055-2/state/independent-disabled.json) confirms
paid test calls are off. [Cleanup](runs/41239298055-2/state/secret-cleanup.json)
confirms provider/rate keys are absent. Temporary Actions approval and trigger
are removed. The deployed test artifact is disabled V37; branch code retains
V36. The [latest production deployment](production-disabled.json) remains unchanged
with calls and usage logging disabled; no merge, approval,
review request or follow-up automation was created.

All 638 local tests, typecheck, lint and build pass for the retained change.
Expanded-set human review and production enablement remain pending. The remaining
balance is preserved; this report does not claim all weak picks or short lists
are fixed.
