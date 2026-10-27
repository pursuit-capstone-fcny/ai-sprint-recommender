# GPT-6 Luna provider comparison

Source: `f78fd92f34dd81afb2b0df5be39f7334af744f5e`. Workflow run 40445851804, attempt 2.

Fresh provider calls from an isolated runner, scored with the existing browser selector. This does not test the deployed endpoint or establish production readiness. The nested reports score saved responses and are explicitly ineligible for the deployed relevance gate.

The frozen benchmark, catalog, prompt, distinct-task gate and labels are unchanged. Both efforts use standard mode, no prompt caching, 2,000 total output tokens including reasoning, a 4.5-second deadline and no retries.

| Effort | Trial passes     | Rules fallbacks | Median / p95 latency | Known token cost | Unknown maximum reservations |
| ------ | ---------------- | --------------- | -------------------- | ---------------- | ---------------------------- |
| low    | 4/10, 5/10, 3/10 | 6, 5, 7         | 1.342s / 2.971s      | $0.034567        | $0.007000                    |
| medium | 0/10, 1/10, 0/10 | 10, 9, 10       | 4.500s / 4.502s      | $0.015473        | $0.126000                    |

Conservative total: $0.183040 of the new $1.00 allowance. Unknown costs retain their full reservation. Token costs use $0.10/M input and $0.50/M output, including reasoning; they are not a billing export.

Production LLM calls and usage logging were not enabled. No Cloudflare or Apps Script deployment was performed.
