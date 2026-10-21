## #16 Log searches and clicks through Apps Script

Owner:

Status: Approved

Date: Oct 19, 2026

Source: [Spec library](https://fcny-spec-library.jason-zeng94.chatgpt.site/#spec-16)

### Problem

- Eliot wants to know who uses the library, when, and where visits come from (FR-009), and nothing records that today.

### Goal

- Search, impression and click events reach a restricted usage-log tab through `doPost`, with best-effort delivery and no raw goal text in MVP analytics. Provider processing for #43 follows its separate approved notice.

### Non-goals

- Names, emails, IP addresses or any login.
- Third-party analytics tools.
- The dashboard; that's #24.

### Acceptance criteria

- AC-16.1 Event schema
  - Given the strict versioned Zod event schema in `src/contracts`
  - When an event is built
  - Then common fields are `schemaVersion`, UUID `eventId`, `sessionId`, `searchId`, event `type`, UTC `time`, `mode` as recommendations/topic/direct, `src` and `catalogVersion`; the server adds `receivedAt`. Search carries canonical area/tools/tasks, `resultCount`, `strongMatchCount` and fallback type; recommendation events also carry `recommendationEngine` as llm/rules, a bounded LLM fallback reason and applicable model/prompt versions, without changing `mode`. Impression/click carry `youtubeId`, one-based rank and match type; click adds `embed` or `youtube`
- AC-16.2 Non-blocking send
  - Given an event sent as a `text/plain` POST with no custom headers or credentials
  - When Apps Script is slow, unavailable or the browser navigates away
  - Then results and navigation continue immediately; delivery is bounded and best effort, with failures caught. A missing or opaque response never proves delivery or triggers unbounded retries
- AC-16.3 Validation and duplicates
  - Given a POST body of at most 16 KB
  - When `doPost` validates it
  - Then unknown fields/types and invalid IDs or tags are rejected; valid events are appended once per `eventId` under a script lock. All text fields are stored as literal values, never formulas
- AC-16.4 Visit privacy
  - Given logging approved under #8
  - When a visit starts
  - Then a random session ID lives only in page memory and ends on reload or close; stored events contain only schema fields, no raw goal, referrer, name, email or application-collected IP. The notice states what is collected and for how long
- AC-16.5 Source tag
  - Given `src` is website, email, session, pilot or team
  - When an event is logged
  - Then that value is stored; any other value is stored as other, and missing means website
- AC-16.6 Free-text goals
  - Given a typed goal
  - When MVP logging runs
  - Then only canonical matched dictionary tags enter analytics, after client and server allowlist validation; raw goals sent to the #43 provider follow the separate #8 policy and never enter this log. Option B remains off pending separate approval; removing emails, numbers and links does not remove names or sensitive context
- AC-16.7 Event timing
  - Given a submitted search or displayed result set
  - When the UI renders or expands results
  - Then one search event is sent per submission and one impression per displayed video per `searchId`; rerenders do not resend them, and a direct video view uses `mode=direct` and a new context `searchId` without sending a search event
- AC-16.8 Operations
  - Given the anonymous endpoint and retention policy
  - When events accumulate or requests spike
  - Then only FCNY staff can read logs; an FCNY-owned purge enforces retention, payload/rate caps bound writes, and a server switch can stop logging. Public clients can forge events, so counts are estimates

### Open questions

- [ ] Ali to approve logging, retention and Option A at #8. Until then, production logging stays off; Option B needs a separate privacy design and revised anonymity claims.
- [ ] Define `matchType` as strong/weak/semantic/cross-area/start-here/direct and `fallbackType` as none/cross-area/start-here/mixed/unavailable; `resultCount` means the initially displayed cards. Approve these shared enums with #11–#14 and #24.
- [ ] Record expected peak traffic and a server write cap before launch. If direct Apps Script access cannot enforce the agreed cap, test the ADR-0002 proxy with a server-only upstream credential; never ship a secret in the SPA.
- [ ] Set `matchType=semantic` for LLM picks without verified rule signals; count only verified #11 strong matches in `strongMatchCount`. Keep the model-failure reason separate from #13's catalog fallback type.

### Evidence required

- Test: strict field/tag validation, duplicate and concurrent posts, per-type fields, rerender deduplication, retention and non-blocking failures
- Log or metric: events per day by type and source; dropped-event count
- Manual check: signed-out search, Show more and both click actions on preview; verify expected rows, readable acknowledgment if used, and behavior offline
- Rollback signal: a row contains personal data; stop logging, delete the rows, then fix
