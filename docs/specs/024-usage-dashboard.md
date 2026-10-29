## #24 Usage dashboard for the Sprint team

Owner:

Status: Draft

Date: Oct 29, 2026

Source: [Spec library](https://fcny-spec-library.jason-zeng94.chatgpt.site/#spec-24)

### Problem

- FCNY admins need basic evidence of which videos and tags appear, which canonical keywords are searched, how keywords relate to displayed videos, and which content has no recorded use. A raw usage log does not answer those questions.

### Goal

- Deliver the required MVP analytics dashboard for authorized FCNY admins using #16 usage events, a restricted aggregate Google Sheet and an FCNY-owned private admin app.
- MVP covers basic video/tag data: appearance frequency, keyword association, keyword frequency and filters for unused content. Percentage watched is optional pending feasibility and collection approval. The user confirmed a private app dashboard in place of Looker Studio on Oct 29, 2026.

### Work order

- **Priority:** P1
- **Track:** Required MVP analytics
- **Next action:** Build aggregate tables and the staff report against the existing #16 contract; use synthetic fixtures while production collection/access decisions remain open.
- **Development dependencies:** #16 event contract, canonical dictionary and versioned public catalog metadata. #29 and Airtable are not dependencies.
- **Release / validation gates:** Approved production logging, restricted FCNY access, named refresh/retention owner and reconciled totals. MVP inclusion is confirmed.

### Non-goals

- Raw keyword/goal text, unmatched original queries, personal profiles or public analytics.
- Feedback dashboards, Airtable integration or broader reporting in this basic MVP.
- Mandatory watch completion, drop-off or percentage-watched tracking; clicks do not prove playback.

### Acceptance criteria

- AC-24.1 FCNY-owned restricted dashboard
  - Given the FCNY-owned private admin app and a restricted aggregate Sheet derived from #16
  - When an authorized Sprint admin opens it without YouTube channel access
  - Then the report shows only aggregate video/tag data and public catalog metadata; named staff can read it, unauthorized visitors cannot, and no raw event log is published. Each page and data request checks Google-authenticated identity against a server-side staff allowlist and enforces the visitor's reporting-file access; use a separate app deployment executing as the visiting user, never the anonymous catalog endpoint.
- AC-24.2 Video appearance frequency
  - Given accepted production impression and click events in the selected reporting period
  - When video totals are calculated
  - Then appearance frequency counts distinct displayed-result impressions by youtubeId and searchId, deduplicating eventId and repeated delivery/renders. Show click-event counts separately for embed and YouTube actions; clicks are not watches. Direct views are separately labeled and do not inflate recommendation appearance counts.
- AC-24.3 Tag appearance frequency
  - Given the canonical function-area/tool/task dictionary and public catalog metadata matching each event catalogVersion
  - When tag totals are calculated
  - Then count distinct displayed video/searchId pairs whose video carries each tag, counting a pair once per tag even when catalog joins repeat it. Keep tag appearances separate from keyword search frequency; unavailable historical catalog mappings are flagged and never silently joined to retagged current metadata.
- AC-24.4 Filters and unused content
  - Given the complete active video catalog and canonical tag dictionary left-joined to usage aggregates
  - When an admin selects a date range, video/tag, tag category, source or recommendation/topic mode and an activity filter in sortable, paginated video/tag/association views
  - Then the view can show all items, zero appearances, appearances with zero clicks, and tags with zero searches. Include videos/tags with no event rows as zeros, distinguish these states, and label them as no recorded activity in the selected period rather than never used. Tag clicks derive from the clicked videos catalog tags without inflating video click totals.
- AC-24.5 Required for MVP
  - Given the confirmed MVP scope
  - When MVP readiness is reviewed
  - Then the basic video/tag analytics dashboard is a required deliverable dependent on #16, not an optional Post-MVP candidate or a new inclusion decision at #8. Remaining access, retention and reporting-owner decisions are release gates, not scope approval.
- AC-24.6 Basic scope and privacy
  - Given the MVP reporting dataset
  - When aggregates are prepared
  - Then include video/tag appearance frequency, canonical keyword frequency, video-keyword associations and unused-content filters only, with click counts supporting the usage distinction. Do not store or display raw typed goals, unmatched original wording, personal identifiers or raw logs. Feedback reporting from #29, Airtable integration and broader analytics are separate additions and do not block this basic dashboard.
- AC-24.7 Optional percentage watched
  - Given the request for percentage watched and the current search/impression/click-only #16 schema
  - When playback-progress feasibility is evaluated
  - Then record whether embedded YouTube playback APIs can supply reliable observed progress with approved collection and retention, accounting for seeking/replays, duration, external YouTube opens and missing observations. If feasible, separately agree instrumentation and metric semantics before adding it. Otherwise show unavailable or omit it; never infer percentage watched or completion from clicks, and do not block the basic MVP dashboard.
- AC-24.8 Reporting operations
  - Given the restricted aggregate pipeline and approved production logging
  - When a scheduled daily refresh runs
  - Then deduplicate accepted events before joins, use receivedAt dates in America/New_York, exclude team and isolated test/preview traffic by default, and expose last successful refresh, reporting coverage, stale/error and empty states. Name the FCNY refresh/access/retention owner and document refresh failures and recovery. Keep the restricted Sheet-to-private-app approach; Airtable is not an MVP dependency.
- AC-24.9 Canonical keyword frequency
  - Given search events carrying allowlisted functionArea, tools and tasks
  - When the keyword-frequency table is built
  - Then treat each canonical tag as a keyword identified by category and value, count distinct searchId once per keyword per submission, and normalize aliases through the existing dictionary. Searches with no matched canonical keywords do not invent keywords. Multi-keyword searches can contribute to multiple keyword totals, which are not additive search totals.
- AC-24.10 Video-keyword association
  - Given a search event and displayed-video impressions sharing sessionId and searchId within the same catalogVersion
  - When an admin views associations for a video or keyword
  - Then join the search canonical keywords to displayed videos and show distinct search/video occurrence counts for each video-keyword pair, with clicks as separate counts. Deduplicate before joining and prevent multi-tag fan-out from multiplying totals. Label associations as co-occurrence with a search keyword, not proof that the keyword caused the recommendation; direct or unjoinable events remain unattributed rather than guessing keywords.

### Open questions

- [ ] Name the authorized admin viewers and FCNY owner for aggregate refresh, retention, access and recovery; confirm reporting coverage and retention under #8. Dashboard inclusion in MVP is already confirmed.
- [ ] Verify availability of public catalog snapshots for each retained catalogVersion; define historical unmapped-data presentation before launch.
- [ ] Investigate observed playback percentage separately. Record supported embed behavior and external-playback limitations; agree any new collection policy before enabling progress events.

### Evidence required

- Test: use a deterministic fixture with repeated deliveries, rerenders, multi-keyword searches, videos with multiple tags, direct views, version changes, team/test events, zero-result searches, zero-appearance videos/tags and appearances without clicks. Assert exact totals and filter membership.
- Log or metric: manually reconcile distinct searches, impressions, clicks, canonical keyword counts and video-keyword association counts for a reporting day. Demonstrate joins do not multiply totals.
- Manual check: an authorized admin finds an unused video/tag, a frequently appearing video and its associated keywords; verify denied access, date/source filters, last refresh, empty/stale/error states and timezone boundaries.
- Optional feasibility evidence: document whether observed playback percentage is reliable and what cannot be observed. Unavailable percentage does not fail basic MVP acceptance.
- Rollback signal: exposed raw/private data or aggregate totals that disagree with accepted events; restrict access and repair before release.
- Review: record the tested release/report version, unresolved failures and follow-up owners. Updated requirements do not mark implementation complete.
