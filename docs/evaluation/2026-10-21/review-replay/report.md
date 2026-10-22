# Recommendation evaluation

Benchmark: fcny-89-proposed-v1. Labels: approved.
Catalog: sha256:9b971a3a363a2cfb183d5534eac687ae3a908ece83ea36ccc1965cd97e599306
Code: 10044469b63e6577e0f22c295b37bb53dbbc2dcf
Model: claude-haiku-5-5. Prompt: catalog-rank-v7. Trials: live.

Rules: 8/10 profiles reached two good picks.
LLM trial 1: 3/10; 7 fallbacks.
LLM trial 2: 3/10; 7 fallbacks.
LLM trial 3: 3/10; 7 fallbacks.

| Profile           | Before rules hits | Rules hits / 3 | Before LLM hits by trial | LLM hits / 3 by trial                                                                                                                       | Distinct trial results |
| ----------------- | ----------------- | -------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| leadership-01     | 2                 | 2              | 2, 2, 2                  | 2, 2, 2                                                                                                                                     | 2                      |
| leadership-02     | 3                 | 3              | 2, 2, 2                  | fallback (insufficient-results; 3 rules hits), fallback (insufficient-results; 3 rules hits), fallback (insufficient-results; 3 rules hits) | 1                      |
| operations-01     | 2                 | 2              | 2, 2, 3                  | fallback (insufficient-results; 2 rules hits), fallback (insufficient-results; 2 rules hits), fallback (insufficient-results; 2 rules hits) | 1                      |
| operations-02     | 2                 | 2              | 2, 2, 2                  | 2, 2, 2                                                                                                                                     | 2                      |
| programs-01       | 2                 | 2              | 2, 2, 2                  | fallback (insufficient-results; 2 rules hits), fallback (insufficient-results; 2 rules hits), fallback (insufficient-results; 2 rules hits) | 1                      |
| programs-02       | 2                 | 2              | 2, 2, 2                  | fallback (insufficient-results; 2 rules hits), fallback (insufficient-results; 2 rules hits), fallback (insufficient-results; 2 rules hits) | 1                      |
| communications-01 | 1                 | 1              | 3, 3, 3                  | 3, 3, 3                                                                                                                                     | 1                      |
| communications-02 | 2                 | 2              | 3, 3, 3                  | fallback (insufficient-results; 2 rules hits), fallback (insufficient-results; 2 rules hits), fallback (insufficient-results; 2 rules hits) | 1                      |
| fundraising-01    | 3                 | 3              | 3, 3, 3                  | fallback (insufficient-results; 3 rules hits), fallback (insufficient-results; 3 rules hits), fallback (insufficient-results; 3 rules hits) | 1                      |
| fundraising-02    | 0                 | 0              | 2, 2, 2                  | fallback (insufficient-results; 0 rules hits), fallback (insufficient-results; 0 rules hits), fallback (insufficient-results; 0 rules hits) | 1                      |

JSON includes displayed IDs, misses, latency, tokens, cost and reservations for each request.

- At least one LLM trial missed the 8/10 target.

Production enablement remains pending owner review of this report, runtime/privacy/budget approvals, two semantic examples, weakest profiles, held-out wording, preview failures, rules-only switch and demo evidence.
