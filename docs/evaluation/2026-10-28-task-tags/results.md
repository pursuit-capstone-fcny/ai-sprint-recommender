# Luna low after completing task tags

All 89 live catalog videos now have task tags. Luna low improves from
**4/10, 5/10, 3/10** to **6/10, 7/10, 7/10**, but still misses the required
8/10 in every trial. The rules baseline declines from **8/10 to 5/10**.
No production LLM calls or usage logging were enabled.

## Provenance and scope

[Workflow 40794821513, attempt 2](https://github.com/pursuit-capstone-fcny/ai-sprint-recommender/actions/runs/40794821513)
ran on `a35eefd6dbbaf7204397f3b9e2c92cac393ca5c2`, October 28 in New York
(October 29 UTC). It made exactly 30 fresh `gpt-6-luna` low-effort calls,
standard mode, original `catalog-rank-v7` prompt, 4.5-second deadline,
2,000 output tokens including reasoning, no caching and no retries.

The [plan](test-plan.md), [catalog revision](benchmark.json) and
[79 evidence-backed tag additions](task-tags.json) were committed before calls.
Profiles, ideal/good labels, reasons and the task-diversity gate are unchanged.
The original catalog and historical reports are preserved. This comparison
includes a catalog revision and fresh sampling; it is not a prompt improvement
or a controlled estimate of metadata's causal effect.

## Scores

| Measure                   | Original V7 low  | Tagged-catalog V7 low |
| ------------------------- | ---------------- | --------------------- |
| Trial passes              | 4/10, 5/10, 3/10 | 6/10, 7/10, 7/10      |
| Rules fallbacks per trial | 6, 5, 7          | 0, 0, 1               |
| Task-diversity fallbacks  | 17               | 0                     |
| Provider timeouts         | 1                | 0                     |
| Invalid responses         | 0                | 1                     |
| Rules baseline            | 8/10             | 5/10                  |
| Median latency            | 1.357 s          | 2.299 s               |
| p95 latency               | 2.971 s          | 3.668 s               |

The generated comparison uses nearest-rank p50 (2.211 s); the conventional
median above averages the two middle observations. Latency is provider-runner
latency, not browser end-to-end latency. All 30 calls returned measured usage;
the one invalid response is operations-01, trial 3, and counts as a fallback,
not an LLM pass. No raw reasoning or provider response text was retained.

Hits among the first three displayed cards (two hits pass; `F` denotes rules
fallback and cannot count as an LLM pass):

| Profile           | Original trial hits | Tagged trial hits | Rules hits before → after |
| ----------------- | ------------------- | ----------------- | ------------------------- |
| leadership-01     | 2 F / 2 / 2         | 2 / 2 / 2         | 2 → 2                     |
| leadership-02     | 3 / 3 / 3 F         | 2 / 2 / 2         | 3 → 2                     |
| operations-01     | 2 F / 2 F / 2 F     | 1 / 1 / 1 F       | 2 → 1                     |
| operations-02     | 2 / 2 / 2           | 1 / 1 / 1         | 2 → 1                     |
| programs-01       | 2 F / 2 F / 2 F     | 2 / 2 / 2         | 2 → 2                     |
| programs-02       | 2 F / 2 F / 2 F     | 2 / 2 / 2         | 2 → 2                     |
| communications-01 | 3 / 3 / 3           | 3 / 3 / 3         | 1 → 1                     |
| communications-02 | 3 / 3 / 2 F         | 1 / 1 / 1         | 2 → 1                     |
| fundraising-01    | 3 F / 3 F / 3 F     | 2 / 2 / 2         | 3 → 2                     |
| fundraising-02    | 0 F / 0 F / 0 F     | 1 / 2 / 2         | 0 → 0                     |

## Remaining failures

The new task metadata exposes a conflict between the frozen labels and the
existing one-video-per-primary-task selection rule. Do not relabel, split a
single activity into artificial tags, or weaken that rule to raise the score.

- **Survey analysis (operations-01):** all three labeled videos genuinely share
  `survey analysis`. In trials 1 and 2 Luna ranks all three first, but the selector
  keeps one and promotes a chart video. With only two distinct tasks in those
  responses, it displays two cards. Only one matches a frozen label.
- **Board slides (communications-02):** all three labels share
  `presentation creation`. Luna ranks them first in every trial. The selector
  retains one and promotes strategic-planning and document-writing videos;
  the displayed score is one hit. These two profiles cannot reach two hits
  under the current labels, tags and selection rule, so the overall attainable
  ceiling is 8/10. That does not change the pass threshold.
- **Internal FAQ (operations-02):** the two direct FAQ labels now correctly share
  `internal FAQ`. Both are ranked first and second, but the second is demoted.
  The distinct-task fundraising assistant label appears only in trial 2, ranked
  fifth behind broader document tools. Every displayed result has one hit.
- **Funder preparation (fundraising-02):** trial 1 puts grantee assessment eighth,
  below grant-application writing; later trials put it third and pass. This is
  a remaining ranking inconsistency, separate from the tag/label conflict.

The rules score also needs attention: completing tags activates deduplication
for previously untagged videos and changes canonical task matching. Survey,
FAQ, social-copy and slide-deck profiles now have one hit each; funder practice
has none. Both rules and LLM use the unchanged shared selector. Tag coverage
alone has not established production recommendation quality.

## Budget and artifacts

This run used 352,932 input tokens and 5,194 output tokens, of which 3,362 were
reasoning tokens already included in output. Per-request rounded token cost is
**$0.037900**, averaging **$0.001263 per call**. No new unknown reservations.
Rates remain $0.10/M input and $0.50/M output from the
[official model release](https://developers.openai.com/api/docs/changelog#sep-22).
These estimates are not a billing export.

Across all four Luna runs: **$0.159860 known + $0.140000 unknown maximum
reservations = at most $0.299860**. At least **$0.700140** remains of the original
$1 allowance. The expired Anthropic allowance and its historical ledger are
separate and unchanged. One-time approval and trigger label were removed;
no additional paid run is scheduled.

Saved [capture](runs/40794821513-2/capture.json),
[approval](runs/40794821513-2/started.json),
[scored responses](runs/40794821513-2/low.json) and
[workflow summary](runs/40794821513-2/comparison.md) preserve the fresh results.
The nested evaluation is marked replay because it scores captured provider
responses; it is not evidence from a deployed Luna endpoint.

The public catalog GET matches all 79 task edits and 61 dictionary additions;
all non-task fields and the original ten tagged items match the prior snapshot.
The production page still loads 89 videos. Production remains on static commit
`cc761a7113aba4ddb8bab3ba17f2daba35cdccfa`; its workflow hard-codes usage off.
No Cloudflare or Apps Script deployment was made. The tagged snapshot, unchanged
labels and metadata-only diff have regression coverage; all 525 tests, typecheck,
lint, build and formatting pass. Historical evidence is not overwritten.

#19 remains open for catalog/label and semantic review, unseen wording checks,
fresh deployed-endpoint trials, client approval and the #23 demo evidence.
