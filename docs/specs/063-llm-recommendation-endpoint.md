## #63 Add a server endpoint for LLM recommendations

Owner:

Status: Approved

Date: Oct 19, 2026

Source: [Spec library](https://fcny-spec-library.jason-zeng94.chatgpt.site/#spec-63)

### Problem

- MVP recommendations need to interpret a person's goal beyond exact tags. The current SPA cannot safely hold a provider key, and ADRs 0001 and 0002 assume browser-only ranking and no new spend.

### Goal

- Provide a bounded server call that selects and ranks active catalog items for #43. Proposed home: a Cloudflare Worker alongside the existing SPA, using the trusted versioned static catalog from ADR 0004.
- MVP dependency: #9 catalog contract.

### Non-goals

- Chat history, embeddings, web search, tool execution or generated videos.
- Catalog writes or metadata generation, which remain in #51.

### Acceptance criteria

- AC-63.1 Deployment and ownership
  - Given the existing hosting decisions
  - When the service is enabled
  - Then the team has recorded the runtime change through #1, and #8 records FCNY's provider, model, permitted data, retention terms, account owner and budget approval. Credentials stay in server secrets; preview and production use separate configuration and budgets
- AC-63.2 Trusted inputs
  - Given a submitted description from #82, nullable function area and optional tools
  - When the endpoint accepts a request
  - Then it validates canonical values and a goal limit of 500 characters, reads the validated public catalog from #9 itself, and sends only those inputs and bounded public catalog fields to the provider. Browser-supplied catalog rows, URLs and prompts are never trusted
- AC-63.3 Catalog-grounded ranking
  - Given valid active catalog items
  - When the model receives the request
  - Then Haiku 5.5 low with thinking disabled uses `catalog-pick-evidence-v6` to assess all 89 complete public catalog items, cached as one prefix ahead of the request. It sets noWork first, then returns at most eight picks graded 3, 2 or 1, each with an exact description quote and a short rationale. A repeated pick keeps its first occurrence, a quote absent from that description drops the pick, and an out-of-range position or malformed output rejects the response. Order grade 3, then 2, then 1, each in emitted order; task tags only reorder picks within the first three. noWork or an empty list abstains; no provider tools, prefiltering or filler are used
- AC-63.4 Response validation
  - Given model output and the catalog snapshot used for the call
  - When the service builds its response
  - Then only distinct IDs from that snapshot survive validation; malformed JSON, unknown or retired IDs, duplicates and oversized output reject the entire model result. The response includes `catalogVersion`, model/prompt versions and a bounded outcome code; titles, descriptions and URLs come from the catalog
- AC-63.5 Bounded failure and cost
  - Given an anonymous endpoint, concurrent requests or provider errors
  - When traffic reaches configured limits
  - Then server-side input/output token, request-rate, concurrency and daily/monthly spend caps prevent further paid calls. Reserve estimated maximum call cost atomically before dispatch and reconcile actual usage. A missing limit, exhausted budget or kill switch returns fallback without calling the provider; one submission makes at most one provider call, with a 6.5-second server deadline inside the browser's 7-second limit and no paid retries
- AC-63.6 Privacy and diagnostics
  - Given successful, rejected or failed calls
  - When diagnostics are recorded
  - Then they contain outcome, latency, token/cost totals and catalog/model/prompt versions, never raw goals or prompt/response bodies. App session IDs and source tags are not sent to the provider; rate-limit identifiers are short-lived and excluded from analytics

### Open questions

Broad tool and role inquiries are valid discovery goals. Tool discovery requires
the requested tool in the video's own tags or description; broad role discovery
requires instruction for the role's work or a substantial useful component.
These inquiries admit only grade 3 or 2 picks and have no minimum count. They
must not be filled with weak contextual picks or generic nonprofit/AI material.
The model classifies its response with `goalType=discovery` or `goalType=task`.
The server rejects a missing classification and discards grade 1 discovery picks
before returning IDs. Task interpretation remains independent of the
deterministic engine.

- [ ] Approve the Worker proposal, provider/model, retention terms and concrete rate, token and spend limits. Include the cost of the live evaluation in #19.
- [ ] The engine requires all 89 catalog rows without truncation and explicit input/output limits sufficient for the prepared request, including its 2,000-token output maximum. Wrong catalog size or insufficient limits returns unavailable before dispatch. No budget is increased or enabled by this integration.

### Evidence required

- Test: mocked provider responses, untrusted text, invalid IDs, catalog-version mismatch, timeouts, concurrent budget reservations and zero paid calls when disabled.
- Log or metric: latency, fallback rate, tokens and estimated/actual spend by environment and version.
- Manual check: one deployed signed-out request, one forced failure, and inspection of the browser bundle and server logs for secret or goal leakage.
- Rollback signal: invalid picks, exposed data or unenforced limits; disable the server flag and keep the rules path available.

### Demo integration

The engine toggle keeps this endpoint independent of #102. An AI error or
abstention never invokes the deterministic engine. The published catalog
snapshot is trusted server input; browser-provided catalog rows are rejected.
Production paid calls and usage logging remain disabled. This PR does not
activate a test deployment or authorize additional spending.
