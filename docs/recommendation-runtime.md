# Recommendation runtime

The normal deployment serves `POST /api/recommendations` with
`LLM_ENABLED=false`. It needs no provider key or Durable Object migration.
Production usage logging remains disabled in `.github/workflows/deploy.yml`.

The implementation supports Anthropic Messages with structured JSON output.
No provider or model is enabled by this change. Before live use, record the
runtime decision in #1 and the model, owner, permitted data, retention terms,
pricing and budgets in #8. #19 supplies the relevance evidence required before
production enablement. An API key alone is insufficient.

## Haiku 5.5 test candidate

`catalog-rank-v2` records the Haiku 5.5 request settings. When `LLM_MODEL` is
`claude-haiku-5-5`, the adapter explicitly disables thinking and sets effort to
`low`, keeping the output allowance available for ranked IDs. Unexpected
thinking blocks still reject the result. The five-second deadline is unchanged.

Anthropic's [model page](https://platform.claude.com/docs/en/models/haiku-5-5/overview)
lists $0.10 input and $0.50 output per million tokens for prompts up to 100,000
tokens, checked October 21, 2026. The corresponding microdollar rates are
`100000` and `500000`. A test using those rates must cap input at 100,000 tokens
or less. Larger prompts use a higher price tier. These are candidate settings,
not approval to enable calls or spend. The
[thinking configuration reference](https://platform.claude.com/docs/en/build-with-claude/thinking-troubleshooting)
permits disabled thinking at effort `high` or below for this model.

## Request and response

The shared schema is `src/contracts/recommendation.ts`. Submit only canonical
`functionArea`, `tools`, optional text as `goal: ""` when blank, and the browser's
`catalogVersion`. The server fetches Apps Script's validated public catalog.
A successful response contains ranked `youtubeIds` and catalog/model/prompt
versions. Failure responses contain a bounded `reason`; the browser uses rules.
The `x-recommendation-request-id` response header joins a response to sanitized
diagnostics without using the app's session ID.

## Separate runtime configuration

`wrangler.recommendations.jsonc` is an opt-in configuration, excluded from the
normal CI deployment. It defines separate Workers and SQLite Durable Object
namespaces:

| Target               | Worker name                            | Environment  |
| -------------------- | -------------------------------------- | ------------ |
| Test                 | `ai-sprint-recommender-llm-test`       | `test`       |
| Production candidate | `ai-sprint-recommender-llm-production` | `production` |

Both start disabled. The production candidate does not replace the current
production site. After approval, deploy the test runtime with
`pnpm exec wrangler deploy --config wrangler.recommendations.jsonc`; lifecycle
changes require `deploy`, not `versions upload`. Review the candidate and the
normal site's deployment workflow together before a production cutover.
Never point test bindings or credentials at the production namespace.

Configure each environment independently. Do not copy an enabled test file
into production. Set server secrets with Wrangler's secret command using the
same config and environment selection:

- `ANTHROPIC_API_KEY`: the approved FCNY account's credential.
- `LLM_RATE_KEY`: a random secret of at least 32 characters for minute-scoped
  HMAC rate identifiers. Raw IPs are not stored or logged.

Required nonsecret settings have no live defaults:

For a time-limited test, set optional `LLM_TEST_EXPIRES_AT` to a UTC ISO
timestamp. When present, an invalid or elapsed value disables calls before
network access and is checked again before paid dispatch. Omission preserves
the other gates. Production ignores this test-only setting. Keep the test
monthly cap equal to the total approved allowance and expire the test before
the next UTC month; a failed cleanup cannot reopen that allowance after reset.

| Variable                                                                    | Meaning                                                   |
| --------------------------------------------------------------------------- | --------------------------------------------------------- |
| `LLM_ENABLED`                                                               | Kill switch, exactly `true` to permit calls               |
| `LLM_APPROVALS_RECORDED`                                                    | Exactly `true` only after #1/#8 decisions exist           |
| `LLM_ENVIRONMENT`                                                           | `test` or `production`, also isolates the budget object   |
| `LLM_MODEL`                                                                 | Approved Anthropic model that supports structured outputs |
| `LLM_CATALOG_URL`                                                           | Trusted Apps Script `/exec` deployment                    |
| `LLM_MAX_INPUT_TOKENS`, `LLM_MAX_OUTPUT_TOKENS`                             | Positive token caps                                       |
| `LLM_REQUESTS_PER_MINUTE`, `LLM_CLIENT_REQUESTS_PER_MINUTE`                 | Global and client limits                                  |
| `LLM_MAX_CONCURRENCY`                                                       | Maximum outstanding provider reservations                 |
| `LLM_DAILY_MICRODOLLARS`, `LLM_MONTHLY_MICRODOLLARS`                        | USD spend caps, 1 dollar = 1,000,000 microdollars         |
| `LLM_INPUT_MICRODOLLARS_PER_MILLION`, `LLM_OUTPUT_MICRODOLLARS_PER_MILLION` | Approved model prices in microdollars per million tokens  |
| `LLM_DIAGNOSTICS_ENABLED`                                                   | Opt-in sanitized console diagnostics, off by default      |

Recheck prices and token behavior for the exact model before enabling it. The
input gate uses the UTF-8 byte length of the complete provider request plus
4,096 tokens of framing allowance. This deliberately overestimates visible
text tokens and includes the schema, system prompt and every candidate. Validate
the allowance against the approved model's accounting during test evaluation;
if the full catalog does not fit, increase an approved cap or keep rules active.
No extra token-count API call or paid retry is made.

## Spend and failure handling

One Durable Object per environment serializes storage transactions. Each
reservation charges the configured maximum input and output cost before the
provider receives a request. Prices and arithmetic must fit safe integers.
Valid provider usage reconciles the charge even when output JSON is invalid.
A disconnected, timed-out or unreadable response can still be billed, so it
retains the entire reservation. Settlement is idempotent. A failed settlement
also leaves the conservative charge in place.

A reservation holds concurrency for up to 60 seconds when its outcome is
unknown. Expiry releases concurrency, never the charge. The server returns by
five seconds and aborts the provider connection; abort does not prove that the
provider stopped processing or billing. Configure conservative budgets for
this possibility. Rate identifiers are re-keyed each minute and cleared by a
Durable Object alarm, including when traffic stops.

Diagnostics contain `requestId`, `environment`, `outcome`, `latencyMs`, optional
`inputTokens`, `outputTokens`, `costMicrodollars`, `reservedMicrodollars`,
`catalogVersion`, `modelVersion` and `promptVersion`. Missing actual usage means
unknown cost, not zero. #19 reports must count these calls as incomplete or
fallbacks. Do not enable HTTP request-body logging or add goals to error logs.

Rollback is `LLM_ENABLED=false` plus the browser's rules switch. Do not delete
budget storage to clear a cap or retry an uncertain billed request. Before a
paid test, verify the signed-out disabled endpoint, force a mocked failure,
inspect bundle/log privacy, then approve the explicit test-call allowance.

## API references checked

- [Anthropic structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
- [Cloudflare static asset bindings](https://developers.cloudflare.com/workers/static-assets/binding/)
- [Durable Object SQLite storage transactions](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)
- [Durable Object limits and free-plan SQLite support](https://developers.cloudflare.com/durable-objects/platform/limits/)
- [Durable Object deployment lifecycle](https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/)
