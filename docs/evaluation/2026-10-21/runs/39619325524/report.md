# Recommendation evaluation

Benchmark: fcny-89-proposed-v1. Labels: approved.
Catalog: sha256:9b971a3a363a2cfb183d5534eac687ae3a908ece83ea36ccc1965cd97e599306
Code: 9a1df76879e7ac6cff1a211a387ac6e2c791a147
Model: claude-haiku-5-5. Prompt: catalog-rank-v5. Trials: live.

Rules: 8/10 profiles reached two good picks.
LLM trial 1: 8/10; 0 fallbacks.
LLM trial 2: 8/10; 0 fallbacks.
LLM trial 3: 7/10; 0 fallbacks.

| Profile           | Before rules hits | Rules hits / 3 | Before LLM hits by trial          | LLM hits / 3 by trial | Distinct trial results |
| ----------------- | ----------------- | -------------- | --------------------------------- | --------------------- | ---------------------- |
| leadership-01     | 2                 | 2              | 2, 2, 2                           | 2, 2, 2               | 2                      |
| leadership-02     | 3                 | 3              | 2, 2, 2                           | 2, 2, 2               | 1                      |
| operations-01     | 2                 | 2              | 3, 3, 3                           | 3, 3, 2               | 2                      |
| operations-02     | 2                 | 2              | 1, 2, 2                           | 2, 2, 1               | 2                      |
| programs-01       | 2                 | 2              | 2, 2, 2                           | 3, 2, 3               | 2                      |
| programs-02       | 2                 | 2              | 2, 2, 2                           | 1, 1, 1               | 2                      |
| communications-01 | 1                 | 1              | 3, 2, 2                           | 3, 3, 3               | 1                      |
| communications-02 | 2                 | 2              | 2, 2, 2                           | 3, 2, 3               | 2                      |
| fundraising-01    | 3                 | 3              | 2, 2, 3                           | 2, 2, 2               | 1                      |
| fundraising-02    | 0                 | 0              | 1, 2, fallback (invalid-response) | 1, 1, 1               | 3                      |

JSON includes displayed IDs, misses, latency, tokens, cost and reservations for each request.

- At least one LLM trial missed the 8/10 target.

Production enablement remains pending owner review of this report, runtime/privacy/budget approvals, two semantic examples, weakest profiles, held-out wording, preview failures, rules-only switch and demo evidence.
