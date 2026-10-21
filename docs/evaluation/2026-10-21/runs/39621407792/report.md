# Recommendation evaluation

Benchmark: fcny-89-proposed-v1. Labels: approved.
Catalog: sha256:9b971a3a363a2cfb183d5534eac687ae3a908ece83ea36ccc1965cd97e599306
Code: 5e54e2313c572d8bdb25f4d14b352a6b2f7da48f
Model: claude-haiku-5-5. Prompt: catalog-rank-v7. Trials: live.

Rules: 8/10 profiles reached two good picks.
LLM trial 1: 10/10; 0 fallbacks.
LLM trial 2: 10/10; 0 fallbacks.
LLM trial 3: 10/10; 0 fallbacks.

| Profile           | Before rules hits | Rules hits / 3 | Before LLM hits by trial | LLM hits / 3 by trial | Distinct trial results |
| ----------------- | ----------------- | -------------- | ------------------------ | --------------------- | ---------------------- |
| leadership-01     | 2                 | 2              | 2, 2, 2                  | 2, 2, 2               | 2                      |
| leadership-02     | 3                 | 3              | 0, 3, 1                  | 2, 2, 2               | 2                      |
| operations-01     | 2                 | 2              | 2, 2, 2                  | 2, 2, 3               | 2                      |
| operations-02     | 2                 | 2              | 2, 2, 1                  | 2, 2, 2               | 2                      |
| programs-01       | 2                 | 2              | 2, 2, 2                  | 2, 2, 2               | 2                      |
| programs-02       | 2                 | 2              | 1, 1, 1                  | 2, 2, 2               | 2                      |
| communications-01 | 1                 | 1              | 3, 3, 3                  | 3, 3, 3               | 1                      |
| communications-02 | 2                 | 2              | 3, 3, 1                  | 3, 3, 3               | 1                      |
| fundraising-01    | 3                 | 3              | 2, 3, 2                  | 3, 3, 3               | 2                      |
| fundraising-02    | 0                 | 0              | 1, 2, 2                  | 2, 2, 2               | 2                      |

JSON includes displayed IDs, misses, latency, tokens, cost and reservations for each request.

Production enablement remains pending owner review of this report, runtime/privacy/budget approvals, two semantic examples, weakest profiles, held-out wording, preview failures, rules-only switch and demo evidence.
