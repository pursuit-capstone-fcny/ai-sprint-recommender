## #9 Serve the catalog through Apps Script

Owner:

Status: Approved

Date: Oct 19, 2026

Source: [Spec library](https://fcny-spec-library.jason-zeng94.chatgpt.site/#spec-9)

### Problem

- The page needs the catalog as JSON, only active Sprint videos may be recommended (FR-007), and a Sheet edit must reach the page without a redeploy (FR-008).
- Reading the Sheet directly would expose every column, including private ones.

### Goal

- An Apps Script web app bound to the Sheet serves whitelisted public fields as JSON, and the page validates every row against a shared catalog contract.

### Non-goals

- Ranking; that's #11.
- Usage logging (`doPost`); that's #16.
- Writing to the catalog from the page.

### Acceptance criteria

- AC-9.1 Catalog contract
  - Given Sheet rows and the Zod schema in `src/contracts`
  - When the shared parser validates them on the server and page
  - Then valid rows load; invalid rows are skipped with field and row reasons. All rows with a duplicated `youtubeId` are excluded, and no private cell values enter diagnostics
- AC-9.2 Active and public only
  - Given the Sheet has active and retired rows, and private columns
  - When a client calls `doGet`
  - Then the JSON holds active rows only, with whitelisted fields only
- AC-9.3 Lists and matching config
  - Given the dictionary and mapping tabs in #4 and #6
  - When the catalog is served
  - Then a response contains `schemaVersion`, `items`, `functionAreas`, `tools`, `tasks`, `synonyms`, `adjacentTools` and a `catalogVersion` for that snapshot; all use canonical values, including tools with no videos
- AC-9.4 Problems tab
  - Given invalid catalog rows or mapping rows
  - When validation refreshes
  - Then Problems lists tab, row and reason once, removes resolved entries, and reports invalid rows even when retired; concurrent requests do not duplicate or erase newer diagnostics
- AC-9.5 Isolated fixed deployments
  - Given clasp deploys the script
  - When code changes
  - Then test and production each retain a fixed deployment ID in separate bound projects and Sheets, with separate Script Properties and logs; previews use test, and production is deployed by FCNY
- AC-9.6 Frozen fixture
  - Given a sanitized catalog fixture in the repo
  - When the contract test runs in CI
  - Then the fixture passes, and the engine tests in #11 use the same fixture
- AC-9.7 Loading and failure
  - Given a slow request, invalid response or empty catalog
  - When the page loads
  - Then loading ends within 10 seconds with a retry on failure; a valid empty catalog shows "No videos available", distinct from a network error
- AC-9.8 Freshness and browser access
  - Given a valid Sheet edit and a signed-out browser on production or preview
  - When the page refreshes after at most five minutes
  - Then GET follows redirects and returns readable JSON reflecting the edit; #16 POST also works from that origin, or the tested ADR-0002 proxy fallback is used

### Open questions

- [ ] Approve this contract and record it in the unfinished `docs/glossary.md` before implementation: `youtubeId`, nonblank `title` and `description`, `functionAreas`, `tasks`, `tools`, `addedAt`, `lengthSeconds`, `status`, `startHere`. URLs derive from `youtubeId`; no separate item ID.
- [ ] Proposed types: YouTube ID is 11 URL-safe characters; tag arrays may be empty; `addedAt` is an ISO upload date or `null`; `lengthSeconds` is a positive integer or `null`; `status` is active/retired; `startHere` is boolean. Unknown dates sort last and unknown lengths are labeled on cards.
- [ ] Use one Zod parser bundled for Apps Script and imported by the page, with Sheet I/O in a thin adapter. Zod and clasp still need adding to the repo.
- [ ] Has FCNY confirmed anonymous web-app access and approved every served field for public access, including video IDs (#8)?

### Evidence required

- Test: frozen fixture plus synthetic cases for duplicate IDs, private-column exclusion, bad types, empty tags, unknown metadata and mappings; server/page parsing agrees
- Log or metric: Problems tab row count; `doGet` response time
- Manual check: signed-out GET/POST from preview and production; edit and retire test rows, then reload within the cache window; verify preview writes never reach production
- Rollback signal: the page shows the error state, or private fields appear in the response; roll the deployment back to the previous version
