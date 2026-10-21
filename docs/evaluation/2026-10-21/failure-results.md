# Failure-check evidence, October 21, 2026

The evidence below separates real Anthropic responses, deployed synthetic
checks and deterministic tests. Production LLM and usage logging remain
disabled; this record does not approve enablement.

## Current V4 evidence

[Run 39611658736](https://github.com/pursuit-capstone-fcny/ai-sprint-recommender/actions/runs/39611658736)
tested revision `a1d3fa6` with `catalog-rank-v4`. Rules scored 8/10 and three
fresh LLM trials scored 8/10, 10/10 and 9/10 against unchanged labels. All 30
benchmark calls have usage/cost diagnostics. One duplicate output was rejected
in full; the ten nullable slots eliminated the oversized-array failures seen
in V3. Deterministic tests still reject unknown, malformed and excessive output.

The workflow failed because the separate Operations wording probe timed out
without an attributable request ID or cost. Its full $0.006256 maximum remains
in conservative accounting. No paid call was retried. The separate Fundraising
probe scored 0/3; nonsense and goal injection returned empty selections and
used rules fallback. See [probes](runs/39611658736/probes.json) and
[run status](runs/39611658736/run-status.json).

All 15 [deployed synthetic checks](runs/39611658736/failure-checks.json)
passed; they used no real provider or Sheet. The workflow removed that Worker
and [confirmed test shutdown](runs/39611658736/disabled.json). A subsequent
browser submission displayed [Standard matching](runs/39611658736/disabled-browser.png).
The live AI browser window was skipped after the failed probe evidence check.
Cold catalog loads still needed bounded unpaid retries. Paid requests retain
one attempt and the five-second deadline.

Combined validation passed 449 tests, typecheck, lint, build and formatting.
CI and preview checks passed on the evaluated revision. The historical
evidence below remains intact; current findings and cost accounting are in
the [quality rerun](quality-rerun.md).

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

## Deployed synthetic checks

[Run 39554453626](https://github.com/pursuit-capstone-fcny/ai-sprint-recommender/actions/runs/39554453626)
tested revision `4954c88ccddd720adb0bdb1731626570609cc153` in a separate Worker.
All **15 checks passed**. Its provider, catalog and budget dependencies were
fixed synthetic stubs. The shared Sheet and real Anthropic API were never
called. The workflow deleted the temporary Worker afterward.

- Default-off, kill switch, empty/retired catalogs, oversized input/catalog,
  exhausted budget and rate limits prevented provider dispatch.
- Unknown, duplicate and excessive IDs, plus an injected catalog description
  paired with a fabricated provider ID, caused complete invalid-response
  fallback. The description remained untrusted user-message data.
- Provider errors fell back. The server deadline fired at **5,000 ms** and
  aborted the synthetic provider.
- A successful control returned a known catalog ID.

The [saved report](runs/39554453626/failure-checks.json) records each outcome
and dispatch count. These are deployed handler checks, not a claim about
Anthropic's general resistance to injected catalog prose.

## Deterministic coverage

Final combined validation passed 410 tests, typecheck, lint and build.
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

- Live model resilience to arbitrary injected catalog text remains unproven.
  The deployed check establishes that an invented ID cannot cross validation.
- A rendered browser AI-success demonstration for #23. Rules fallback was
  demonstrated on the deployed test site; deadline and latest-submission
  rendering remain covered by deterministic browser tests.
- The numeric relevance gate now passes in V4. Ali/Eliot review of semantic
  examples, weakest profiles and wording robustness, cold-request follow-up,
  owner enablement decision and #23 demo evidence remain required.

Follow the [failure plan](failure-test-plan.md) and
[approved test limits](test-decision.md). Any later deployed synthetic-provider
checks must be labeled separately from actual Anthropic behavior.
