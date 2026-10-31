# Spec: Evaluate recommendations

- **Issue:** #19
- **Status:** V33 catalog presentation pending; V32 withdrawn, quality and short lists unresolved
- **Depends on:** #7, #43, #63 and #8 approvals
- **Source:** [Approved scope](../docs/specs/019-recommendation-evaluation.md)

## Acceptance criteria

- Given a transport or diagnostic-header failure, when a test request fails,
  then preserve its correlation ID, stage, status and allowlisted error code.
  Never save raw errors or retry a paid POST. Missing server usage stays missing.
- Given the October 31 additional $1 Haiku grant, when a new run is approved,
  then retain the $2.810692 prior ceiling and $0.292560 unknown reservations
  under the additive $4 cap.
  Keep production LLM calls and logging disabled.

- Given an independent case times out or encounters a transport/rate failure,
  when continuing evaluation, then retain that failure and wait for its possible
  concurrency lease to expire. Do not retry, refund its unknown spend, change
  labels or change the task-diversity gate. Record waits outside request latency.
  Reload and verify the catalog after a wait, saving recovery diagnostics
  separately. Stop before further paid calls if that unpaid check fails.
- Given dropped console diagnostics, when evaluating authenticated test responses,
  then capture their bounded diagnostic headers and retain later final accounting.
  Missing evidence still fails validation; credentials and raw headers stay private.

### AC-19.1: Frozen benchmark

- **Given** ten synthetic profiles, reviewed ideal/good IDs and one frozen
  public catalog, **when** evaluation starts, **then** hashes, canonical inputs,
  active IDs, unique profile IDs and label reasons are validated. Both paths
  score the same first three cards selected by the browser. Missing slots miss.

### AC-19.2: Independent trial scores

- **Given** three fresh LLM trials, **when** scored, **then** every trial needs
  two good picks for at least eight of ten profiles. Rules fallbacks appear
  separately and never count as LLM passes. Edge cases stay outside that total.

### AC-19.3: CI without provider calls

- **Given** a PR, **when** CI runs, **then** the rules score and frozen mock
  trial report appear in the summary. Low rules relevance warns; invalid
  fixtures, crashes and failed behavior tests fail. Draft labels and mock
  trials are visibly ineligible as live quality evidence.

### AC-19.4: Comparison evidence

- **Given** reports using the same frozen benchmark, **when** compared,
  **then** per-profile before/after results, displayed IDs, versions, variation,
  fallbacks, latency, tokens and measured cost are preserved. Missing metrics
  remain missing. Review of semantic examples, weak profiles and held-out
  wording is recorded separately by the owner.

### AC-19.5: Failure handling

- **Given** injection-like text, invalid output, timeouts or server fallback,
  **when** evaluated, **then** selection still uses validated active catalog
  IDs and reports rules fallback. Deployed trials use the dedicated test endpoint,
  one request per profile, no retry and a five-second deadline. Partial
  evidence is saved before stopping on candidate mismatch.

### AC-19.6: Enablement stays manual

- **Given** missing profile, runtime, privacy or budget approval, **when** a
  live command is attempted, **then** it dispatches zero requests. An explicit
  paid opt-in and allowance for thirty requests are required. Neither passing
  mocks nor a complete report changes production flags.

### AC-19.7: Isolated provider comparison

- **Given** an approved model, effort selection, prompt and allowance, **when**
  comparing providers, **then** three trials per effort use the frozen labels,
  catalog and browser selector. Record the approved prompt version, reasoning tokens, latency,
  known costs and unknown reservations. Bind approval to one source and
  workflow attempt; carry prior costs and unknown reservations forward without
  resetting the allowance. Make no deployment changes. Direct provider results do
  not satisfy the fresh deployed-endpoint gate.

### AC-19.8: Catalog metadata revisions

- **Given** explicit approval to complete catalog tags, **when** rerunning the
  benchmark, **then** save a new catalog snapshot and fingerprint, preserve all
  profile inputs and labels, and keep prior snapshots, results and the diversity
  gate unchanged. Record description evidence for each added tag.

## Remaining evidence

The [structural-selection follow-up](../docs/evaluation/2026-10-31-haiku-order/results.md)
tests relevance-ordered candidates and a structured work plan. V30 scores 10/9/10
with 26/30 broad lists; V31 scores 10/7/10 with 25/30. Both fail unchanged controls
or reliability checks and are withdrawn. V25 behavior is restored; weak picks
and five baseline short lists remain unresolved. Task charge $0.164381 leaves
$0.189308, below the $0.270240 full-run reservation. Unknown reservations stay
charged. Labels and the diversity gate are unchanged; test and production
calls/logging stay disabled. Earlier outcomes and balances below are historical.

The [expanded-relevance follow-up](../docs/evaluation/2026-10-31-haiku-relevance/results.md)
finds no candidate that fixes both weak picks and short lists without regressions.
V26/V27 retain 10/10 each but fall to 23/30 broad lists. V28 times out on all ten
submitted requests; V29 scores 10/9/10 with 21/30 broad lists and control failures.
All are withdrawn and V25 behavior is restored. Task charge $0.321056 leaves
$0.353689; all unknown reservations remain charged. Labels and the diversity gate
are unchanged. Test calls and keys are disabled/removed; production LLM calls
and logging remain off. The following outcomes and balances are historical.

The [Haiku V25 rerun](../docs/evaluation/2026-10-31-haiku-breadth/results.md)
retains 10/10 each and improves qualifying six-to-eight lists from 23/30 to 25/30.
All forty diagnostics and usage records reconcile; controls and reliability pass.
Total cards fall from 205 to 193, and five lists remain thin. Potentially weak
unreviewed picks are flagged separately; full expanded-set quality is not approved.
Four runs cost $0.322196, leaving $0.674745 under the unchanged $3 cap. Labels and
the diversity gate stay fixed. Test calls and keys are disabled/removed; production
LLM calls and logging remain off. Earlier balances below are historical.

The [Haiku V21 rerun](../docs/evaluation/2026-10-30-haiku-reliability/results.md)
scores 10/10 each with forty final diagnostics, reconciled usage and no observed
transport, timeout, invalid-response or duplicate failure. All injection probes
abstain; mixed Operations has six cards and two labeled hits. Breadth is 23/30,
so the unchanged 24/30 retention target remains failed. Recorded task spend
$0.240124 leaves $0.996941 under the approved $3 cap. Labels and the diversity
gate remain unchanged. Test calls are disabled and keys removed; production
LLM calls and logging remain off. Full expanded-set and human review are pending.

The [Haiku V18 breadth run](../docs/evaluation/2026-10-30-haiku-breadth/results.md)
scores 9/10, 10/10, 10/10, with 24/30 accepted six-to-eight lists versus V12's
22/30. All four instruction-only probes abstain; no captured response duplicates
a position. One transport failure lacks a diagnostic, and mixed Operations
still has five cards. Full validation remains incomplete. All six candidates
and failures are preserved. Recorded task spend is $0.475059; $0.237065 remains
under the shared cap, insufficient for another full reserved run. Labels and
the task-diversity gate are unchanged. Test calls are disabled and keys removed;
production LLM calls and logging stay off. Expanded-set and human review remain
pending. Earlier balances below describe their historical runs.

The [Haiku V12 rerun](../docs/evaluation/2026-10-30-haiku-guardrails/results.md)
scores 10/10 in all three trials. All four instruction-only probes abstain;
no duplicate, invalid response or timeout occurs. Six-to-eight lists remain
22/30; eight accepted lists are thinner. Mixed goals, wording controls and
blank browsing pass. All 40 calls reconcile to $0.078075, leaving $0.712124
under the unchanged shared cap. Labels and the diversity gate are unchanged.
Test calls are disabled and keys removed. Production LLM calls and logging
remain off; expanded-set, unseen-input and human review remain pending.

The [Haiku V11 transfer](../docs/evaluation/2026-10-30-haiku-optimized/results.md)
scores 9/10, 10/10 and 10/10, with 22/30 six-to-eight lists. Two instruction-only
controls fail; one duplicate response correctly falls back. All 40 calls have
measured usage and diagnostics. The $0.076318 cost leaves $0.790199 under the
unchanged shared cap. Labels and the diversity gate remain unchanged. Test calls
are disabled and keys removed; production LLM calls and logging remain off.

The [V15 injection rerun](../docs/evaluation/2026-10-30-luna-injection/results.md)
scores 10/10 in all three trials, with 29/30 six-to-eight lists. Four
instruction-only attacks abstain; mixed goals and blank browsing still work.
No benchmark timeout, invalid response or fallback occurs. All 40 calls have
reconciled usage and diagnostics; $0.077044 added leaves $0.866517. Labels and
the diversity gate are unchanged. Test calls are disabled and keys removed;
production LLM calls and logging stay off. Expanded-set and unseen-input review
remain pending; these probes do not establish complete injection resistance.

The [V14 ranking rerun](../docs/evaluation/2026-10-30-luna-ranking/results.md)
scores 10/10 in all three trials. Fundraising-02 has both labeled matches in
its first two positions with 7/6/6 videos; accepted six-to-eight lists increase
from 27/30 to 28/30. No benchmark timeout, invalid response or fallback occurs.
All 34 calls have reconciled usage and diagnostics. The two paid ranking
revisions cost $0.131065; the $1.056439 cumulative ceiling leaves $0.943561.
Labels and the diversity gate are unchanged. The test-only Worker serves the
identical frozen catalog; this does not validate the migrated Apps Script
source. Expanded picks and injection non-abstention need semantic review.
Test calls are disabled and keys removed; production LLM calls and logging
remain off. Historical results below stay intact.

The [V12 Fast rerun](../docs/evaluation/2026-10-30-luna-fast/results.md) scores
10/10, 9/10 and 9/10 with zero timeouts or invalid responses. Changing only
V12's processing tier retains breadth: 27/30 accepted lists contain six to
eight videos, up from 20/30. All 34 requests have measured usage and diagnostics;
fresh relevance evidence is complete. The run costs $0.064224. Jason's additional
$1 raises the cumulative limit to $2; the $0.925374 ceiling leaves at least
$1.074626. Historical charges, labels and the gate are unchanged. Test calls
are disabled and keys removed. Production LLM calls and logging stay off.
Expanded-set, unseen-wording and client review remain pending.

The [Luna breadth trial](../docs/evaluation/2026-10-30-luna-breadth/results.md)
raises six-to-eight accepted lists from 8/30 to 20/30, but scores 7/10, 8/10
and 10/10 with four provider timeouts. V12 is rejected and the repository's
V11 default restored. All diagnostics are saved; four unknown charges remain
reserved. The cumulative ceiling is $0.861150, leaving at least $0.138850,
which cannot reserve another full run. Test calls are disabled, keys removed,
and production LLM calls and logging remain off. Labels and the gate are unchanged.

The [compact Luna rerun](../docs/evaluation/2026-10-30-luna-compact/results.md)
scores 9/10, 8/10 and 10/10 with no timeouts or invalid responses. All 34 calls
have measured usage and diagnostics, and fresh relevance evidence is complete.
Only eight accepted lists contain six to eight videos, down from 23; one case
falls back under the unchanged task-diversity gate. Expanded-set and client
review remain pending. The cumulative ceiling is $0.810414, leaving at least
$0.189586. Test calls are disabled and keys removed. Production LLM calls and
usage logging stay disabled. Historical results below stay intact.

The [Luna diagnostic and timeout rerun](../docs/evaluation/2026-10-29-luna-streaming/results.md)
scores 9/10 in each trial with complete request and cache diagnostics. One
provider timeout retains its unknown reservation, so full validation remains
incomplete. Catalog recovery stops the timeout cascade without changing labels,
the diversity gate or deadlines. The cumulative ceiling is $0.778649, leaving
at least $0.221351. Test calls are disabled and keys removed; production LLM
calls and usage logging remain disabled. Historical results below stay intact.

Jason requested a deduplication fix after the task-tag rerun. The
[selection revision](../docs/evaluation/2026-10-28-dedup/test-plan.md) retains two
same-task videos while reserving space for another primary task. Labels, task
tags, the two-real-primary-task acceptance gate and scoring remain unchanged.
Offline replay restores rules to 8/10 and scores saved Luna responses at
9/10, 10/10, 9/10; these are new derived results, not fresh provider trials.
The subsequent [fresh Luna low run](../docs/evaluation/2026-10-28-dedup/results.md)
scores 9/10, 9/10, 8/10, with one invalid-response fallback and no timeouts.
It meets the isolated numeric target, not the deployed-endpoint gate. Cumulative
Luna cost is at most $0.337635, leaving at least $0.662365 of the original $1.

Jason's initial labels remain unchanged. The [October 22 review replay](../docs/evaluation/2026-10-21/wording-timeout-rerun.md#october-22-review-fixes-and-unpaid-replay)
scores rules 8/10 and the saved V7 LLM responses 3/10 in each trial, with seven
complete rules fallbacks per trial. It supersedes the earlier numeric-readiness
claim after distinct-task validation was corrected. Historical reports and
measured costs remain preserved; replay made no provider calls and cannot
certify fresh relevance. Production LLM calls and logging remain disabled.

The [October 26 Luna comparison](../docs/evaluation/2026-10-26-luna/results.md)
scores low effort 4/10, 5/10, 3/10 and medium 0/10, 1/10, 0/10. Neither meets
the target. This isolated provider run does not certify the deployed endpoint.

The [October 27 prompt trials](../docs/evaluation/2026-10-27-luna-low/results.md)
score V8 at 2/10, 3/10, 3/10 and V9 at 3/10 each. Both are rejected as quality
improvements; V7 remains the default. Those runs left labels, catalog tags and the gate unchanged.

The [October 28 task-tag revision](../docs/evaluation/2026-10-28-task-tags/results.md)
fills 79 missing task arrays without changing labels or the gate. Luna low scores
6/10, 7/10, 7/10 with one invalid-response fallback and no timeouts. Rules falls
to 5/10. Survey and slide-deck labels share primary tasks, so the unchanged
one-per-task selector prevented those profiles from passing. The authorized
selection revision above addresses that regression without retagging or changing
the acceptance gate.

- Ali/Eliot's final label/catalog, semantic and weak-profile review.
- Fresh unseen wording checks, separate from these inspected regressions.
- Production runtime/privacy/budget approval and #23 final demo evidence.

Commands and report formats: [Evaluation guide](../docs/recommendation-evaluation.md).

### October 29 deployed validation

- Given the unchanged tagged benchmark and task-diversity gate, when Jason's
  Luna low test deployment runs, then record three fresh ten-profile trials,
  two separate wording probes and nonsense/injection checks. Wording inherits
  existing labels and never changes the benchmark denominator.
- Given the $0.337635 prior ceiling, when validation starts, then at most
  $0.662365 remains. Pin approval to the clean source and workflow attempt,
  save durable spend after shutdown, and preserve all historical results.

Plan: [Luna test deployment](../docs/evaluation/2026-10-29-luna-deployed/test-plan.md).

Results: [deployed Luna validation](../docs/evaluation/2026-10-29-luna-deployed/results.md)
scores rules 8/10 and fresh Luna 9/10, 8/10, 8/10. Both new wording probes
reach two existing label hits. One invalid response and two timeouts remain;
measured usage is incomplete, so the full evidence gate remains false. The
cumulative Luna ceiling is $0.398955, leaving at least $0.601045. Calls were
disabled and test keys removed. Client review and production approvals remain
pending; production LLM calls and logging stay disabled.

### October 29 reliability rerun

- Given the unchanged labels and task-diversity gate, when the corrected test
  endpoint runs three fresh trials, then retain all outcomes and final usage;
  pre-dispatch failures cost zero and unknown dispatched usage stays reserved.
- [Fresh results](../docs/evaluation/2026-10-29-luna-reliability/results.md):
  **10/10, 9/10, 9/10**, no timeouts or invalid responses, measured accounting
  for all 34 calls and `relevanceEvidenceComplete: true`. The earlier malformed
  output's cause remains unresolved; strict rejection is unchanged.
- Measured spend $0.042546; cumulative ceiling $0.441501; at least $0.558499
  remains. Calls were disabled and test keys removed. Client review, unseen
  wording, production approvals and demo evidence remain pending.

### October 29 current Haiku comparison

- Given Jason's request to retest Haiku, when using the current tagged catalog,
  selector and unchanged labels/gate, then run three fresh deployed trials and
  account for them within the same remaining comparison allowance as Luna.
- [Haiku results](../docs/evaluation/2026-10-29-haiku-current/results.md):
  **8/10, 8/10, 9/10**, three task-diversity fallbacks, no timeouts or invalid
  responses, and complete measured usage. Luna's corresponding scores remain
  10/10, 9/10, 9/10. Haiku is faster but costs 71% more per call in these samples.
- Haiku spend $0.072834; cumulative comparison ceiling $0.514335; at least
  $0.485665 remains. The initial input-limit failure spent zero. The expired
  original Haiku allowance stays closed. Test calls are disabled, keys removed,
  and production LLM calls and logging remain off. Human review is still pending.

### October 29 Haiku low comparison

- Given the requested low effort and unchanged labels/diversity gate, when the
  test endpoint runs three trials, then preserve all outcomes and spend within
  the same remaining allowance.
- [Results](../docs/evaluation/2026-10-29-haiku-low/results.md): **9/10 each**, no
  benchmark fallbacks, timeouts or invalid responses. Median latency 1.159s;
  34 calls cost $0.072834, identical to medium. Programs-02 misses in every trial;
  the separate operations wording probe drops to one label hit.
- All 34 paid calls reconcile, but one unpaid cache-check diagnostic is missing;
  full fresh validation remains incomplete. Saved-input replay does not repair
  that gap. Cumulative ceiling $0.587169; at least $0.412831 remains. Test calls
  are disabled and keys removed. Production LLM calls and logging stay off.

### Expanded-output comparison

- Given Jason's eight-video maximum, when the V10 candidate runs with Haiku low
  and Luna low, then both use identical prompt, catalog, frozen labels and the
  existing task-diversity gate. Preserve the original top-three score.
- Report all displayed IDs, count, known-good IDs and unreviewed IDs separately.
  The full-set quality threshold remains pending client review; do not derive
  one from the existing sparse top-three labels.
- Run candidates sequentially on the test endpoint and carry measured spend
  and unknown reservations forward. Production calls and logging remain off.
