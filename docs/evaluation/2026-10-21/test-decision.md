# Initial Anthropic evaluation

Jason approved the proposed ten-profile benchmark and a $1 total test
allowance in the Codex chat on October 21, 2026. This approves the separate
test runtime, provider/data terms and bounded evaluation below. It does not
approve production enablement or substitute for Ali/Eliot's client review.

- Worker: `ai-sprint-recommender-llm-test`, isolated SQLite budget storage.
- Model: Anthropic `claude-haiku-5-5`; prompt/config `catalog-rank-v2`;
  thinking disabled and effort low.
- Inputs: synthetic goals, canonical areas/tools and the frozen public
  89-video catalog. No personal profiles or private Sheet columns.
- Limits: 60,000 input tokens, 512 output tokens, five seconds, no retries,
  two concurrent requests, 60 global/client requests per minute.
- Prices checked October 21: $0.10 per million input tokens below 100,000
  input tokens; $0.50 per million output tokens. Maximum reservation
  $0.006256 per request, or $0.18768 for thirty trials.
- Allowance: $1 total for the trials, held-out wording and bounded failure
  checks. Daily and monthly caps are both $1. Preserve spent/reserved budget
  storage across deployments; never clear it to repeat a trial.
- Provider retention: normally up to 30 days, subject to Anthropic's stated
  exceptions. This is not zero retention. Browser usage logging is disabled
  on this test site; diagnostic exports contain only bounded evaluation fields.

The benchmark labels were fixed before scoring and approved for this initial
evaluation from public metadata. Videos have not all been independently
watched. Ali or Eliot must still review semantic examples and weak profiles.
The original rules baseline passes 1/10 against the 8/10 target. A low score
is a finding, not permission to change the labels.

## Deployment and rollback

The label-triggered workflow accepts only same-repository PR #76. Applying
`deploy-llm-test` deploys the configured test site with paid calls disabled.
Applying `evaluate-llm-test` explicitly runs the approved evaluation after
checking the API secret and expiration. Ordinary CI never calls Anthropic.

The workflow disables provider calls after the run, including on failure.
The server also stops test calls at `2026-10-22T00:00:00Z`, before the monthly
budget can reset. Future live runs need renewed approval and an updated
expiration. `wrangler.evaluation.json` is disabled at rest and has no
production environment. Production deployment configuration is unchanged.

Never upload raw Wrangler tail events: they contain request metadata. Only
sanitized diagnostics joined to the evaluation's request IDs are evidence.
Do not modify the shared Sheet for empty/retired/injection failure fixtures.

## References

- [Haiku 5.5 model and pricing](https://platform.claude.com/docs/en/models/haiku-5-5/overview)
- [Thinking configuration](https://platform.claude.com/docs/en/build-with-claude/thinking-troubleshooting)
- [Anthropic API retention](https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data)
- [Approved spec #19](../../specs/019-recommendation-evaluation.md)
