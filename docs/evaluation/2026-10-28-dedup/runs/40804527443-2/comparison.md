# GPT-6 Luna provider comparison

Source: `ec0d3e330b7e6b6e06c9a5a58f230c56bc1b7566`. Workflow run 40804527443, attempt 2.

Fresh provider calls from an isolated runner, scored with the existing browser selector. This does not test the deployed endpoint or establish production readiness. The nested reports score saved responses and are explicitly ineligible for the deployed relevance gate.

The catalog includes the October 28 task-tag completion. Profile inputs, labels and the distinct-task gate are unchanged; earlier snapshots and results are preserved. Prompt: catalog-rank-v7. Efforts: low. Each uses standard mode, no prompt caching, 2,000 total output tokens including reasoning, a 4.5-second deadline and no retries.

| Effort | Trial passes     | Rules fallbacks | p50 / p95 latency | Known token cost | Unknown maximum reservations |
| ------ | ---------------- | --------------- | ----------------- | ---------------- | ---------------------------- |
| low    | 9/10, 9/10, 8/10 | 0, 0, 1         | 1.823s / 3.398s   | $0.037775        | $0.000000                    |

This run: at most $0.037775. Prior runs: at most $0.299860. Cumulative: at most $0.337635 of the existing $1.00 allowance. Remaining: at least $0.662365. Unknown costs retain their full reservation. Token costs use $0.10/M input and $0.50/M output, including reasoning; they are not a billing export.

Production LLM calls and usage logging were not enabled. No Cloudflare or Apps Script deployment was performed.
