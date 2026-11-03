# Spec: Production analytics and LLM enablement

- **Issue:** User request, November 2, 2026
- **PR:** #114
- **Status:** in review

Jason requested live production analytics, paid LLM calls, and screenshots of
sample prompts and outputs for Deterministic and Haiku AI. Jason specified $5
for LLM spending. This deployment uses a $5 monthly cap and a $1 daily cap.
Keep the existing collector's one-day retention, hourly purge, 20 events/minute
and 1,000-row caps. Jason separately approved increasing its daily cap from
100 to 1,000 events for live collection and sample runs.
This is the owner's production enablement request; it does not claim additional
client review or a new relevance evaluation.

## Acceptance criteria

### AC-PROD-1: Explicit environment-specific analytics

- **Given** the owner enables production collection and supplies its endpoint
- **When** the live app records searches, impressions and clicks
- **Then** it delivers the existing strict tag-only event schema to that endpoint.
  Production never falls back to the test endpoint. Disabled, missing, invalid
  or fictional-catalog configurations send no events. Raw goals remain excluded.

### AC-PROD-2: Bounded live Haiku calls

- **Given** the owner enables production Haiku with existing server credentials
- **When** a learner submits a Haiku goal
- **Then** the same-origin Worker uses `claude-haiku-5-5` and
  `catalog-pick-evidence-v9`, the complete public catalog, and its strict
  response checks. A production-specific Durable Object enforces the
  $5 monthly and $1 daily caps, 10 global and 3 client requests per minute,
  concurrency 2, 80,000 conservative input tokens and 16,384 output tokens. The
  current complete-catalog request measures 65,270 under that input bound, and
  the request asks for at most 2,000 output tokens.
  No paid retry or
  deterministic substitution is added. Diagnostics omit prompt/response bodies.

### AC-PROD-3: Deployment and rollback

- **Given** existing GitHub-hosted Cloudflare and Anthropic secrets
- **When** the production workflow runs
- **Then** secrets stay server-side, existing rate keys and budget storage remain,
  and independent repository variables control LLM and usage enablement.
  Disabling those variables and redeploying stops the corresponding feature.

### AC-PROD-4: Production evidence

- **Given** the live deployment
- **When** synthetic sample goals run through both engines
- **Then** screenshots record the prompts and actual outputs, and accepted
  collector receipts and a private dashboard read establish analytics delivery.
  An error or abstention is reported as such rather than described as success.

### AC-PROD-5: Recommendation recovery

- **Given** Jason's November 2 request to repair both live engines
- **When** the tested recovery branch is deployed with `LLM_PRODUCTION_ENABLED=true`
- **Then** the exact intake placeholder and a broad "Copilot" query produce
  actual matches through each selected engine on production. Record the deployed
  commit, build/runtime enablement and observed outcomes. Keep the existing
  budget, secret storage, usage configuration and no-retry policy.
