# Change Proposal: Serve the catalog through Apps Script

Owner: Jason Zeng
Status: Draft
Date: 2026-10-12
Issue: #9

## Problem

- The app has no data source: picks must include only active Sprint videos (FR-007) and Sheet edits must reach the page without a redeploy (FR-008).
- Only whitelisted public fields may leave the Sheet (repo data rules), and invalid rows must surface somewhere Eliot can fix.

## Goal

- A stable Apps Script web app serves the catalog as JSON from two fixed deployment URLs (test, production); the page renders active videos from it, invalid rows land on a Problems tab, and production runs from FCNY's own Google account.

## Non-goals

- doPost usage-event logging (#16)
- Thumbnails and video-length enrichment (thumbnails derive from `youtubeId` in the page; length trigger is post-MVP, cf. #38)
- Direct uploads and transcripts (#51)
- Serving anything beyond whitelisted public fields

## Acceptance Criteria

- AC-9.1 Contract: Given a Sheet row with all required public fields, When parsed against the Zod schema in `src/contracts`, Then it yields a `CatalogItem`; Given a required field is missing or malformed, When parsed, Then it fails with a reason naming the field and row.
- AC-9.2 Active and whitelisted: Given archived rows and non-whitelisted columns exist in the Sheet, When `doGet` serves, Then only active rows and whitelisted fields appear in the JSON.
- AC-9.3 Facets: Given a new function-area or tool value in the Sheet, When the catalog is next served, Then the response's `functionAreas` and `tools` include it with no code change.
- AC-9.4 Problems tab: Given rows that fail the contract, When the script runs, Then each appears on the Problems tab with row number and reason; Given all rows are subsequently fixed, Then the tab clears.
- AC-9.5 Fixed deployments: Given clasp, When the script deploys, Then exactly two stable deployment IDs exist (test, production); Given `VITE_CATALOG_URL` selects the test deployment, When a Cloudflare preview loads, Then it reads test, never production.
- AC-9.6 Frozen fixture: Given `fixtures/catalog.json` holding public fields only, When the contract test runs, Then the fixture parses against the schema, and #11's tests reuse the same fixture.
- AC-9.7 Page states: Given the catalog request is loading or has failed, When the page renders, Then it shows a loading state or a friendly error with a retry that re-issues the request.

## Open Questions

- [ ] v1 field list: `id`, `title`, `youtubeId`, `url`, `functionArea`, `tasks`, `tools`, `addedAt` - anything missing that #11 or #14 needs?
- [ ] Row validation as portable JS in `apps-script/` (Vitest-tested), Sheet I/O and CacheService in a thin `.gs` adapter verified manually - acceptable split?
- [ ] CacheService TTL of five minutes fine?
- [ ] Does AC-9.7 ship here or move to #10/#14 UI work?

## Evidence Required

- Test: contract test on the frozen fixture plus row-validation unit tests, both in CI.
- Log or metric: Problems tab entries carry row number and reason per invalid row.
- Manual check: test deployment serves active-only JSON; a preview reads the test URL; production URL never serves unmerged code.
- Rollback signal: clasp redeploy of the previous version; the page's error state (AC-9.7) is the visible failure mode.
