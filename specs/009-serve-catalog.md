# Spec: Serve the catalog through Apps Script

- **Issue:** #9
- **PR:** TBD
- **Status:** draft, pending Jason's review
- **Depends on:** #5 (catalog Sheet), #6 (synonym table, for the facet lists)

## Acceptance criteria

Each criterion maps to an issue AC. Anything marked **[proposed]** adds
detail the issue left open; strike it in review if you disagree.

### AC-9.1: Catalog contract (Zod schema in `src/contracts`)

- **Given** a Sheet row with all required public fields present and well-formed,
- **When** the row is parsed against the catalog contract,
- **Then** it produces a `CatalogItem` with exactly the whitelisted fields.

- **Given** a row missing a required field, or with a malformed URL or date,
- **When** parsed,
- **Then** parsing fails with a reason naming the field and the row number.

**[proposed]** Required fields for v1: `id`, `title`, `youtubeId`, `url`,
`functionArea`, `tasks` (string[]), `tools` (string[]), `addedAt`. The field
list is the contract; the Sheet's column names map onto it in one config
object so a column rename is a one-line change.

### AC-9.2: doGet serves active videos only, whitelisted fields only

- **Given** the Sheet has active and archived rows,
- **When** a client GETs the web app URL,
- **Then** the JSON contains only active rows.

- **Given** a row has values in non-whitelisted columns (internal notes, cost
  info),
- **When** served,
- **Then** those columns never appear in the response.

### AC-9.3: doGet also serves the function-area and tool lists

- **Given** someone adds a new value to the function-area or tool column in
  the Sheet,
- **When** the catalog is next served,
- **Then** the response's `functionAreas` and `tools` lists include it,
  without any code change or redeploy.

### AC-9.4: Invalid rows are reported on a Problems tab

- **Given** two rows fail the catalog contract,
- **When** the serving script runs,
- **Then** the Problems tab lists both with row number and reason.

- **Given** all rows were invalid on the last run and all are fixed now,
- **When** the script runs,
- **Then** the Problems tab is cleared.

### AC-9.5: Two fixed deployments, chosen by environment

- **Given** the Apps Script project,
- **When** deployed with clasp,
- **Then** exactly two deployment IDs exist: test and production, and both
  URLs are stable across code updates.

- **Given** the page's environment variable (Vite `VITE_CATALOG_URL`,
  **[proposed]** name) points at the test deployment,
- **When** a Cloudflare preview loads,
- **Then** it reads from the test deployment, never production.

### AC-9.6: Frozen fixture and contract test

- **Given** `fixtures/catalog.json`, a frozen, sanitized extract holding
  public fields only (data rules, AC-2.3),
- **When** the contract test runs,
- **Then** the fixture parses against the catalog contract, and this is the
  same fixture every engine test in #11 uses.

**[proposed]** The row-to-item validation logic lives in `apps-script/` as
plain portable JavaScript with no Apps Script globals, so Vitest imports and
tests it directly. Sheet I/O, CacheService and deployment concerns stay in a
thin `.gs` adapter that CI cannot execute and is verified manually at deploy
time. CI can then enforce AC-9.1 and AC-9.6; AC-9.2 through AC-9.5 are
verified in the deployed test environment.

### AC-9.7: Loading and error states on the page

- **Given** the catalog request is in flight,
- **When** the page renders,
- **Then** a loading state shows.

- **Given** the catalog request fails,
- **When** the page renders,
- **Then** a friendly error with a retry action shows, and the retry
  re-issues the request.

Note: this AC lands with the intake/results UI (#10, #14) but the fetch
layer and its states ship with this issue so the page has one data path.

## Notes

- A few minutes of CacheService keeps responses fast (issue note). Verified
  manually against the test deployment; not unit-testable in CI.
- Production deployment happens from the FCNY-owned Google account agreed at
  #8, never a personal account (handoff, #35).
- Thumbnails derive from `youtubeId`; video length can be filled by a
  time-driven trigger later (post-MVP, cf. #38) so Eliot never types it.
