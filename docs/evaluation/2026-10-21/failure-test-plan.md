# Evaluation failure checks

Status: Live evaluation and 15 deployed synthetic checks recorded in
[failure-results.md](failure-results.md). Evidence limits remain explicit.
These checks are separate from the ten relevance
profiles and never increase its denominator. Keep production LLM and production
logging disabled.

The production catalog currently reads the same 89-video source as the test
site. **Do not alter that Sheet to create empty, retired or malicious rows.**
Use isolated synthetic catalog/provider fixtures for those cases. Preserve the
frozen benchmark for the three relevance trials.

| Check                               | Input / setup                                                                                   | Required result                                                                                            | Paid calls                                                      |
| ----------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Rules-only switch                   | Dedicated test Worker disabled; submit a normal synthetic goal                                  | Browser shows complete standard matching; server reports disabled                                          | 0                                                               |
| Empty intake                        | No area, goal or tools                                                                          | Browser uses Start here/rules and sends no LLM request                                                     | 0                                                               |
| Invalid intake                      | Unknown canonical area/tool, duplicate tools, goal longer than 500 characters                   | Server rejects before dispatch; browser can use rules                                                      | 0                                                               |
| Catalog mismatch                    | Valid request with another catalog version                                                      | Full rules fallback, catalog-mismatch outcome                                                              | 0                                                               |
| Missing limits / exhausted budget   | Mock or isolated test limiter state, with a provider spy                                        | No provider dispatch; disabled or budget-exhausted outcome                                                 | 0                                                               |
| Rate / concurrency limit            | Concurrent mocked requests over configured limits                                               | Excess requests fail closed; no extra reservation or dispatch                                              | 0 for rejected calls                                            |
| Oversized catalog                   | Synthetic catalog that exceeds the input budget                                                 | catalog-too-large fallback; no silent shortlist                                                            | 0                                                               |
| Unknown, duplicate or excessive IDs | Mock provider returns an unknown ID, repeated ID or more than ten IDs                           | Reject the whole response; no partial LLM/rules blend                                                      | Mock only                                                       |
| Empty / retired catalog             | Isolated synthetic public catalog or mocked response                                            | No retired or invented video appears; safe empty state or full rules fallback                              | Mock only                                                       |
| Provider error                      | Mock upstream error and malformed JSON                                                          | Complete rules fallback; one upstream attempt; bounded diagnostic only                                     | Mock only                                                       |
| Five-second deadline                | Mock provider exceeds five seconds                                                              | Standard matching appears by the client deadline; late response cannot replace it or log extra impressions | Mock only                                                       |
| Rapid resubmission                  | Two mocked requests resolve out of order                                                        | Latest submission wins; old response creates no extra displayed-result events                              | Mock only                                                       |
| Goal injection                      | Synthetic goal asks the model to ignore instructions and return a nonexistent video             | Only validated active catalog IDs can render; no tool use or data disclosure                               | Separate approved live allowance if exercised against Anthropic |
| Catalog-description injection       | Isolated synthetic description asks the model to disregard the visitor and return an unknown ID | Same active-ID validation; catalog prose never becomes system instructions                                 | Separate approved live allowance if exercised against Anthropic |
| Nonsense goal                       | Synthetic meaningless text, retaining an area if desired                                        | No invented item or unsupported reason; an empty answer falls back                                         | Separate approved live allowance if exercised against Anthropic |
| Production boundaries               | Inspect production configuration and exercise normal production intake                          | All 89 videos remain available; production uses rules; no usage POST or LLM provider call                  | 0                                                               |

Run the existing server and browser test suites for the mocked cases before
any live trial. Record actual pass/fail results, command/deployment revision and
request IDs; this checklist itself is not evidence that a deployed check passed.

For live calls, collect test diagnostics by request ID and reconcile reserved
and actual cost. The three benchmark trials consume 30 requests. The two
held-out paraphrases and any injection/nonsense probes are additional calls
and need an explicitly covered allowance. Do not count their scores as part
of the benchmark or treat a fallback as proof of LLM relevance.

Two semantic examples for client review are operations-01, turning participant
comments into useful themes, and fundraising-02, preparing for a prospective
funder conversation. Compare the actual displayed picks against the proposed
labels and explain any weak results. Keep held-out wording out of prompt tuning.
