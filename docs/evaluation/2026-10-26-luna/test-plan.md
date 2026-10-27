# GPT-6 Luna comparison

Jason approved GPT-6 Luna at low and medium effort and a new $1 total test
allowance in the October 26 Codex chat. This allowance is separate from the
expired Anthropic allowance. Neither its ledger nor its historical evidence
is reset. Production LLM calls and usage logging remain disabled.

## Fixed comparison

- Use the unchanged October 21 benchmark and all 89 public catalog items.
  Fingerprint: `4ab7cb1d8eaa76b1e79d0b3f0fe675740bce9da4076be8a86d63f36fda519dde`.
- Use the existing `catalog-rank-v7` instructions, catalog ordering, schema
  and browser selection code, including the distinct-task gate. Labels never
  enter the provider request.
- Run three independent ten-profile trials per effort, 60 requests total.
  Interleave low and medium for each profile and reverse order in trial two.
- Use `gpt-6-luna`, standard mode and standard service tier through Responses.
  Explicit caching with no breakpoints disables caching and cache-write fees.
  Disable response storage. Send only synthetic inputs and public metadata.
- Limit requests to 4.5 seconds, no retries, 60,000 conservatively bounded
  input tokens and 2,000 total output tokens, including reasoning. This output
  ceiling differs from Haiku's 512 because Luna uses reasoning tokens.
- Reserve $0.007 before every dispatch. Sixty maximum reservations total
  $0.42. Known usage settles at $0.10/M input and $0.50/M output; an unknown
  request retains the full reservation. Missing usage is never counted as zero.
- Stop on expiry, allowance exhaustion, HTTP/access errors or a model/usage
  mismatch. Save partial evidence after every request. Do not retry a failed
  workflow attempt under the same approval.

## Execution and evidence

An isolated GitHub runner calls OpenAI directly. No Cloudflare, Apps Script,
production configuration or deployment credentials are involved. This is a
provider comparison, not verification of the deployed recommendation endpoint.
Saved outputs use the existing evaluator; reports remain ineligible for the
fresh deployed relevance gate. Fresh provider capture records exact source,
workflow run/attempt, model, effort, timestamps, request IDs and usage.

The `compare-luna-test` label on PR #76 starts the dedicated workflow. It
fails closed until the `OPENAI_API_KEY` secret and external
`LUNA_EVALUATION_APPROVAL` Actions variable exist. Approval binds one clean
source revision, one workflow run/attempt, the frozen benchmark, both efforts,
the $1 cap and a short expiry. A repeated invocation in the same job is also
rejected. After execution, remove the label and approval variable.

Compare per-trial pass counts and fallbacks, selected IDs, variation,
median/p95 latency, reasoning tokens, known token costs and unknown maximum
reservations. Preserve the historical Haiku reports and its corrected 3/10
replay baseline. No result automatically enables production.

References checked October 26: [Luna model](https://developers.openai.com/api/docs/models/gpt-6-luna),
[pricing](https://developers.openai.com/api/docs/pricing),
[reasoning](https://developers.openai.com/api/docs/guides/reasoning),
[structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs),
[prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching).
