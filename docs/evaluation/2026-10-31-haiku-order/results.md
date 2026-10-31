# Haiku structural-selection results

The different approaches did not produce an acceptable fix. V30 improves list
length but fails reliability and controls. V31 restores the tested injection
abstentions but regresses ranking and still produces invalid responses. Both
candidates are withdrawn; runtime behavior is restored exactly to the starting
V25 baseline at `88b88e28d40a640290f43ebb0a1abd02dbbe76dc`.

The requested weak-pick and short-list improvements remain unresolved. V25's
historical result is 10/10 each, 25/30 accepted six-to-eight lists and 193 LLM
cards, with five short lists and four flagged appearances. No fresh V25 run
is claimed after restoration. Production enablement remains unapproved.

## Approaches and results

V30 orders all 89 candidates with the existing lexical relevance scorer before
Haiku selects. It preserves every catalog value, reindexes the trusted ID map
with the rows, and keeps V25's prompt and numeric response schema. This tests
catalog presentation order rather than adding more ranking prose or filtering
candidates. Source `88f7d3c088c9857173d093e85164105ea234cb44`.

V31 retains that ordering and asks for a short work/steps plan before the ranked
IDs in the same model call. The server strictly validates and discards the plan,
retaining measured usage even on invalid output. Token limits, deadline, low
effort, thinking disabled and the diversity gate remain unchanged. Source
`800f2b3a6f93c1c20de55c97a3b584b5e2a50c8a`.

| Candidate                                       | Scores    | Accepted six-to-eight lists | LLM cards | Short LLM lists / rules fallbacks | Charge    | Fixed audit |
| ----------------------------------------------- | --------- | --------------------------- | --------- | --------------------------------- | --------- | ----------- |
| [V30](runs/41223950998-2/state/validation.json) | 10, 9, 10 | 26/30                       | 210       | 3 / 1                             | $0.080355 | Fail        |
| [V31](runs/41224939931-2/state/validation.json) | 10, 7, 10 | 25/30                       | 191       | 3 / 2                             | $0.084026 | Fail        |

V30 removes all original review-flag appearances, but one duplicate response
falls back for Programs-02 trial two. The role-spoof probe incorrectly receives
recommendations, and the Fundraising wording control has only one labeled
first-three hit. Other weak picks remain, including a vocabulary lesson builder
for external communications and a print-to-podcast demo for an RFP application.
See its [expanded selections](v30-expanded-review.md), with 134 unreviewed
appearances, including rules fallback cards. More cards do not establish quality.

V31's four instruction-only probes all abstain. Mixed Operations and Fundraising
return eight and seven cards with two labeled hits each; blank browsing returns
eight cards. But one duplicate and one schema-invalid response cause fallbacks
for Operations-02 and Fundraising-01 in trial two. The diagnostic does not identify
the exact schema field, so no particular plan defect is asserted. Fundraising-02
and its wording control each miss with one labeled first-three hit. The original
podcast flag returns at rank five for Communications-02. Its [expanded selections](v31-expanded-review.md)
contain 125 unreviewed appearances, including 16 rules cards. A fundraising webinar
for attendance follow-up and a lesson-planning tool for policy answers also need
review. These observations add no benchmark labels.

Both runs complete all forty requests with final diagnostics and measured usage.
There are no timeouts, transport failures or new unknown reservations. V31's
median latency is 1,808ms, p95 2,222ms and maximum 3,137ms. Its failed relevance
evidence flag does not mean usage is missing; the trial scores fail the criteria.
Workflow success does not override the fixed audit's failures.

The [plan](test-plan.md) records hypotheses and red/green local checks. V30's 634
and V31's 645 local tests, typecheck, lint, build and real Worker checks passed;
live results still rejected both candidates. The rollback removes their active
implementation and tests while preserving the source commits and all artifacts.
Preliminary attempts were cancelled before paid work. No paid case was retried,
omitted or replaced, and no paid warm-up was made.

## Allowance and shutdown

Starting ceiling $2.646311 plus **$0.164381** gives **$2.810692**, leaving
**$0.189308** under the unchanged $3 cap. All $0.292560 historical unknown
reservations remain charged. No new grant, reset, refund or repricing occurred.
The remainder cannot reserve another $0.270240 full run under the current limits.
The [durable balance](runs/41224939931-2/state/comparison-budget.json) is carried
into the ledger and both disabled test configurations.

The fixed audits, benchmark labels, catalog content and task-diversity gate are
unchanged. The accounting helper's existing prior-unknown argument of 292560
corrects descriptive carry-forward totals without changing scores or charges.

[Independent shutdown](runs/41224939931-2/state/independent-disabled.json) confirms
test calls are off. [Cleanup](runs/41224939931-2/state/secret-cleanup.json) confirms
provider and rate keys are absent. Temporary Actions approval and trigger are
removed. The deployed test artifact is disabled V31; branch code restores V25.

Production remains on source `639fe465dff12ea6c925b0dad1c38d1792918547`, deployment
`41127387660`, with LLM calls and usage logging disabled. No merge, approval,
review request or follow-up automation was created. Expanded-set human review
and production enablement remain pending.
