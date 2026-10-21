# Failure-check evidence, October 21, 2026

The evidence below separates real Anthropic responses, deployed synthetic
checks and deterministic tests. Production LLM and usage logging remain
disabled; this record does not approve enablement.

## Deployed evidence

[Run 39552055432](https://github.com/pursuit-capstone-fcny/ai-sprint-recommender/actions/runs/39552055432)
evaluated revision `229500a40ee72372b7a12264f692c2c29c532129`, model
`claude-haiku-5-5`, prompt `catalog-rank-v2`, and the unchanged approved benchmark.
The [report](runs/39552055432/report.md),
[trials](runs/39552055432/trials.json),
[diagnostics](runs/39552055432/diagnostics.json) and
[probes](runs/39552055432/probes.json) preserve the failed result.

| Check                     | Observed result                                                                                                                                 | Limit of evidence                                                                                                            |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Disabled endpoint         | Pre-enable diagnostic check confirmed `disabled`; no paid call was requested.                                                                   | Endpoint/tail check, not a browser rules-only demonstration. Recorded in the run artifact's `live/diagnostics-check.json`.   |
| Three relevance trials    | All 30 requests fell back: 8 client timeouts, 22 `rate-limited`; 0/10 LLM passes in each trial. Rules scored 3/10.                              | No successful model result; fallback never counts toward LLM relevance.                                                      |
| Deadline                  | Eight benchmark requests returned client timeout at roughly 5 seconds. Shared browser selection then chose rules results.                       | The evaluator exercised the deployed API and shared selector, not rendered browser timing or late-response behavior.         |
| Held-out wording          | Both paraphrases timed out at roughly 5 seconds.                                                                                                | No model wording comparison.                                                                                                 |
| Nonsense / goal injection | Both returned `rate-limited` and selected active rules results.                                                                                 | These probes did not test Anthropic's handling of the text.                                                                  |
| Cost                      | 22 benchmark diagnostics matched rate-limit responses; the 8 timeouts had no response request ID. Both blocked probes had matching diagnostics. | No measured token/cost values were captured. Missing values mean unknown, not zero; timed-out calls may have incurred spend. |

The second [run 39553320172](https://github.com/pursuit-capstone-fcny/ai-sprint-recommender/actions/runs/39553320172)
evaluated `a865d2e` with validated catalog caching and the same model, prompt
and labels. It completed all 34 requests and collected matching diagnostics.

| Check                                     | Observed result                                                                                                           | Limit of evidence                                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Catalog mismatch / invalid canonical area | Three mismatch loads returned the frozen catalog version; three invalid-area probes rejected before dispatch in 30–50 ms. | Confirms a warm validated catalog, not cold-cache latency.                                          |
| Invalid model output                      | Six benchmark responses were rejected; the shared selector used complete rules fallback.                                  | Bounded diagnostics omit raw provider output, so the specific validation failure is not attributed. |
| Insufficient output                       | One benchmark response and the nonsense probe selected complete rules fallback.                                           | A valid empty response is not a relevance pass.                                                     |
| Goal injection                            | Anthropic returned only active catalog IDs.                                                                               | One synthetic goal probe does not establish general injection resistance.                           |
| Nonsense                                  | Anthropic returned an empty ID list; three active standard matches were displayed by the shared selector.                 | No claim that these rules picks are semantically relevant.                                          |
| Held-out wording                          | Both responses were valid, but each had 0/3 approved picks.                                                               | Separate from the ten-profile score; do not tune on these paraphrases.                              |
| Cost / latency                            | All 34 request IDs have measured usage and cost, totaling $0.059436. Benchmark p95 was 2.41 seconds.                      | Earlier timed-out calls retain unknown actual cost and maximum reservations.                        |
| Rules-only switch                         | Workflow disabled test calls afterward. Browser submission then displayed Standard matching and three catalog cards.      | Rendered success timing and stale-response behavior remain covered by deterministic browser tests.  |

See the [saved probes](runs/39553320172/probes.json),
[warmups](runs/39553320172/warmups.json) and [comparison](runs/39553320172/report.md).

## Deterministic coverage

Pre-run validation passed 391 tests across Vitest and the tail-parser suite.
These tests use synthetic fixtures, spies or mocked transport; they are not
deployed-provider checks.

| Check                                                                | Verified behavior and source                                                                                                                                                                                                                                                                                     |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Disabled, blank or invalid intake; missing configuration             | No provider dispatch; bounded fallback/rejection. [Endpoint tests](../../../server/recommendations.test.ts), [browser tests](../../../src/pages/LlmRecommendations.test.tsx).                                                                                                                                    |
| Catalog mismatch, retired/malformed or oversized catalog             | Reject before dispatch; input-budget overflow never silently shortlists. [Endpoint tests](../../../server/recommendations.test.ts).                                                                                                                                                                              |
| Empty catalog; unknown, duplicate, excessive or retired returned IDs | Reject invalid responses in full; show only active catalog data or safe empty results. [Selector tests](../../../src/recommendations/selectRecommendations.test.ts).                                                                                                                                             |
| Rate, concurrency and exhausted budgets                              | Atomic reservations enforce limits; failed reservations prevent dispatch; unknown outcomes retain reserved spend. [Budget tests](../../../server/budget.test.ts), [endpoint tests](../../../server/recommendations.test.ts).                                                                                     |
| Provider errors / malformed output                                   | One attempt, full fallback, no automatic retry; bounded output parsing retains available usage. [Adapter tests](../../../server/anthropic.test.ts), [endpoint tests](../../../server/recommendations.test.ts).                                                                                                   |
| Five-second timeout / rapid resubmission                             | Client and server deadlines hold; late or stale responses cannot replace current results or add impressions. [Request tests](../../../src/recommendations/requestRecommendations.test.ts), [UI tests](../../../src/pages/LlmRecommendations.test.tsx).                                                           |
| Goal / catalog-description injection                                 | Injected text cannot invent IDs in rules evaluation. Adapter test keeps goal text outside system instructions and sends no tools. This is limited structural coverage, not model resistance. [Evaluation tests](../../../src/evaluation/evaluation.test.ts), [adapter tests](../../../server/anthropic.test.ts). |
| Production logging / diagnostic privacy                              | Production sends no usage events, even with test flags; tail parser rejects unknown/private fields. [Usage tests](../../../src/pages/UsageEvents.test.tsx), [parser tests](../../../scripts/live-evaluation-logs.test.mjs).                                                                                      |

## Still required

- Deployed isolated-fixture checks for invalid IDs, empty/retired catalogs,
  provider failures, missing limits, exhausted budgets and blocked-call dispatch
  counts. Never mutate the shared tracker Sheet for these checks.
- Catalog-description injection at the deployed validation boundary. Live
  model resilience to arbitrary injected catalog text is not established by
  the goal-injection probe.
- Rendered browser success/failure demonstration, five-second fallback, latest
  submission behavior and the rules-only switch on the deployed test site.
- Three passing relevance trials and a passing rules benchmark;
  Ali/Eliot review of semantic examples, weakest profiles and held-out wording;
  owner enablement decision and #23 demo evidence.

Follow the [failure plan](failure-test-plan.md) and
[approved test limits](test-decision.md). Any later deployed synthetic-provider
checks must be labeled separately from actual Anthropic behavior.
