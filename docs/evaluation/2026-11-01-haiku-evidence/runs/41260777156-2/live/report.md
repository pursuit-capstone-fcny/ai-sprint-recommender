# Recommendation evaluation

Benchmark: fcny-89-task-tags-2026-10-28. Labels: approved.
Catalog: sha256:b3f96d7113308d627eeb6c9667ac51a44155210faf515db2ef5a41fb5e9bfae7
Trial source code: f00d53d630c69bc5cb95a9db1724cf7144d23757
Scoring code: f00d53d630c69bc5cb95a9db1724cf7144d23757
Evidence: fresh execution in GitHub run 41260777156, attempt 2.
Model: claude-haiku-5-5. Prompt: catalog-rank-haiku-v45. Trials: live.

Rules: 8/10 profiles reached two good picks.
LLM trial 1: 8/10; 2 fallbacks.
LLM trial 2: 8/10; 2 fallbacks.
LLM trial 3: 8/10; 2 fallbacks.

| Profile           | Before rules hits | Rules hits / 3 | Before LLM hits by trial | LLM hits / 3 by trial                                                                   | Distinct trial results |
| ----------------- | ----------------- | -------------- | ------------------------ | --------------------------------------------------------------------------------------- | ---------------------- |
| leadership-01     | not run           | 2              | not run                  | 2, 2, 2                                                                                 | 2                      |
| leadership-02     | not run           | 3              | not run                  | fallback (invalid-response; 3 rules hits), 3, fallback (invalid-response; 3 rules hits) | 2                      |
| operations-01     | not run           | 2              | not run                  | 2, 2, 2                                                                                 | 2                      |
| operations-02     | not run           | 2              | not run                  | 2, fallback (invalid-response; 2 rules hits), 2                                         | 2                      |
| programs-01       | not run           | 3              | not run                  | 3, fallback (invalid-response; 3 rules hits), 3                                         | 3                      |
| programs-02       | not run           | 2              | not run                  | 2, 2, 2                                                                                 | 1                      |
| communications-01 | not run           | 1              | not run                  | 2, 3, 3                                                                                 | 2                      |
| communications-02 | not run           | 2              | not run                  | 2, 2, 2                                                                                 | 1                      |
| fundraising-01    | not run           | 3              | not run                  | fallback (invalid-response; 3 rules hits), 3, fallback (invalid-response; 3 rules hits) | 2                      |
| fundraising-02    | not run           | 0              | not run                  | 2, 2, 2                                                                                 | 3                      |

## Expanded results

At most eight cards. Known-good IDs use the original labels; unreviewed IDs are not automatically irrelevant. Full-set quality approval remains pending client review. The original top-three score is unchanged.

| Profile           | Rules count / known-good hits | LLM counts by trial | LLM known-good hits by trial |
| ----------------- | ----------------------------- | ------------------- | ---------------------------- |
| leadership-01     | 8 / 2                         | 8, 8, 8             | 2, 2, 2                      |
| leadership-02     | 8 / 3                         | 8, 7, 8             | 3, 3, 3                      |
| operations-01     | 8 / 3                         | 8, 8, 8             | 3, 3, 3                      |
| operations-02     | 8 / 2                         | 8, 8, 8             | 2, 2, 3                      |
| programs-01       | 8 / 4                         | 8, 8, 8             | 4, 4, 4                      |
| programs-02       | 8 / 2                         | 8, 8, 8             | 2, 2, 2                      |
| communications-01 | 8 / 3                         | 7, 8, 8             | 3, 3, 3                      |
| communications-02 | 8 / 3                         | 8, 8, 7             | 3, 3, 3                      |
| fundraising-01    | 8 / 3                         | 8, 8, 8             | 3, 3, 3                      |
| fundraising-02    | 8 / 2                         | 8, 8, 8             | 2, 2, 2                      |

JSON includes displayed IDs, misses, latency, tokens, cost and reservations for each request.

- Measured usage or cost evidence is incomplete.

Production enablement remains pending owner review of this report, runtime/privacy/budget approvals, two semantic examples, weakest profiles, held-out wording, preview failures, rules-only switch and demo evidence.
