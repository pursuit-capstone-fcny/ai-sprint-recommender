# Luna low prompt trials

Neither revision improved the accepted benchmark score. Keep V7 as the default
and retain V8 and V9 as rejected experiments. Production LLM calls and usage
logging remain disabled. No deployed recommendation behavior changed.

## Results

| Prompt                       | Trial passes     | Rules fallbacks | Timeouts / 30 | Invalid outputs / 30 | Median / p95 latency |
| ---------------------------- | ---------------- | --------------- | ------------- | -------------------- | -------------------- |
| Original V7                  | 4/10, 5/10, 3/10 | 6, 5, 7         | 1             | 0                    | 1.357s / 2.971s      |
| V8, complementary tasks      | 2/10, 3/10, 3/10 | 8, 7, 7         | 1             | 0                    | 3.066s / 4.321s      |
| V9, concise workflow ranking | 3/10, 3/10, 3/10 | 7, 7, 7         | 0             | 1                    | 2.509s / 3.702s      |

All use `gpt-6-luna`, low effort, standard mode, the same 4.5-second deadline,
2,000-token output ceiling, no caching and no retries. Each row represents
three independent ten-profile trials. The benchmark, all 89 catalog items,
labels, catalog ordering, output schema and browser selector are unchanged.
Medians here average the two middle observations; generated summaries use
nearest-rank p50. Timeouts count in latency statistics.

V8 added instructions for useful complementary steps and existing task tags.
V9 shortened the prompt and distinguished exact matches from transferable
workflows. Neither includes labeled answers or benchmark-specific examples.
V8 had 21 task-diversity fallbacks and one timeout. V9 had 20 task-diversity
fallbacks and one invalid response. V9 removed the observed timeout but was
slower than V7 and did not improve the accepted quality score.

| Profile           | V7 passes / 3 | V8 passes / 3 | V9 passes / 3 |
| ----------------- | ------------- | ------------- | ------------- |
| leadership-01     | 2             | 2             | 3             |
| leadership-02     | 2             | 0             | 0             |
| operations-01     | 0             | 0             | 0             |
| operations-02     | 3             | 3             | 3             |
| programs-01       | 0             | 0             | 0             |
| programs-02       | 0             | 0             | 0             |
| communications-01 | 3             | 3             | 3             |
| communications-02 | 2             | 0             | 0             |
| fundraising-01    | 0             | 0             | 0             |
| fundraising-02    | 0             | 0             | 0             |

## What limits quality

Seventy-nine catalog items have no task tags. Only three profiles have two
distinct primary task tags among their labeled ideal/good picks. These trials
do not resolve that gap. For example, the direct survey-analysis, board-deck
and grant-preparation videos have no task tags. Strong semantic matches can
therefore still trigger the unchanged rules fallback.

As a diagnostic only, the first three raw provider picks have at least two
label matches in 28/30 V7 observations and 29/30 for each revision. These are
not accepted scores: they precede the browser gate and cannot substitute for
what the user actually sees. The rules baseline remains 8/10.

Manual inspection found no credible reason to promote either revision:

- V8 preserves direct difficult-conversation and board-deck matches but drops
  broad tagged supporting videos. Their fallback counts increase.
- V9 returns all three labeled board-deck videos in the first three positions,
  yet they remain untagged and fall back. It also recommends an unrelated bank
  terms video among later FAQ and grant-preparation picks, so broader transfer
  instructions do not provide a reliable quality improvement.
- Funder-conversation rankings contain both labeled matches, but still lack
  two tagged tasks. The unchanged rules fallback has zero label hits there.

Do not add unrelated tagged videos to increase the pass count. Further useful
work needs a reviewed catalog-coverage decision; no frozen tags or labels were
changed here. Both revisions remain experimental, and the original V7 system
prompt remains the default. This inspected development benchmark does not
establish generalization or production readiness.

## Spending

| Run                       | Calls | Known token cost | Unknown maximum reservations | Conservative total |
| ------------------------- | ----- | ---------------- | ---------------------------- | ------------------ |
| Earlier V7 low and medium | 60    | $0.050040        | $0.133000                    | $0.183040          |
| V8 low                    | 30    | $0.036028        | $0.007000                    | $0.043028          |
| V9 low                    | 30    | $0.035892        | $0.000000                    | $0.035892          |
| Cumulative                | 120   | $0.121960        | $0.140000                    | $0.261960          |

This turn added at most **$0.078920**, leaving at least **$0.738040** of the
existing $1 Luna allowance. No budget was reset or increased. Unknown usage
keeps its full $0.007 reservation; known costs use recorded tokens, not a
billing export. The expired Anthropic allowance remains separate and unchanged.

V8 recorded 331,602 input tokens and 5,713 output tokens across 29 known usage
records, including 3,935 reasoning tokens. V9 recorded 336,342 input and 4,483
output tokens across all 30 requests, including 2,653 reasoning tokens.
Reasoning is counted inside output once. All rates and token limits match
the original Luna comparison.

The runner now carries all three captures forward and verifies their hashes
and cumulative cost before future calls. Both temporary approvals and trigger
labels were removed after their runs. No further paid calls are scheduled.

## Evidence

- [V8 run, attempt 2](https://github.com/pursuit-capstone-fcny/ai-sprint-recommender/actions/runs/40545682960/attempts/2), source `ae1e85fdbf3445b45d0ad3f47d53d72e495c8de7`.
- [V8 capture](runs/40545682960-2/capture.json), [scoring and diagnostics](runs/40545682960-2/low.json), [generated summary](runs/40545682960-2/comparison.md).
- [V9 run, attempt 2](https://github.com/pursuit-capstone-fcny/ai-sprint-recommender/actions/runs/40547083724/attempts/2), source `6600a2e044bbc4a45045c876d8921cb2ffd61a6b`.
- [V9 capture](runs/40547083724-2/capture.json), [scoring and diagnostics](runs/40547083724-2/low.json), [generated summary](runs/40547083724-2/comparison.md).
- [Original comparison](../2026-10-26-luna/results.md) and [test plan](test-plan.md).

Saved reports reproduce exactly offline from captured responses. V8 passed
522 tests before dispatch; V9 passed 523. CI and preview passed on both source
commits. These are isolated provider comparisons with no deployment credentials,
not tests of a deployed Luna endpoint. The relevance gate remains unmet.
