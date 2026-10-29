# Recommendation evaluation

Benchmark: fcny-89-task-tags-2026-10-28. Labels: approved.
Catalog: sha256:b3f96d7113308d627eeb6c9667ac51a44155210faf515db2ef5a41fb5e9bfae7
Trial source code: 736384a1adb3c45989a051d32c1a212c8346093d
Scoring code: 736384a1adb3c45989a051d32c1a212c8346093d
Evidence: fresh execution in GitHub run 40910291157, attempt 2.
Model: gpt-6-luna. Prompt: catalog-rank-v7. Trials: live.

Rules: 8/10 profiles reached two good picks.
LLM trial 1: 9/10; 0 fallbacks.
LLM trial 2: 8/10; 1 fallbacks.
LLM trial 3: 8/10; 2 fallbacks.

| Profile           | Before rules hits | Rules hits / 3 | Before LLM hits by trial | LLM hits / 3 by trial                           | Distinct trial results |
| ----------------- | ----------------- | -------------- | ------------------------ | ----------------------------------------------- | ---------------------- |
| leadership-01     | 2                 | 2              | not run                  | 2, 2, 2                                         | 1                      |
| leadership-02     | 3                 | 3              | not run                  | 3, 3, 3                                         | 1                      |
| operations-01     | 2                 | 2              | not run                  | 2, fallback (invalid-response; 2 rules hits), 2 | 2                      |
| operations-02     | 2                 | 2              | not run                  | 2, 2, 2                                         | 2                      |
| programs-01       | 3                 | 3              | not run                  | 3, 3, fallback (timeout; 3 rules hits)          | 3                      |
| programs-02       | 2                 | 2              | not run                  | 2, 2, fallback (timeout; 2 rules hits)          | 2                      |
| communications-01 | 1                 | 1              | not run                  | 3, 3, 3                                         | 1                      |
| communications-02 | 2                 | 2              | not run                  | 2, 2, 2                                         | 2                      |
| fundraising-01    | 3                 | 3              | not run                  | 3, 3, 3                                         | 1                      |
| fundraising-02    | 0                 | 0              | not run                  | 1, 1, 2                                         | 3                      |

JSON includes displayed IDs, misses, latency, tokens, cost and reservations for each request.

- Measured usage or cost evidence is incomplete.

Production enablement remains pending owner review of this report, runtime/privacy/budget approvals, two semantic examples, weakest profiles, held-out wording, preview failures, rules-only switch and demo evidence.
