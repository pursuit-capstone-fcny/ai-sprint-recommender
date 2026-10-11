# ADR 0002: Data access

- **Status:** Proposed, pending team approval (AC-1.5)
- **Date:** 2026-10-11
- **Decides:** How the page reads the catalog and writes usage events
- **Supersedes:** None

## Context

The source of truth for the catalog is a Google Sheet owned by FCNY. The app
must read the catalog and append usage events. There is no budget for new
spend, no server runtime in the stack (ADR 0001), and ranking runs in the
browser.

## Decision

A **Google Apps Script web app** is bound to the Sheet:

- `doGet()` serves the catalog as JSON.
- `doPost()` receives usage events and appends them to a sheet tab.
- The script is deployed with access set to "Anyone" (the link is the
  capability; it is not discoverable).
- Ranking runs entirely in the browser. The server holds no ranking logic.

## Options weighed

| Option | Outcome | Why |
| --- | --- | --- |
| **Apps Script web app** | **Chosen** | Zero infrastructure, zero spend, FCNY already owns the Sheet, catalog edits propagate with no sync step |
| Cloudflare Worker + KV/D1, synced from the Sheet | Rejected for now | More control and proper JSON APIs, but adds a moving part, a sync job, and a second place data lives. The revisit trigger below covers it |
| Google Sheets API called directly from the browser | Rejected | Requires an API key shipped in client code and exposes the Sheet to whoever extracts the key. Violates the data rules (AC-2.3) |

## Known wrinkle: CORS

Apps Script web apps are not normal JSON endpoints. Browser calls must be
"simple requests" or the preflight fails:

- `GET` works with the default `fetch` redirect-following behavior.
- `POST` must send the JSON payload as a `text/plain` body
  (`fetch(url, { method: "POST", body: JSON.stringify(data) })` with no
  explicit `Content-Type`), because `application/json` triggers a preflight
  that Apps Script does not answer.

**Fallback if this proves flaky in practice:** put a thin Cloudflare Worker in
front of the Apps Script URL to proxy and add CORS headers. It fits the free
tier and the existing stack. That worker would be the only change; nothing
upstream moves.

## Cost

$0. Apps Script quotas (URL Fetch, simultaneous executions, ~6 min execution
cap) are far above what an internal recommender needs.

## What FCNY owns after handoff

- The Google Sheet and its tab structure.
- The Apps Script project and its deployments, owned by an FCNY-controlled
  Google account (issue #35), not a personal account.
- The decision to re-deploy when the script changes (Apps Script web apps must
  be explicitly re-deployed to serve new code).

## What would make us revisit

- Quota or concurrency errors in real use.
- The catalog outgrows the Sheet (Apps Script practical limits are hit well
  below Sheets' own 10M-cell cap).
- Auth needs appear (link-holding is the only gate today).
- The CORS wrinkle costs more than the Worker proxy would.
