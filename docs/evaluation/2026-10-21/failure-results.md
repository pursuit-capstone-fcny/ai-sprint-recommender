# Failure-check evidence — October 21, 2026

AC-19.5 remains incomplete. Deterministic tests pass, but the first deployed
evaluation produced only rules fallbacks. Neither that result nor a blocked
injection probe establishes model resilience. Production LLM and usage logging
remain disabled; this record does not approve enablement.

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

The next candidate, `a865d2e`, adds validated catalog caching, two unpaid
catalog checks before each trial, and a model-access preflight. Its deployed
results are pending in this record. Preserve the earlier evidence separately.

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
- Actual model handling of both goal and catalog-description injection, plus
  nonsense input. Existing blocked probes cannot satisfy this requirement.
- Rendered browser success/failure demonstration, five-second fallback, latest
  submission behavior and the rules-only switch on the deployed test site.
- Complete latency/usage/cost accounting and three passing relevance trials;
  Ali/Eliot review of semantic examples, weakest profiles and held-out wording;
  owner enablement decision and #23 demo evidence.

Follow the [failure plan](failure-test-plan.md) and
[approved test limits](test-decision.md). Any later deployed synthetic-provider
checks must be labeled separately from actual Anthropic behavior.
