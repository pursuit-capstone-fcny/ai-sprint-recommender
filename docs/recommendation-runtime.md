# Recommendation runtime

The normal deployment serves `POST /api/recommendations` with
`LLM_ENABLED=false`. It needs no provider key or Durable Object migration.
Production usage logging remains disabled in `.github/workflows/deploy.yml`.

The implementation supports Anthropic Messages with structured JSON output.
No provider or model is enabled by this change. Before live use, record the
runtime decision in #1 and the model, owner, permitted data, retention terms,
pricing and budgets in #8. #19 supplies the relevance evidence required before
production enablement. An API key alone is insufficient.

## Text-first discovery

Spec #82 starts discovery with a description of the learner's task, role,
organizational mission or learning need. The field accepts up to 500 characters.
Task, role and mission examples fill it and return keyboard focus to it without
submitting. Find videos and Enter use the same native form submission. Results
appear in one step, without an interview, login or saved profile.

Function area and tool selectors are optional, in a collapsed refinement
section. Its summary shows selected values so hidden refinements remain visible.
Keeping these selectors is provisional pending Ali and Eliot's decision through
#8. Example wording also needs client approval. Clear resets the description,
selectors and results to the initial state.

Submission preserves the existing recommendation paths. Standard matching
compares description words and synonyms with catalog tasks, titles and
descriptions; selected function areas and tools refine the existing ranking.
This is keyword matching and does not guarantee semantic understanding of roles
or missions. The separate deterministic prompt engine is not wired into this
flow. When AI suggestions are explicitly enabled for a remote catalog, the page
sends one bounded request to the existing endpoint, with the provider disclosure
shown before submission. Unavailable AI suggestions use standard matching.
Blank input with no refinements uses Start-here suggestions without a provider
call. Catalog loading and existing initial impressions are independent of search
submission; typing, selecting an example and changing refinements make no
recommendation requests or search events.

Raw descriptions remain in page memory and the disclosed recommendation request
only. They do not enter URLs, browser storage or usage analytics. A completed
submission creates one search context; usage events contain canonical dictionary
tasks and selected tags, never the learner's raw description. These changes do
not enable a provider, usage collection or a production deployment. #83 owns the
separate expanded-results policy.

## Haiku 5.5 test results

`catalog-rank-v7` puts the full catalog first in the
JSON user message, followed by `functionArea`, `goal` and `tools`. V5's system
prompt, catalog order and metadata, output schema and caps stay unchanged.
Haiku 5.5 keeps v6's medium effort with thinking disabled.

The [#19 evaluation report](https://github.com/pursuit-capstone-fcny/ai-sprint-recommender/blob/feat/19-recommendation-evaluation/docs/evaluation/2026-10-21/wording-timeout-rerun.md)
records run `39621407792`, source `5e54e23`: v7 scored **10/10 in all three
trials**, versus rules at 8/10, with no benchmark fallbacks. V6's medium-effort
change alone scored 7/10, 9/10 and 6/10. V7's wording probes scored Operations
3/3 in 1.520 seconds and Fundraising 2/3 in 1.466 seconds. Benchmark latency
was 1.409 seconds median, 2.228 p95 and 2.566 maximum; all 34 calls had complete
usage and cost diagnostics.

This supports catalog-first ordering on the existing test cases, not unseen
accuracy. Test and production LLM calls remain disabled after the run;
production usage logging remains disabled.

Anthropic's [long-context guidance](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#long-context-prompting)
recommends long data before the query for inputs over 20,000 tokens, checked
October 21, 2026. The previous measured input was 20,209 tokens; this guidance
motivated the ordering experiment.

V5 ranks the requested activity, output and audience or
counterparty ahead of general AI guidance. It keeps v4's slots, full catalog,
model and effort unchanged.

V4 retained v3's task and deliverable instructions and replaced the output
array with ten required nullable fields, `rank1` through
`rank10`, each constrained to a catalog position or null. This prevents the
12-selection outputs observed in both v3 diagnostic probes without truncating
results. The adapter preserves rank order and rejects missing/extra slots,
duplicates and out-of-range positions.

The prompt prioritizes help with the goal's task and deliverable over
broad area or tool overlap. It retains every catalog candidate and contains no
benchmark examples or expected IDs. The provider selects numeric positions;
the server maps them to IDs from that request's trusted catalog snapshot.
Duplicate, noninteger, out-of-range and oversized selections reject the whole
result without repair. The public API still returns `youtubeIds`.

Anthropic's [structured-output reference](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
supports numeric enums but does not guarantee string enum capitalization.
Numeric positions avoid copying case-sensitive YouTube IDs. A new schema can
add compilation latency on its first use; the 4.5-second server deadline still
applies, with no retry. The API does not support `maxItems` or uniqueness
constraints; ten required slots enforce the size bound and the adapter checks
uniqueness. Checked October 21, 2026.

Invalid provider results include bounded validation categories and counts in
test diagnostics only. Categories distinguish stop reason, content, JSON,
schema, duplicate and out-of-range failures; counts clamp at 100. They contain
no response text, IDs, prompts or intake, and never appear in the public API or
production diagnostics.

When `LLM_MODEL` is
`claude-haiku-5-5`, the adapter explicitly disables thinking and sets effort to
`medium`, keeping the output allowance available for ranked IDs. Unexpected
thinking blocks still reject the result. The browser's five-second limit is
unchanged.

Anthropic's [model page](https://platform.claude.com/docs/en/models/haiku-5-5/overview)
lists $0.10 input and $0.50 output per million tokens for prompts up to 100,000
tokens, checked October 21, 2026. The corresponding microdollar rates are
`100000` and `500000`. A test using those rates must cap input at 100,000 tokens
or less. Larger prompts use a higher price tier. These are candidate settings,
not approval to enable calls or spend. The
[thinking configuration reference](https://platform.claude.com/docs/en/build-with-claude/thinking-troubleshooting)
permits disabled thinking at effort `high` or below for this model.
The [effort reference](https://platform.claude.com/docs/en/build-with-claude/effort)
confirms that effort also applies when thinking is disabled. Medium can use
more tokens than low; the existing token, spend and deadline limits still apply.

## Request and response

The shared schema is `src/contracts/recommendation.ts`. Submit only canonical
`functionArea`, `tools`, optional text as `goal: ""` when blank, and the browser's
`catalogVersion`. The server fetches the shared published manifest and verifies its immutable catalog snapshot.
A successful response contains ranked `youtubeIds` and catalog/model/prompt
versions. Failure responses contain a bounded `reason`; the browser uses rules.
The `x-recommendation-request-id` response header joins a response to sanitized
diagnostics without using the app's session ID.

The server caches validated public catalog snapshots for up to 60 seconds in
Cloudflare's Cache API, keyed by trusted source URL and catalog version. A new
requested version fetches the source again; mismatches never dispatch a paid
call. Cache hits are validated again, and cache errors fall through to a fresh
fetch. An old requested version can use its cached snapshot for at most 60
seconds after it was stored, so source edits and retirements have that bounded
delay. Provider responses and intake text are never cached. The 4.5-second
server deadline also covers cache and source work, leaving 500ms for delivery
before the browser's five-second limit. This margin does not guarantee delivery.

Test deployments also serve `GET /api/catalog` while the LLM is disabled. Set
the test browser's `VITE_CATALOG_URL=/api/catalog` to load the trusted catalog
before submission. This unpaid route accepts no parameters and uses only the
validated `LIBRARY_ORIGIN`. It validates and stores latest and versioned
snapshots before returning the public envelope with `Cache-Control: no-store`.
Its nine-second deadline stays below the browser catalog loader's ten seconds.
It returns 504 on timeout and generic 503 on source/configuration failures;
production and unconfigured deployments return 404.

Recommendation cache writes run through
[`waitUntil`](https://developers.cloudflare.com/workers/runtime-apis/context/#waituntil)
without delaying the recommendation response. Catalog GET waits for the writes
so the following submission can use the validated version. Cache failures
still permit a fresh fetch. No background refresh or longer TTL is introduced.

The [Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/)
stores responses within a data center and honors response `Cache-Control` TTL.
Cache availability and hits must be checked on the deployed test hostname.
Load `GET /api/catalog` before each trial and separate probe, then use an
actual-version request with an invalid canonical area to verify a fast cache
hit without a provider call. A fabricated version always forces another source
fetch. Idle time beyond 60 seconds, eviction or a different data center can
still cause a cold recommendation fetch and fallback. Provider and network
timeouts also remain possible.

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
| `LIBRARY_ORIGIN`                                                            | Published HTTPS catalog origin, without a path            |
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
4.5 seconds and aborts the provider connection; abort does not prove that the
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
