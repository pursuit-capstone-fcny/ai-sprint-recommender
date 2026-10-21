# Recommendation evaluation

Benchmark: fcny-89-proposed-v1. Labels: approved.
Catalog: sha256:9b971a3a363a2cfb183d5534eac687ae3a908ece83ea36ccc1965cd97e599306
Code: 229500a40ee72372b7a12264f692c2c29c532129
Model: claude-haiku-5-5. Prompt: catalog-rank-v2. Trials: live.

Rules: 3/10 profiles reached two good picks.
LLM trial 1: 0/10; 10 fallbacks.
LLM trial 2: 0/10; 10 fallbacks.
LLM trial 3: 0/10; 10 fallbacks.

| Profile           | Before rules hits | Rules hits / 3 | Before LLM hits by trial | LLM hits / 3 by trial                                                                                               | Distinct trial results |
| ----------------- | ----------------- | -------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| leadership-01     | 1                 | 1              | not run                  | fallback (timeout; 1 rules hits), fallback (rate-limited; 1 rules hits), fallback (rate-limited; 1 rules hits)      | 1                      |
| leadership-02     | 3                 | 3              | not run                  | fallback (timeout; 3 rules hits), fallback (rate-limited; 3 rules hits), fallback (rate-limited; 3 rules hits)      | 1                      |
| operations-01     | 2                 | 2              | not run                  | fallback (rate-limited; 2 rules hits), fallback (rate-limited; 2 rules hits), fallback (rate-limited; 2 rules hits) | 1                      |
| operations-02     | 1                 | 1              | not run                  | fallback (rate-limited; 1 rules hits), fallback (timeout; 1 rules hits), fallback (rate-limited; 1 rules hits)      | 1                      |
| programs-01       | 2                 | 2              | not run                  | fallback (rate-limited; 2 rules hits), fallback (rate-limited; 2 rules hits), fallback (rate-limited; 2 rules hits) | 1                      |
| programs-02       | 0                 | 0              | not run                  | fallback (rate-limited; 0 rules hits), fallback (timeout; 0 rules hits), fallback (rate-limited; 0 rules hits)      | 1                      |
| communications-01 | 1                 | 1              | not run                  | fallback (rate-limited; 1 rules hits), fallback (timeout; 1 rules hits), fallback (rate-limited; 1 rules hits)      | 1                      |
| communications-02 | 1                 | 1              | not run                  | fallback (rate-limited; 1 rules hits), fallback (rate-limited; 1 rules hits), fallback (rate-limited; 1 rules hits) | 1                      |
| fundraising-01    | 1                 | 1              | not run                  | fallback (timeout; 1 rules hits), fallback (rate-limited; 1 rules hits), fallback (timeout; 1 rules hits)           | 1                      |
| fundraising-02    | 1                 | 1              | not run                  | fallback (rate-limited; 1 rules hits), fallback (rate-limited; 1 rules hits), fallback (timeout; 1 rules hits)      | 1                      |

JSON includes displayed IDs, misses, latency, tokens, cost and reservations for each request.

- Rules reached 3/10 profiles; target is 8/10.
- At least one LLM trial missed the 8/10 target.
- Measured usage or cost evidence is incomplete.

Production enablement remains pending owner review of this report, runtime/privacy/budget approvals, two semantic examples, weakest profiles, held-out wording, preview failures, rules-only switch and demo evidence.
