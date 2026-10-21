# Recommendation evaluation

Benchmark: fcny-89-proposed-v1. Labels: approved.
Catalog: sha256:9b971a3a363a2cfb183d5534eac687ae3a908ece83ea36ccc1965cd97e599306
Code: 9911a6d4113fc173ccf480d75e22fe790a98744b
Model: claude-haiku-5-5. Prompt: catalog-rank-v3. Trials: live.

Rules: 8/10 profiles reached two good picks.
LLM trial 1: 4/10; 6 fallbacks.
LLM trial 2: 3/10; 5 fallbacks.
LLM trial 3: 3/10; 7 fallbacks.

| Profile           | Before rules hits | Rules hits / 3 | Before LLM hits by trial                                    | LLM hits / 3 by trial                                                                                                           | Distinct trial results |
| ----------------- | ----------------- | -------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| leadership-01     | 1                 | 2              | 2, 2, 2                                                     | fallback (invalid-response; 2 rules hits), fallback (invalid-response; 2 rules hits), fallback (invalid-response; 2 rules hits) | 1                      |
| leadership-02     | 3                 | 3              | 2, fallback (invalid-response), 2                           | 3, fallback (invalid-response; 3 rules hits), 3                                                                                 | 2                      |
| operations-01     | 2                 | 2              | 1, 0, 1                                                     | fallback (invalid-response; 2 rules hits), fallback (invalid-response; 2 rules hits), fallback (invalid-response; 2 rules hits) | 1                      |
| operations-02     | 1                 | 2              | 1, 1, fallback (invalid-response)                           | fallback (invalid-response; 2 rules hits), 2, 2                                                                                 | 3                      |
| programs-01       | 2                 | 2              | 0, 0, fallback (invalid-response)                           | 3, 3, fallback (invalid-response; 2 rules hits)                                                                                 | 2                      |
| programs-02       | 0                 | 2              | 2, 2, fallback (invalid-response)                           | fallback (invalid-response; 2 rules hits), 2, fallback (invalid-response; 2 rules hits)                                         | 2                      |
| communications-01 | 1                 | 1              | fallback (invalid-response), 3, fallback (invalid-response) | 3, fallback (invalid-response; 1 rules hits), fallback (invalid-response; 1 rules hits)                                         | 2                      |
| communications-02 | 1                 | 2              | 3, 2, fallback (insufficient-results)                       | fallback (invalid-response; 2 rules hits), 0, fallback (invalid-response; 2 rules hits)                                         | 2                      |
| fundraising-01    | 1                 | 3              | 1, 0, 1                                                     | 3, fallback (invalid-response; 3 rules hits), 3                                                                                 | 2                      |
| fundraising-02    | 1                 | 0              | 1, 0, 2                                                     | fallback (invalid-response; 0 rules hits), 1, fallback (invalid-response; 0 rules hits)                                         | 2                      |

JSON includes displayed IDs, misses, latency, tokens, cost and reservations for each request.

- At least one LLM trial missed the 8/10 target.

Production enablement remains pending owner review of this report, runtime/privacy/budget approvals, two semantic examples, weakest profiles, held-out wording, preview failures, rules-only switch and demo evidence.
