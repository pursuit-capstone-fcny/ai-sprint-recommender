## #63 Add a server endpoint for LLM recommendations

Owner:

Status: Approved

Date: Oct 19, 2026

Source: [Spec library](https://fcny-spec-library.jason-zeng94.chatgpt.site/#spec-63)

### Problem

- MVP recommendations need to interpret a person's goal beyond exact tags. The current SPA cannot safely hold a provider key, and ADRs 0001 and 0002 assume browser-only ranking and no new spend.

### Goal

- Provide a bounded server call that selects and ranks active catalog items for #43. Proposed home: a Cloudflare Worker alongside the existing SPA, with Apps Script remaining the catalog source.
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
  - Then it returns structured JSON containing up to 10 distinct `youtubeId` values in recommendation order, or an empty list for no relevant picks. The prompt prioritizes function area, task fit and tool fit, and treats goals and catalog text as untrusted data. No provider tools are enabled
- AC-63.4 Response validation
  - Given model output and the catalog snapshot used for the call
  - When the service builds its response
  - Then only distinct IDs from that snapshot survive validation; malformed JSON, unknown or retired IDs, duplicates and oversized output reject the entire model result. The response includes `catalogVersion`, model/prompt versions and a bounded outcome code; titles, descriptions and URLs come from the catalog
- AC-63.5 Bounded failure and cost
  - Given an anonymous endpoint, concurrent requests or provider errors
  - When traffic reaches configured limits
  - Then server-side input/output token, request-rate, concurrency and daily/monthly spend caps prevent further paid calls. Reserve estimated maximum call cost atomically before dispatch and reconcile actual usage. A missing limit, exhausted budget or kill switch returns fallback without calling the provider; one submission makes at most one provider call, with a 4.5-second server deadline inside the browser's five-second limit and no paid retries
- AC-63.6 Privacy and diagnostics
  - Given successful, rejected or failed calls
  - When diagnostics are recorded
  - Then they contain outcome, latency, token/cost totals and catalog/model/prompt versions, never raw goals or prompt/response bodies. App session IDs and source tags are not sent to the provider; rate-limit identifiers are short-lived and excluded from analytics

### Open questions

- [ ] Approve the Worker proposal, provider/model, retention terms and concrete rate, token and spend limits. Include the cost of the live evaluation in #19.
- [ ] Proposed candidate policy: include the full valid catalog with capped descriptions when it fits the input budget. On overflow, use the rules fallback until an explicit shortlist policy passes #19; never silently truncate the catalog.

### Evidence required

- Test: mocked provider responses, untrusted text, invalid IDs, catalog-version mismatch, timeouts, concurrent budget reservations and zero paid calls when disabled.
- Log or metric: latency, fallback rate, tokens and estimated/actual spend by environment and version.
- Manual check: one deployed signed-out request, one forced failure, and inspection of the browser bundle and server logs for secret or goal leakage.
- Rollback signal: invalid picks, exposed data or unenforced limits; disable the server flag and keep the rules path available.
