# Spec: Evaluate recommendations

- **Issue:** #19
- **Status:** Latest expanded-output validation incomplete; reliability rerun pending; client approval pending
- **Depends on:** #7, #43, #63 and #8 approvals
- **Source:** [Approved scope](../docs/specs/019-recommendation-evaluation.md)

## Acceptance criteria

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
