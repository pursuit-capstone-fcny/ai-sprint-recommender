# Recommendation evaluation

Benchmark: fcny-89-task-tags-2026-10-28. Labels: approved.
Catalog: sha256:b3f96d7113308d627eeb6c9667ac51a44155210faf515db2ef5a41fb5e9bfae7
Trial source code: bd5955239f33d6a6e4a1a43aacab049769121fc8
Scoring code: bd5955239f33d6a6e4a1a43aacab049769121fc8
Evidence: fresh execution in GitHub run 41321080272, attempt 2.
Model: claude-haiku-5-5. Prompt: catalog-rank-haiku-v49. Trials: live.

Rules: 8/10 profiles reached two good picks.
LLM trial 1: 10/10; 0 fallbacks.
LLM trial 2: 10/10; 0 fallbacks.
LLM trial 3: 10/10; 0 fallbacks.

| Profile           | Before rules hits | Rules hits / 3 | Before LLM hits by trial | LLM hits / 3 by trial | Distinct trial results |
| ----------------- | ----------------- | -------------- | ------------------------ | --------------------- | ---------------------- |
| leadership-01     | 2                 | 2              | 2, 2, 2                  | 2, 2, 2               | 1                      |
| leadership-02     | 3                 | 3              | 3, 3, 3                  | 3, 2, 3               | 2                      |
| operations-01     | 2                 | 2              | 2, 2, 2                  | 2, 2, 2               | 2                      |
| operations-02     | 2                 | 2              | 2, 3, 3                  | 2, 2, 2               | 2                      |
| programs-01       | 3                 | 3              | 3, 3, 3                  | 3, 2, 3               | 3                      |
| programs-02       | 2                 | 2              | 2, 2, 2                  | 2, 2, 2               | 2                      |
| communications-01 | 1                 | 1              | 3, 3, 3                  | 3, 3, 3               | 1                      |
| communications-02 | 2                 | 2              | 2, 2, 2                  | 2, 2, 2               | 3                      |
| fundraising-01    | 3                 | 3              | 3, 3, 3                  | 3, 3, 3               | 1                      |
| fundraising-02    | 0                 | 0              | 2, 2, 2                  | 2, 2, 2               | 2                      |

## Expanded results

At most eight cards. Known-good IDs use the original labels; unreviewed IDs are not automatically irrelevant. Full-set quality approval remains pending client review. The original top-three score is unchanged.

| Profile           | Rules count / known-good hits | LLM counts by trial | LLM known-good hits by trial |
| ----------------- | ----------------------------- | ------------------- | ---------------------------- |
| leadership-01     | 8 / 2                         | 8, 6, 6             | 2, 2, 2                      |
| leadership-02     | 8 / 3                         | 6, 6, 3             | 3, 2, 3                      |
| operations-01     | 8 / 3                         | 7, 8, 8             | 3, 3, 3                      |
| operations-02     | 8 / 2                         | 8, 8, 7             | 3, 2, 3                      |
| programs-01       | 8 / 4                         | 8, 8, 8             | 4, 4, 4                      |
| programs-02       | 8 / 2                         | 7, 6, 8             | 2, 2, 2                      |
| communications-01 | 8 / 3                         | 6, 8, 7             | 3, 3, 3                      |
| communications-02 | 8 / 3                         | 6, 8, 6             | 3, 3, 3                      |
| fundraising-01    | 8 / 3                         | 8, 5, 8             | 3, 3, 3                      |
| fundraising-02    | 8 / 2                         | 7, 8, 8             | 2, 2, 2                      |

JSON includes displayed IDs, misses, latency, tokens, cost and reservations for each request.

Production enablement remains pending owner review of this report, runtime/privacy/budget approvals, two semantic examples, weakest profiles, held-out wording, preview failures, rules-only switch and demo evidence.
