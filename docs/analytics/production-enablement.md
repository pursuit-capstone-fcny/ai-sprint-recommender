# Production enablement, November 2, 2026

Jason requested live analytics and LLM calls and approved a $5 LLM allowance.
The production configuration uses a $5 monthly cap and a $1 daily cap. Jason
separately approved increasing the collector's daily limit to 1,000 events.

## Live configuration

- App: [production video finder](https://ai-sprint-recommender.jason-zeng151.workers.dev/).
- Source: `0684efb41be40deb912f8a790860084230ac2b79`.
- [Successful deployment](https://github.com/pursuit-capstone-fcny/ai-sprint-recommender/actions/runs/41508426953).
- Worker version: `e52f6e30-59fb-456e-97fb-6a5ceb65b3d2`.
- `LLM_PRODUCTION_ENABLED=true` and `USAGE_PRODUCTION_ENABLED=true`.
- Model/prompt: `claude-haiku-5-5` / `catalog-score-evidence-v1`, low effort,
  thinking disabled, all 89 public catalog items, one call per submission.
- Limits: 80,000 conservative input tokens, 16,384 output tokens, 10 global and
  3 client requests/minute, concurrency 2. Maximum reservation is $0.016192.
- Pricing: $0.10 input / $0.50 output per million tokens, verified against
  [Anthropic's model documentation](https://platform.claude.com/docs/en/models/haiku-5-5/overview).
- Collector: the existing `CATALOG_PRODUCTION_URL`, currently the same private
  collector used by previews. It has one-day retention, hourly cleanup,
  20 events/minute, 1,000 events/day and 1,000 retained rows. Its model/prompt
  allowlist includes the pair above. No file-sharing settings were changed.

## Verification

Typecheck, lint, 979 tests, all builds, dependency audit, format check and secret
scan pass. The Cloudflare preview and production deployment pass. The actual
local Cloudflare runtime loads all 89 public catalog items. Production keeps
the Durable Object export in previews, serializes version updates, preserves
existing secrets, and uses supported cache and redirect options. Redirects are
rejected without forwarding the provider credential to another destination.

The synthetic spreadsheet prompt returned three deterministic videos. A real
embed click on `1yBNcKEISP0` appeared in the private usage Sheet with engine
`rules`, source `team`, rank 1 and the published catalog version. The refreshed
private dashboard showed 16 appearances and one embed click when team traffic
was included. These are observed totals, not a count of this test alone.

The synthetic grant/RFP API sample succeeded in 26.4 seconds, returning
`rjaMvND2IRU`, `ShikWPoBRac`, `6EWc3MgRNFg`, and `VQRVNYS1m3g` with the expected
model, prompt and catalog versions. An earlier browser spreadsheet Haiku request
displayed unavailable; that output was captured and is not counted as success.
The subsequent browser grant/RFP submission displayed seven videos, and a
separate spreadsheet submission displayed five Haiku videos. The matching
deterministic submissions displayed zero and three videos respectively.
An accepted Haiku impression was verified in the private usage Sheet with
`recommendationEngine=llm`, `llmFallbackReason=none` and the exact model/prompt
pair above. The four prompt/output screenshots and the earlier unavailable
capture are saved locally with the production enablement artifacts.
This is deployment evidence, not a new client-approved relevance evaluation.

## Rollback and review

Set either production enablement variable to `false` and rerun the production
workflow to stop that feature. Keep the budget storage and collector cleanup.
Secret rotation is separate from routine deployment.

[PR #114](https://github.com/pursuit-capstone-fcny/ai-sprint-recommender/pull/114)
requires human review before merge. This authorized rollout was dispatched from
its feature branch. Until merged, an old-main deployment can disable the newly
enabled features and may fail to preserve the budget class export.
