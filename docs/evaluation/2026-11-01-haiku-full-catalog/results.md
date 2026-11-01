# Full-catalog Haiku results

Haiku now receives the user input and all 89 videos, without rules-based
prefiltering. Keep this requested scope. V54 scores **9/10, 10/10 and 9/10**,
with **28/30** accepted six-to-eight lists. Full validation still fails because
three provider responses repeat a position. Expanded quality remains unapproved.

## Scope and verification

The request path passes the complete validated catalog directly to providerBody.
The unused shortlist helper and its eight obsolete tests are removed. Real
Worker tests verify all 89 outbound records, their source order and public
metadata, and successful mapping of the final catalog position, 88. This
regression failed with the old prefilter and passes after removal. All ten
benchmark profiles and both wording controls also assert the complete ordered
ID list at the actual handler boundary.

The user goal, selected function area and tools remain the intake. The frozen
sheet-derived public catalog retains the existing 200/500-character title and
description caps. System instructions, the eight usefulness/position response
objects, strict parser and browser task-diversity gate are unchanged. No labels,
expected answers, prior conversation or outside research enter the request.

V54 is a fresh repetition of V51's all-catalog configuration, selected because
it matches the clarified product scope. It is not a new prompt optimization.
The V44 shortlist's historical 10/10 results do not describe this implementation.
Do not restore that shortlist to improve the score.

## Fresh evaluation

Source `2fb3920131526a99a400f8c573bd1ae2db13a82d`,
[run 41328286303, attempt two](https://github.com/pursuit-capstone-fcny/ai-sprint-recommender/actions/runs/41328286303),
uses Haiku 5.5 low with thinking disabled. Thirty benchmark cases and ten
controls run once each. Input bound 63,000, output cap 512 tokens, server
deadline 4.5 seconds and client deadline five seconds. No paid retry,
replacement case, response repair, automatic padding or second model call.

| Measure                                 | Result                        |
| --------------------------------------- | ----------------------------- |
| Top-three trial scores                  | 9/10, 10/10, 9/10             |
| Accepted LLM six-to-eight lists         | 28/30                         |
| Accepted LLM lists below six            | 0                             |
| Benchmark rules fallbacks               | 2                             |
| Duplicate responses, including controls | 3                             |
| Provider timeouts or transport failures | 0                             |
| Final measured requests                 | 40/40                         |
| Median / p95 / maximum client latency   | 2.254 / 2.815 / 3.166 seconds |

Programs-01 trial one and Leadership-01 trial three repeat a position and fall
back to rules. The mixed Operations control also duplicates and falls back.
These failures remain in the score and reliability report; rules lists never
count as LLM passes or accepted LLM breadth. Both wording controls reach two
existing label hits, mixed Fundraising has seven cards and two hits, blank
browsing succeeds, and all four instruction-only controls abstain.

The top-three numerical threshold is met, but the combined audit fails its
uniqueness and mixed-input requirements. `freshCompleteEvidence` describes
complete evidence, not a passing overall validation. The original failed audits
are preserved in the run's state directory.

The [expanded review](expanded-review.md) lists every displayed video and each
trial's engine. It contains 146 unreviewed appearances and adds no labels.
Seven appearances match earlier supporting-pick concerns, including a slide
deck for internal-policy answers, negotiation for funding preparation and a
newsletter for course design. Other questionable transfers, such as language
tutoring or job applications for staff-conversation preparation, remain for
semantic review. Fewer historical concern flags do not approve replacements.

## Allowance

All forty submitted requests have final measured usage. The durable budget and
accounting audit reconcile to **$0.088525**, with no new unknown reservation.
The cumulative ceiling rises from $4.234267 to **$4.322792** under the unchanged
additive $5 cap, leaving **$0.677208**. All **$0.379988** historical unknown
reservations remain charged. No new allowance, reset, refund or repricing.

Approval binds the exact source, workflow and attempt. The cancelled preliminary
attempt never enables the provider. Both attempts and the full failed evidence
are archived. The separate accounting audit carries the actual historical
unknown subtotal forward; the older default in the original audit stdout is
explained in `state/accounting-carry-forward.json`, without changing charges.

## Shutdown and final state

Cloudflare rejects the first disabled redeployment during asset upload with
error 10013. The paid workflow remains failed. It still saves the durable budget
and successfully removes provider and rate keys. This deployment failure is
separate from the model's duplicate failures and does not discard any result.

The existing [cleanup-only run 41328869933](https://github.com/pursuit-capstone-fcny/ai-sprint-recommender/actions/runs/41328869933)
successfully redeploys the same source with calls disabled, removes all keys and
verifies shutdown, with zero paid calls. Its evidence is archived under the paid
run's `cleanup` directory. An independent unpaid request also confirms
`reason: disabled`. Temporary approval and paid/cleanup triggers are removed.
No further paid evaluation or follow-up automation is scheduled.

The primary run's `state/disabled.json` is its pre-enable check at 16:53 UTC.
It does not prove shutdown after the failed upload. Use `cleanup/disabled.json`
and `state/independent-disabled.json` for the final disabled state.

The [invariant check](invariants.json) preserves the benchmark, catalog,
task-diversity code and production configuration. The [production check](production-disabled.json)
confirms the latest deployment has both LLM calls and usage logging disabled.
Preflight passes 654 tests, typecheck, lint, formatting, build and both unpaid
provider Worker runtime checks. Final accounting checks are recorded separately.
Duplicate reliability, full-set semantic review, unseen-input evidence and human
approval remain open. No merge or production-readiness claim is made.
