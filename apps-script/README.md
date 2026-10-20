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

## Browser integration

The page validates the versioned envelope, skips invalid rows and every copy
of duplicate IDs, and logs only row positions and public field names. It maps
`startHere` to `isStartHere` and `lengthSeconds` to `durationSeconds` at the
engine/card boundary. Unknown dates remain `null` and sort last among otherwise
equal matches; unknown lengths retain the existing card label.

The loader follows redirects, omits credentials and bypasses the browser cache.
A ten-second deadline covers both fetch and JSON reading. Failures have a retry;
a valid empty catalog shows "No videos available" with refresh. Changing requests
or leaving the page aborts the old request. Function areas and tools come from
the dictionary, including tools without videos.

`fixtures/public-catalog.json` is the frozen wire fixture shared by server,
browser and engine integration tests. The older engine fixtures remain for
Ahsan's ranking regression tests. Served synonyms and adjacency are available
on the validated catalog; connecting them to the engine remains #12.

## Build and deployment prerequisites

`pnpm build:apps-script` bundles Zod and exposes a global `doGet` in
`build/apps-script/Code.js`, with the manifest beside it. `pnpm build` also checks
this artifact.

Use separate bound Apps Script projects and sanitized Sheets for test and
production. Production must belong to FCNY. Set `CATALOG_SPREADSHEET_ID`
separately in each project's Script Properties, and keep their logs separate.
Leave `CATALOG_PUBLIC_ENABLED` unset until FCNY approves public fields and
anonymous access, then set it to `true`. Retain each environment's existing web
app deployment ID when changing versions; record the previous version for rollback.

Clasp automation remains open. As of October 20, 2026, clasp 3.4.1 pulls
`micromatch > braces`, which fails the required high-severity audit with
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
There is no patched braces release. Clasp has not been added to the dependency
lockfile; recheck the advisory before adding deployment automation.

## Site configuration and remaining acceptance

- Set repository variable `CATALOG_TEST_URL` to the test web app's `/exec` URL.
  Preview builds use it. Until configured, previews explicitly use the fictional
  fixture and display "Demo catalog".
- Set `CATALOG_PRODUCTION_URL` to the FCNY production `/exec` URL. Production
  requires a remote catalog and shows an unavailable state if none is configured.
  Local development uses `.env.example` as a guide.
- AC-9.5 still needs real bound projects, deployment ownership, isolation and
  fixed-ID verification. No Google resources have been provisioned by this PR.
- AC-9.8 still needs signed-out GET from preview and production, plus POST when
  #16 is implemented. Edit and retire test rows, reload within five minutes,
  and verify preview writes never reach production. Unit tests do not prove
  Google cross-origin access. Use the ADR-0002 proxy fallback if access fails.
- ContentService redirects JSON. Error envelopes (`CATALOG_DISABLED`,
  `CATALOG_BUSY`, `CATALOG_INVALID_CONFIG`, `CATALOG_UNAVAILABLE`) produce the
  page's failure state; `items: []` is a valid empty catalog.

References: [clasp commands](https://github.com/google/clasp#commands),
[ContentService](https://developers.google.com/apps-script/reference/content/content-service),
[script locks](https://developers.google.com/apps-script/reference/lock/lock-service).
