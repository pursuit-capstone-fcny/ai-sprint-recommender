# Recommendation evaluation

Benchmark: fcny-89-task-tags-2026-10-28. Labels: approved.
Catalog: sha256:b3f96d7113308d627eeb6c9667ac51a44155210faf515db2ef5a41fb5e9bfae7
Trial source code: 938c6cb1e8db1eeec375514b9bb9b1a676651e52
Scoring code: 938c6cb1e8db1eeec375514b9bb9b1a676651e52
Evidence: fresh execution in GitHub run 40925921428, attempt 2.
Model: claude-haiku-5-5. Prompt: catalog-rank-v7. Trials: live.

Rules: 8/10 profiles reached two good picks.
LLM trial 1: 8/10; 1 fallbacks.
LLM trial 2: 8/10; 1 fallbacks.
LLM trial 3: 9/10; 1 fallbacks.

| Profile           | Before rules hits | Rules hits / 3 | Before LLM hits by trial | LLM hits / 3 by trial                                                                                                                       | Distinct trial results |
| ----------------- | ----------------- | -------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| leadership-01     | not run           | 2              | not run                  | 2, 2, 2                                                                                                                                     | 1                      |
| leadership-02     | not run           | 3              | not run                  | fallback (insufficient-results; 3 rules hits), fallback (insufficient-results; 3 rules hits), fallback (insufficient-results; 3 rules hits) | 1                      |
| operations-01     | not run           | 2              | not run                  | 2, 2, 2                                                                                                                                     | 2                      |
| operations-02     | not run           | 2              | not run                  | 2, 2, 2                                                                                                                                     | 1                      |
| programs-01       | not run           | 3              | not run                  | 3, 3, 3                                                                                                                                     | 1                      |
| programs-02       | not run           | 2              | not run                  | 1, 1, 2                                                                                                                                     | 3                      |
| communications-01 | not run           | 1              | not run                  | 3, 3, 3                                                                                                                                     | 1                      |
| communications-02 | not run           | 2              | not run                  | 2, 2, 2                                                                                                                                     | 1                      |
| fundraising-01    | not run           | 3              | not run                  | 3, 3, 3                                                                                                                                     | 2                      |
| fundraising-02    | not run           | 0              | not run                  | 2, 2, 2                                                                                                                                     | 2                      |

JSON includes displayed IDs, misses, latency, tokens, cost and reservations for each request.

- Measured usage or cost evidence is incomplete.

Production enablement remains pending owner review of this report, runtime/privacy/budget approvals, two semantic examples, weakest profiles, held-out wording, preview failures, rules-only switch and demo evidence.
