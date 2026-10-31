# Haiku breadth follow-up results

V25 passes the unchanged automated validation. Accepted six-to-eight lists rise
from V21's 23/30 to **25/30**, exceeding the fixed 24/30 retention target. All three
trials retain 10/10. Forty requests have final diagnostics and reconciled measured
usage, with no observed transport failure, timeout, invalid response or duplicate.
All four injection probes abstain; mixed, wording and blank controls pass.

This is a count-threshold improvement, not an increase in total recommendations.
Total cards fall from 205 to 193, and mean length falls from 6.83 to 6.43. Five
lists still contain four cards. The 109 unreviewed expanded appearances need
human review. The [review file](expanded-review.md) flags potentially weak picks,
including Job Applications for student follow-up and AI Peer Learning Groups for
a board presentation. Passing the frozen top-three score does not establish the
quality of every card. Production enablement remains unapproved.

## Change and evidence

V25 combines the exact V14 breadth paragraph with V21's mixed-goal handling,
blank browsing and final eligibility/uniqueness instructions. Before leaving
ranks four through six empty, it checks the unused catalog for concrete methods
that prepare, perform, check, share or follow through on the requested work.
Direct matches stay first; unrelated padding and repeated positions remain
forbidden. The earlier V14 achieved 25/30 but failed controls that the later
instructions address. All earlier failures remain preserved.

The saved V21 audit reproduces the 23/30 failure without paid calls. Request
tests prove that restoring only the old breadth paragraph reconstructs all ten
V21 request hashes. Historical V18, V12, V11 and Luna request-isolation checks
also pass. These tests verify construction; the fresh live run verifies the
observed behavior.

No catalog metadata, goal text, benchmark labels, scoring thresholds, diversity
logic, model, effort, schema, deadline, token cap or transport setting changes.
Haiku 5.5 uses low effort with thinking disabled. The source tested for V25 is
`6efa89966e8d93a637b95f39bce18c94406b1de4`.

## Every paid candidate

Each run contains thirty benchmark requests and ten unchanged probes. No paid
case is retried, omitted or replaced. Workflow success alone is not a quality
pass; the saved audit records the failures below.

| Candidate                                       | Scores     | Six-to-eight lists | Cards | Mixed Operations | Cost      | Fixed audit               |
| ----------------------------------------------- | ---------- | ------------------ | ----- | ---------------- | --------- | ------------------------- |
| [V22](runs/41215956221-2/state/validation.json) | 10, 10, 10 | 23/30              | 202   | 6                | $0.080968 | Fail breadth              |
| [V23](runs/41216398502-2/state/validation.json) | 10, 10, 10 | 22/30              | 195   | 5                | $0.080968 | Fail breadth and controls |
| [V24](runs/41216910164-2/state/validation.json) | 10, 10, 10 | 21/30              | 190   | 6                | $0.079902 | Fail breadth              |
| [V25](runs/41217335716-2/state/validation.json) | 10, 10, 10 | 25/30              | 193   | 6                | $0.080358 | Pass                      |

V22 adds a supporting-step check; V23 moves it later and regresses. V24 selects
the useful set before ordering and also regresses. V25 retains the current
control fixes with the historical breadth paragraph. See the [plan](test-plan.md)
for hypotheses and the changes made before each run. Preliminary attempts were
cancelled before paid work; their workflow metadata and skipped steps are saved.

## V25 controls and remaining thin lists

- Mixed Operations: six cards and two labeled top-three hits.
- Mixed Fundraising: eight cards and two hits.
- Wording Operations: seven cards and two hits.
- Wording Fundraising: eight cards and two hits.
- Fundraising-02: six, eight and seven cards; two hits in every trial.
- Blank browsing: eight LLM cards. All four instruction-only probes and nonsense
  return empty provider selections, followed by the existing rules fallback.
- Thin lists: Leadership-02 has four cards in all trials; Communications-02 and
  Fundraising-01 each have four in trial three.

All benchmark requests use the LLM path. There are no missing diagnostics,
unknown new reservations, invalid outputs or duplicates in any of these four
runs. V25's forty-request median latency is 1,237ms, p95 1,879ms and maximum
1,964ms. Its thirty benchmark calls cost $0.060300, averaging $0.002010 per call.
This is measured usage for this candidate, not a general price guarantee.

## Allowance and shutdown

The shared $3 cap stays unchanged. Starting ceiling $2.003059 plus **$0.322196**
for these four runs gives **$2.325255**, leaving **$0.674745**. All $0.225000 of
historical unknown reservations remain charged; nothing was reset, refunded or
repriced. Each run reserved at most $0.270240 before starting. No Luna calls ran.

The [final budget](runs/41217335716-2/state/comparison-budget.json) and
[accounting audit](runs/41217335716-2/state/accounting-audit.json) reconcile all
forty requests. The ledger and disabled test configurations carry the new floor.
The [shutdown check](runs/41217335716-2/state/independent-disabled.json) confirms
test calls are off. [Cleanup](runs/41217335716-2/state/secret-cleanup.json) confirms
provider and rate keys are absent. The temporary Actions approval and evaluation
label were removed. No follow-up automation was created.

The latest production deployment remains source
`639fe465dff12ea6c925b0dad1c38d1792918547`, run `41127387660`. Its deployment logs
confirm `LLM_ENABLED=false` and `VITE_USAGE_ENABLED=false`; production configuration
was not edited. See [saved verification](runs/41217335716-2/state/production-disabled.json).

All 629 local tests, typecheck, lint and build pass. Candidate CI and preview are
checked separately before handoff. Merge, expanded-set review and production
enablement remain manual. This frozen-catalog run does not validate the separately
migrated Apps Script integration.
