# Recommendation evaluation

Benchmark: fcny-89-task-tags-2026-10-28. Labels: approved.
Catalog: sha256:b3f96d7113308d627eeb6c9667ac51a44155210faf515db2ef5a41fb5e9bfae7
Trial source code: b8f952dce67ebacca9c48e1d401e00c2e4b2562d
Scoring code: b8f952dce67ebacca9c48e1d401e00c2e4b2562d
Evidence: fresh execution in GitHub run 40998381725, attempt 2.
Model: gpt-6-luna. Prompt: catalog-rank-v10. Trials: live.

Rules: 8/10 profiles reached two good picks.
LLM trial 1: 0/10; 10 fallbacks.
LLM trial 2: 0/10; 10 fallbacks.
LLM trial 3: 0/10; 10 fallbacks.

| Profile           | Before rules hits | Rules hits / 3 | Before LLM hits by trial                                                  | LLM hits / 3 by trial                                                                                                           | Distinct trial results |
| ----------------- | ----------------- | -------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| leadership-01     | 2                 | 2              | fallback (timeout), fallback (rate-limited), fallback (rate-limited)      | fallback (budget-exhausted; 2 rules hits), fallback (budget-exhausted; 2 rules hits), fallback (budget-exhausted; 2 rules hits) | 1                      |
| leadership-02     | 3                 | 3              | 3, fallback (rate-limited), fallback (rate-limited)                       | fallback (budget-exhausted; 3 rules hits), fallback (budget-exhausted; 3 rules hits), fallback (budget-exhausted; 3 rules hits) | 1                      |
| operations-01     | 2                 | 2              | 2, fallback (rate-limited), fallback (rate-limited)                       | fallback (budget-exhausted; 2 rules hits), fallback (budget-exhausted; 2 rules hits), fallback (budget-exhausted; 2 rules hits) | 1                      |
| operations-02     | 2                 | 2              | 3, fallback (rate-limited), fallback (rate-limited)                       | fallback (budget-exhausted; 2 rules hits), fallback (budget-exhausted; 2 rules hits), fallback (budget-exhausted; 2 rules hits) | 1                      |
| programs-01       | 3                 | 3              | 3, fallback (rate-limited), fallback (rate-limited)                       | fallback (budget-exhausted; 3 rules hits), fallback (budget-exhausted; 3 rules hits), fallback (budget-exhausted; 3 rules hits) | 1                      |
| programs-02       | 2                 | 2              | fallback (timeout), fallback (rate-limited), fallback (rate-limited)      | fallback (budget-exhausted; 2 rules hits), fallback (budget-exhausted; 2 rules hits), fallback (budget-exhausted; 2 rules hits) | 1                      |
| communications-01 | 1                 | 1              | fallback (rate-limited), fallback (rate-limited), fallback (rate-limited) | fallback (budget-exhausted; 1 rules hits), fallback (budget-exhausted; 1 rules hits), fallback (budget-exhausted; 1 rules hits) | 1                      |
| communications-02 | 2                 | 2              | fallback (rate-limited), fallback (rate-limited), fallback (rate-limited) | fallback (budget-exhausted; 2 rules hits), fallback (budget-exhausted; 2 rules hits), fallback (budget-exhausted; 2 rules hits) | 1                      |
| fundraising-01    | 3                 | 3              | fallback (rate-limited), fallback (rate-limited), fallback (rate-limited) | fallback (budget-exhausted; 3 rules hits), fallback (budget-exhausted; 3 rules hits), fallback (budget-exhausted; 3 rules hits) | 1                      |
| fundraising-02    | 0                 | 0              | fallback (rate-limited), fallback (rate-limited), fallback (rate-limited) | fallback (budget-exhausted; 0 rules hits), fallback (budget-exhausted; 0 rules hits), fallback (budget-exhausted; 0 rules hits) | 1                      |

## Expanded results

At most eight cards. Known-good IDs use the original labels; unreviewed IDs are not automatically irrelevant. Full-set quality approval remains pending client review. The original top-three score is unchanged.

| Profile           | Rules count / known-good hits | LLM counts by trial | LLM known-good hits by trial |
| ----------------- | ----------------------------- | ------------------- | ---------------------------- |
| leadership-01     | 8 / 2                         | 8, 8, 8             | 2, 2, 2                      |
| leadership-02     | 8 / 3                         | 8, 8, 8             | 3, 3, 3                      |
| operations-01     | 8 / 3                         | 8, 8, 8             | 3, 3, 3                      |
| operations-02     | 8 / 2                         | 8, 8, 8             | 2, 2, 2                      |
| programs-01       | 8 / 4                         | 8, 8, 8             | 4, 4, 4                      |
| programs-02       | 8 / 2                         | 8, 8, 8             | 2, 2, 2                      |
| communications-01 | 8 / 3                         | 8, 8, 8             | 3, 3, 3                      |
| communications-02 | 8 / 3                         | 8, 8, 8             | 3, 3, 3                      |
| fundraising-01    | 8 / 3                         | 8, 8, 8             | 3, 3, 3                      |
| fundraising-02    | 8 / 2                         | 8, 8, 8             | 2, 2, 2                      |

JSON includes displayed IDs, misses, latency, tokens, cost and reservations for each request.

- At least one LLM trial missed the 8/10 target.

Production enablement remains pending owner review of this report, runtime/privacy/budget approvals, two semantic examples, weakest profiles, held-out wording, preview failures, rules-only switch and demo evidence.
