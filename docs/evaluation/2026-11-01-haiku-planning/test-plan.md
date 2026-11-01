# Plan before selection

V47 changes the ordering of the reasoning task. Haiku first writes a short work
plan from the goal, then compares catalog candidates for those operations. This
is one provider call. A concise procedure replaces the accumulated ranking
instructions; it covers eligibility, mixed inputs, method comparison, direct
matches, supporting steps, breadth and unique positions.

The response contains `workSteps` followed by `ranks`. The eight existing rank
objects retain their short `use` statements and numeric positions. The adapter
requires a nonempty plan for selected videos, validates the complete response,
and discards the plan and notes before returning trusted IDs. Plans have no new
prose-length constraint; the existing whole-response and token limits remain.
Empty plans with empty selections support abstention. Missing/extra fields,
duplicate or invalid positions are rejected with measured usage retained.

The hypothesis is that choosing against an established work plan reduces
post-hoc rationalization of weak supports. Removing competing instructions may
also help uniqueness. The saved V44 replay remains red with 22 previously
questioned support appearances. This observation is not a relevance label set.
Semantic improvement requires the live comparison; synthetic adapter tests only
verify format, isolation, accounting and failure behavior. A new format regression
first failed on the real adapter, then passed after implementing the wrapper.

Candidate retrieval, public metadata, benchmark labels and the browser
task-diversity gate remain unchanged. No profile-specific exclusions, automatic
padding, second call, paid retry or replacement case is introduced. Keep Haiku
5.5 low, thinking disabled, the 63,000 input bound, 512 output tokens and
4.5-second server deadline. All twenty unique validation inputs fit their full
and retrieved wire bounds, checked by `check-input-bounds.mjs` without a network
request.

## Allowance and acceptance

Jason approved another $1. The additive cap is $5, carrying all $3.798745 prior
charges and $0.366876 unknown reservations. Available balance is $1.201255.
The unchanged maximum reservation is $0.006556 per request and $0.262240 for a
complete forty-case run. Historical grants, budgets and hashes remain intact.
Require exact source, workflow run and attempt approval before live calls.

Run the same thirty benchmark requests and ten separate controls. Retain the
candidate only if it preserves V44's 10/10 per trial, 30/30 accepted six-to-eight
lists and clean reliability while improving the questioned supporting picks.
Review every replacement; absence of earlier flags alone does not approve a
video. Preserve every failed result and charge. Disable test calls, remove keys
and temporary approval afterward. Production LLM calls and logging stay off.

The first V47 workflow, 41269214068 attempt two, stopped before provider
enablement because the new unpaid bounds script omitted explicit Node imports.
Import `process`, `Buffer` and `console` without changing lint rules or the model
request. Preserve the zero-cost failure and both skipped paid steps. Recheck lint
and the bounds before pinning a new source and workflow attempt.

## V48: isolate planning from instruction consolidation

V47 completed all forty requests with measured accounting but regressed to
7/10, 5/10 and 8/10, with eight duplicate responses, an instruction-only failure,
two Fundraising-02 top-three misses and only 21/30 accepted broad lists. Its
$0.055709 charge is retained, leaving $1.145546. No timeout, transport failure or
new unknown reservation occurred. The full failed evidence remains archived.

Restore V44's tested eligibility, mixed-goal, target-audience, breadth and
uniqueness instructions. Retain only the new plan-before-selection structure,
with minimal changes to refer to the `ranks` envelope. This isolates planning
from V47's wholesale instruction consolidation. Keep the format/parser, retrieval,
limits, labels, gates, forty cases and no-retry policy unchanged. Recheck wire
bounds and all local checks before another exact-attempt test. Production stays
off; V47 is disabled and its keys and temporary approval have been removed.

## V49: plan followed by numeric ranks

V48 restores every injection/wording control and scores 10/10, 9/10 and 10/10,
with 29/30 accepted broad lists. One duplicate causes the remaining benchmark
fallback. Every accepted list has six to eight cards, but questionable supports
remain. Preserve its $0.063994 measured charge, leaving $1.081552 with no new
unknown reservation. V48 is not retained as the completed fix.

Test whether removing per-rank prose reduces the duplicate risk without losing
the work-plan benefit. Return `workSteps` followed by eight numeric/null ranks.
Keep V44's selection criteria and V48's planning instruction; remove only the
per-rank note format and adapt the envelope wording. The adapter still rejects
all missing/extra ranks, invalid IDs and repeated positions. It never drops a
duplicate, fills a slot, repairs a response or bypasses the browser gate. The
legacy response formats retain their adapter tests. A new real-adapter test first
fails for the numeric plan format, then passes after implementation.

Use the same provider, low effort, one call, limits, frozen data and forty-case
validation. Recheck every wire bound. Retain all prior failures, charges and
unknown reservations under the existing $5 cap. Test calls and production
logging remain disabled outside the exact-attempt run.

## V50: rate the full candidate set

V49 scores 10/10 in every trial, without duplicates or transport failures, but
only 28/30 lists contain six to eight videos. Blank browsing abstains and weak
supporting picks remain. Preserve its $0.055768 charge, leaving $1.025784.

V50 changes the decision from filling eight ranks to independently rating every
retrieved candidate against a short work plan in one call. Three hypotheses are
separable in the evidence: full-set evaluation may prevent early stopping;
explicit usefulness bands may distinguish concrete supporting methods from
shared topics; one required field per catalog position prevents repeated
selections. No claim follows from schema tests about semantic quality.

Use scores from 0 to 100, with 90+ direct matches, 75+ direct supporting steps,
60+ concrete transferable methods, and below 60 excluded. Sort by score then
catalog order, return at most eight, and keep the existing browser diversity
gate. Never inflate scores, pad short lists, or retry. The provider must return
exactly one score per candidate. Reject missing/extra keys, noninteger or
out-of-range scores and missing plans. Preserve measured usage on rejection.

Numeric bounds are validated locally because Anthropic's structured-output
schema supports only a subset of JSON Schema. See the
[official structured-output documentation](https://platform.claude.com/docs/en/build-with-claude/structured-outputs).
The wire schema uses required integer fields, with no unsupported bounds. A real
adapter test failed before implementation and passes afterward. Keep all legacy
format tests, frozen labels, retrieval, public metadata and task-diversity rules.
Use the same 512 output tokens, 4.5-second deadline and forty-case validation.
The candidate must meet the original V44 retention conditions, including
reviewing all replacement picks. Production stays disabled.
