# Catalog endpoint

Implements the server portion of [approved spec #9](../docs/specs/009-serve-catalog.md).
The endpoint remains disabled until `CATALOG_PUBLIC_ENABLED` is explicitly set
to `true` after FCNY's public-field and anonymous-access approval.

## Sheet layout

Create these tabs with the exact headers in row 1. Additional private Catalog
columns are ignored.

| Tab            | Headers                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Catalog        | `youtubeId`, `title`, `description`, `functionAreas`, `tasks`, `tools`, `addedAt`, `lengthSeconds`, `status`, `startHere` |
| Dictionary     | `category`, `value`                                                                                                       |
| Synonyms       | `alias`, `category`, `target`                                                                                             |
| Adjacent tools | `source`, `related`, `task`                                                                                               |

Dictionary categories are `functionArea`, `tool` and `task`. Tags in Catalog
cells are comma-separated, trimmed, canonicalized and deduplicated. An empty
tag cell means an empty array. Use numeric duration cells and boolean checkboxes
for `startHere`; quoted numbers/booleans are invalid. Upload dates may be ISO
text or Sheet dates, converted using the spreadsheet's timezone. Blank dates
and lengths become `null`. Empty mapping tabs still need headers.

`Problems` is reserved for generated diagnostics and is replaced on refresh.
The script holds one lock from reading the source tabs through flushing Problems,
so competing requests cannot overwrite newer diagnostics. Staff edits appear on
the next successful GET; there is no application cache.

## Build and deploy

Run `pnpm build:apps-script`. The generated `build/apps-script/Code.js` bundles
Zod and exposes a global `doGet`; its manifest is copied beside it. `pnpm build`
also builds this artifact so CI checks it.

Use separate bound Apps Script projects and sanitized Sheets for test and
production. Set `CATALOG_SPREADSHEET_ID` separately in each project's Script
Properties. Leave `CATALOG_PUBLIC_ENABLED` unset until its data is approved.
The spreadsheet ID comes only from server configuration, never a request.

Deployment automation and clasp setup are follow-up work. When deploying,
retain each environment's existing deployment ID, run as the designated FCNY
owner, and verify signed-out access. The production deployment must be owned by
FCNY. No Google account, Sheet or deployment has been provisioned by this PR.

ContentService returns JSON through a redirect. The browser must follow
redirects and use the shared `parsePublicCatalog` parser. Error envelopes
(`CATALOG_DISABLED`, `CATALOG_BUSY`, `CATALOG_INVALID_CONFIG`,
`CATALOG_UNAVAILABLE`) are distinct from a valid catalog with `items: []`.
Apps Script does not expose an HTTP status setter on TextOutput.

## Integration and remaining acceptance

- Server implementation covers validation, active/public fields, canonical
  configuration, snapshot versions and Problems replacement.
- `fixtures/public-catalog.json` is the frozen approved wire fixture, validated
  by the same parser used in the server. The engine's fixture integration is
  still pending.
- Ahsan's open engine/page PRs use `isStartHere` and `durationSeconds`. The
  approved wire contract uses `startHere` and `lengthSeconds`. Reconcile these
  in the browser adapter before connecting the endpoint; this change does not
  rename his types or edit his engine/page files.
- AC-9.5 needs isolated fixed deployments and clasp verification.
- AC-9.7 needs the page's ten-second timeout, retry and empty state.
- AC-9.8 needs signed-out GET/POST tests on preview and production, with #16.
  Reading fresh data in unit tests does not establish cross-origin access.
- Browser/engine integration and those live checks remain open in #9.

References: [ContentService](https://developers.google.com/apps-script/reference/content/content-service),
[script locks](https://developers.google.com/apps-script/reference/lock/lock-service).
