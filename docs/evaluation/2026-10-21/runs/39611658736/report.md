# Recommendation evaluation

Benchmark: fcny-89-proposed-v1. Labels: approved.
Catalog: sha256:9b971a3a363a2cfb183d5534eac687ae3a908ece83ea36ccc1965cd97e599306
Code: a1d3fa6a2a7b2f5ffe187606f6af41dafd7e9a0f
Model: claude-haiku-5-5. Prompt: catalog-rank-v4. Trials: live.

Rules: 8/10 profiles reached two good picks.
LLM trial 1: 8/10; 0 fallbacks.
LLM trial 2: 10/10; 0 fallbacks.
LLM trial 3: 9/10; 1 fallbacks.

| Profile           | Before rules hits | Rules hits / 3 | Before LLM hits by trial                                                              | LLM hits / 3 by trial                           | Distinct trial results |
| ----------------- | ----------------- | -------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------- | ---------------------- |
| leadership-01     | 2                 | 2              | fallback (invalid-response), fallback (invalid-response), fallback (invalid-response) | 2, 2, 2                                         | 2                      |
| leadership-02     | 3                 | 3              | 3, fallback (invalid-response), 3                                                     | 2, 2, 2                                         | 1                      |
| operations-01     | 2                 | 2              | fallback (invalid-response), fallback (invalid-response), fallback (invalid-response) | 3, 3, 3                                         | 1                      |
| operations-02     | 2                 | 2              | fallback (invalid-response), 2, 2                                                     | 1, 2, 2                                         | 2                      |
| programs-01       | 2                 | 2              | 3, 3, fallback (invalid-response)                                                     | 2, 2, 2                                         | 1                      |
| programs-02       | 2                 | 2              | fallback (invalid-response), 2, fallback (invalid-response)                           | 2, 2, 2                                         | 1                      |
| communications-01 | 1                 | 1              | 3, fallback (invalid-response), fallback (invalid-response)                           | 3, 2, 2                                         | 2                      |
| communications-02 | 2                 | 2              | fallback (invalid-response), 0, fallback (invalid-response)                           | 2, 2, 2                                         | 2                      |
| fundraising-01    | 3                 | 3              | 3, fallback (invalid-response), 3                                                     | 2, 2, 3                                         | 2                      |
| fundraising-02    | 0                 | 0              | fallback (invalid-response), 1, fallback (invalid-response)                           | 1, 2, fallback (invalid-response; 0 rules hits) | 3                      |

JSON includes displayed IDs, misses, latency, tokens, cost and reservations for each request.

Production enablement remains pending owner review of this report, runtime/privacy/budget approvals, two semantic examples, weakest profiles, held-out wording, preview failures, rules-only switch and demo evidence.
