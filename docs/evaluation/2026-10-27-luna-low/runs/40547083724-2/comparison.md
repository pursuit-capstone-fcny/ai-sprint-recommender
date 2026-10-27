# GPT-6 Luna provider comparison

Source: `6600a2e044bbc4a45045c876d8921cb2ffd61a6b`. Workflow run 40547083724, attempt 2.

Fresh provider calls from an isolated runner, scored with the existing browser selector. This does not test the deployed endpoint or establish production readiness. The nested reports score saved responses and are explicitly ineligible for the deployed relevance gate.

The frozen benchmark, catalog, distinct-task gate and labels are unchanged. Prompt: catalog-rank-luna-v9. Efforts: low. Each uses standard mode, no prompt caching, 2,000 total output tokens including reasoning, a 4.5-second deadline and no retries.

| Effort | Trial passes     | Rules fallbacks | Median / p95 latency | Known token cost | Unknown maximum reservations |
| ------ | ---------------- | --------------- | -------------------- | ---------------- | ---------------------------- |
| low    | 3/10, 3/10, 3/10 | 7, 7, 7         | 2.448s / 3.702s      | $0.035892        | $0.000000                    |

This run: at most $0.035892. Prior runs: at most $0.226068. Cumulative: at most $0.261960 of the existing $1.00 allowance. Remaining: at least $0.738040. Unknown costs retain their full reservation. Token costs use $0.10/M input and $0.50/M output, including reasoning; they are not a billing export.

Production LLM calls and usage logging were not enabled. No Cloudflare or Apps Script deployment was performed.
