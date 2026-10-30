# Recommendation evaluation

Benchmark: fcny-89-task-tags-2026-10-28. Labels: approved.
Catalog: sha256:b3f96d7113308d627eeb6c9667ac51a44155210faf515db2ef5a41fb5e9bfae7
Trial source code: unknown
Scoring code: 040e17fc12f1fa437b9e4f97356304c05539954f
Evidence: offline replay; saved inputs cannot establish fresh live relevance.
Model: claude-haiku-5-5. Prompt: catalog-rank-v10. Trials: live.

Rules: 8/10 profiles reached two good picks.
LLM trial 1: 9/10; 1 fallbacks.
LLM trial 2: 9/10; 1 fallbacks.
LLM trial 3: 9/10; 1 fallbacks.

| Profile           | Before rules hits | Rules hits / 3 | Before LLM hits by trial | LLM hits / 3 by trial                                                                                                                       | Distinct trial results |
| ----------------- | ----------------- | -------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| leadership-01     | 2                 | 2              | 2, 2, 2                  | 2, 2, 2                                                                                                                                     | 2                      |
| leadership-02     | 3                 | 3              | 3, 3, 3                  | fallback (insufficient-results; 3 rules hits), fallback (insufficient-results; 3 rules hits), fallback (insufficient-results; 3 rules hits) | 1                      |
| operations-01     | 2                 | 2              | 2, 2, 2                  | 2, 2, 2                                                                                                                                     | 2                      |
| operations-02     | 2                 | 2              | 2, 2, 2                  | 2, 2, 2                                                                                                                                     | 1                      |
| programs-01       | 3                 | 3              | 3, 3, 3                  | 3, 3, 3                                                                                                                                     | 1                      |
| programs-02       | 2                 | 2              | 1, 1, 1                  | 2, 2, 2                                                                                                                                     | 3                      |
| communications-01 | 1                 | 1              | 3, 3, 3                  | 3, 3, 3                                                                                                                                     | 1                      |
| communications-02 | 2                 | 2              | 2, 2, 2                  | 2, 2, 2                                                                                                                                     | 2                      |
| fundraising-01    | 3                 | 3              | 3, 3, 3                  | 3, 3, 3                                                                                                                                     | 2                      |
| fundraising-02    | 0                 | 0              | 2, 2, 2                  | 2, 2, 2                                                                                                                                     | 2                      |

## Expanded results

At most eight cards. Known-good IDs use the original labels; unreviewed IDs are not automatically irrelevant. Full-set quality approval remains pending client review. The original top-three score is unchanged.

| Profile           | Rules count / known-good hits | LLM counts by trial | LLM known-good hits by trial |
| ----------------- | ----------------------------- | ------------------- | ---------------------------- |
| leadership-01     | 8 / 2                         | 8, 8, 7             | 2, 2, 2                      |
| leadership-02     | 8 / 3                         | 8, 8, 8             | 3, 3, 3                      |
| operations-01     | 8 / 3                         | 7, 7, 6             | 3, 3, 3                      |
| operations-02     | 8 / 2                         | 4, 5, 4             | 2, 3, 3                      |
| programs-01       | 8 / 4                         | 8, 8, 8             | 4, 4, 4                      |
| programs-02       | 8 / 2                         | 3, 3, 3             | 2, 2, 2                      |
| communications-01 | 8 / 3                         | 8, 8, 8             | 3, 3, 3                      |
| communications-02 | 8 / 3                         | 8, 7, 7             | 3, 3, 3                      |
| fundraising-01    | 8 / 3                         | 7, 6, 5             | 3, 3, 3                      |
| fundraising-02    | 8 / 2                         | 8, 7, 7             | 2, 2, 2                      |

JSON includes displayed IDs, misses, latency, tokens, cost and reservations for each request.

- Saved-input replay cannot establish fresh live relevance.

Production enablement remains pending owner review of this report, runtime/privacy/budget approvals, two semantic examples, weakest profiles, held-out wording, preview failures, rules-only switch and demo evidence.
