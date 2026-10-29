# GPT-6 Luna provider comparison

Source: `a35eefd6dbbaf7204397f3b9e2c92cac393ca5c2`. Workflow run 40794821513, attempt 2.

Fresh provider calls from an isolated runner, scored with the existing browser selector. This does not test the deployed endpoint or establish production readiness. The nested reports score saved responses and are explicitly ineligible for the deployed relevance gate.

The catalog includes the October 28 task-tag completion. Profile inputs, labels and the distinct-task gate are unchanged; earlier snapshots and results are preserved. Prompt: catalog-rank-v7. Efforts: low. Each uses standard mode, no prompt caching, 2,000 total output tokens including reasoning, a 4.5-second deadline and no retries.

| Effort | Trial passes     | Rules fallbacks | Median / p95 latency | Known token cost | Unknown maximum reservations |
| ------ | ---------------- | --------------- | -------------------- | ---------------- | ---------------------------- |
| low    | 6/10, 7/10, 7/10 | 0, 0, 1         | 2.211s / 3.668s      | $0.037900        | $0.000000                    |

This run: at most $0.037900. Prior runs: at most $0.261960. Cumulative: at most $0.299860 of the existing $1.00 allowance. Remaining: at least $0.700140. Unknown costs retain their full reservation. Token costs use $0.10/M input and $0.50/M output, including reasoning; they are not a billing export.

Production LLM calls and usage logging were not enabled. No Cloudflare or Apps Script deployment was performed.
