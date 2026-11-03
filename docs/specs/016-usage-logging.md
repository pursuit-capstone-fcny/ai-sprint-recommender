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
  - Learner presentation update, November 2, 2026: Jason requested removing the test-preview usage notice in the brand redesign. [AC-BRAND-6](brand-kit-redesign.md#ac-brand-6-learner-copy) supersedes the notice-presentation requirement for the learner page. Collection and retention behavior are unchanged.
- AC-16.5 Source tag
  - Given `src` is website, email, session, pilot or team
  - When an event is logged
  - Then that value is stored; any other value is stored as other, and missing means website
- AC-16.6 Free-text goals
  - Given a typed goal
  - When MVP logging runs
  - Then only canonical matched dictionary tags enter analytics, after client and server allowlist validation; raw goals sent to the #43 provider follow the separate #8 policy and never enter this log. Option B remains off pending separate approval; removing emails, numbers and links does not remove names or sensitive context
- AC-16.7 Event timing
  - Given a submitted search
  - When the UI renders or expands its results
  - Then one search event is sent per submission and one impression per displayed video per `searchId`; rerenders do not resend them. Submitted fallback cards retain their actual fallback match types.
  - Given default cards before a nonblank submission, after Clear, or after a blank/whitespace-only deterministic submission
  - When the UI displays or rerenders them
  - Then send no automatic search or impression events. A play or YouTube action sends a direct impression once per video in that browsing context and a direct click per action, using `mode=direct`, `matchType=direct`, and no recommendation-engine metadata. Clear starts a new browsing context; submitted results retain their search context during unsubmitted edits. Explicit feedback remains available and uses the displayed card's context.
- AC-16.8 Operations
  - Given the anonymous endpoint and retention policy
  - When events accumulate or requests spike
  - Then only FCNY staff can read logs; an FCNY-owned purge enforces retention, payload/rate caps bound writes, and a server switch can stop logging. Public clients can forge events, so counts are estimates
- AC-16.9 Bounded rate-limit recovery
  - Given a rolling-minute or UTC-day write cap is reached
  - When the collector rejects an event
  - Then return `USAGE_RATE_LIMITED` with an integer `retryAfterMs` from 1 through 86,400,000, long enough for every currently exceeded rate window to clear. Retained-row and disabled stops remain unchanged; no configured cap increases.
  - Given a valid cooldown response
  - When the browser receives new automatic events before its expiry
  - Then drop those events and pending automatic events from before expiry. After expiry, permit only fresh actions, with no timer-driven retries or replay. Existing queue size, lifetime, request deadline and explicit-feedback retry rules remain in force.
  - Given missing or invalid cooldown metadata from an older or incompatible collector
  - When a rate-limit response arrives
  - Then retain the existing stop for automatic traffic until reload. A valid hint never enables disabled collection, and shorter later hints never shorten an existing cooldown.

- AC-16.10 Offline capacity preflight
  - Given explicit synthetic traffic, retained-row counts, collector policy and optional AI limits
  - When the operator runs `pnpm check:usage-capacity <scenario.json>`
  - Then exercise the real event producers, bounded sender, collector and learner report in memory, report generated/accepted/dropped events by type and fixed collector error codes, and exit 1 for any delivery loss. AI burst admission uses the real budget gate and current source model/prompt, with a separately labeled configured token-cost ceiling. Missing permitted version pairs and rejected AI admissions fail the check. Invalid or oversized scenarios exit 2 without echoing supplied values. No provider calls, live requests, Sheet writes or policy changes occur; passing does not establish native throughput or production configuration.

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
