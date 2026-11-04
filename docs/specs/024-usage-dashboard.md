## #24 Usage dashboard for the Sprint team

Owner:

Status: Draft

Date: Oct 29, 2026

Source: [Spec library](https://fcny-spec-library.jason-zeng94.chatgpt.site/#spec-24)

### Problem

- FCNY admins need basic evidence of which videos and tags appear, which canonical keywords are searched, how keywords relate to displayed videos, and which content has no recorded use. A raw usage log does not answer those questions.

### Goal

- Deliver the required MVP analytics dashboard for authorized FCNY admins using #16 usage events, a versioned static catalog, private usage Sheet and an FCNY-owned private admin app.
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
  - Given the FCNY-owned private admin app and a private library or aggregate Sheet derived from #16
  - When an authorized Sprint admin opens it without YouTube channel access
  - Then the report shows only aggregate video/tag data and public catalog metadata; named staff can read it, unauthorized visitors cannot, and no raw event log is published. Each page and data request checks Google-authenticated identity and enforces the visitor's actual file permission with Restricted sharing and named members; use a separate app deployment executing as the visiting user, never the anonymous catalog endpoint.
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
  - Then the view can show all items, zero appearances, appearances with zero clicks, and tags with zero searches. When collection exists, include videos/tags with no retained event rows as zeros; if collection is missing, show usage as unavailable and disable unused-content filters. With collection present, distinguish these states, and label them as no recorded activity in the selected period rather than never used. Tag clicks derive from the clicked videos catalog tags without inflating video click totals.
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
  - When a scheduled daily report refresh or an on-demand connected-Sheet read runs
  - Then deduplicate accepted events before joins, use receivedAt dates in America/New_York, exclude team and isolated test/preview traffic by default, and expose last successful refresh, reporting coverage, stale/error and empty states. Name the FCNY refresh/access/retention owner and document refresh failures and recovery. Keep the restricted Sheet-to-private-app approach; Airtable is not an MVP dependency.
- AC-24.9 Canonical keyword frequency
  - Given search events carrying allowlisted functionArea, tools and tasks
  - When the keyword-frequency table is built
  - Then treat each canonical tag as a keyword identified by category and value, count distinct searchId once per keyword per submission, and normalize aliases through the existing dictionary. Searches with no matched canonical keywords do not invent keywords. Multi-keyword searches can contribute to multiple keyword totals, which are not additive search totals.
- AC-24.10 Video-keyword association
  - Given a search event and displayed-video impressions sharing sessionId and searchId within the same catalogVersion
  - When an admin views associations for a video or keyword
  - Then join the search canonical keywords to displayed videos and show distinct search/video occurrence counts for each video-keyword pair, with clicks as separate counts. Deduplicate before joining and prevent multi-tag fan-out from multiplying totals. Label associations as co-occurrence with a search keyword, not proof that the keyword caused the recommendation; direct or unjoinable events remain unattributed rather than guessing keywords.

- AC-24.11 Automatically use the shared library Sheet
  - Given the technical owner has configured the private app with the main app's source/usage Sheet in `LIBRARY_SOURCE_SHEET_URL`
  - When any authorized staff member signs in and opens or reloads the dashboard
  - Then load that configured Sheet under the visitor's Google identity without asking them to paste a link or connect a Sheet. Ignore legacy per-user connections and expose no connect/change/disconnect controls or RPCs. Recheck actual file permission and Restricted sharing on every read; reject inaccessible or public/link/domain-shared files. Missing or invalid shared configuration shows an owner-actionable error, never a personal connection prompt or fallback to another Sheet. Published snapshots define inventory and tags. Never edit the source, change sharing or enable collection while loading. Missing usage collection and unapproved tags remain visibly unavailable. Direct reads use an approved workbook reporting policy or a labeled conservative 24-hour window, and do not publish raw events. The public preview remains fictional and cannot read real data.

- AC-24.12 Website entry point
  - Given an admin is on the deployed recommender website
  - When they choose Admin analytics in the Staff navigation in the footer
  - Then open the private Google dashboard in a new tab with an accessible new-tab notice. The link does not grant access or pass credentials; Google sign-in and actual permission to the connected Restricted Sheet remain required. The public synthetic analytics preview is not the live destination.

- AC-24.13 Publish the library from its source Sheet
  - Given the technical owner has configured one source Sheet, a private GitHub publisher credential and separate test/production publishing targets
  - When Ali or Eliot opens the Library menu and chooses Publish library, then presses Publish library in its sidebar
  - Then validate approved public catalog fields and canonical tags, freeze a content-hashed snapshot, and submit one serialized deployment. Draft Sheet edits have no effect until publication succeeds. Validation, upload or deployment failure keeps the previous published catalog available. Report queued/running/succeeded/failed status and the workflow link; do not call an uploaded candidate live before successful deployment and manifest verification. Repeated clicks while a job is pending reuse that job.
- AC-24.14 One immutable catalog for every consumer
  - Given a successfully published catalog
  - When deterministic recommendations, LLM recommendations, usage validation or analytics read catalog metadata
  - Then use the same published catalogVersion and immutable JSON snapshot, never re-read draft catalog/tag cells at request time. Serve a revalidated current manifest and immutable hash-named snapshots from Cloudflare static assets. Validate hashes, complete schemas, duplicate IDs and dictionary references before activation. Reject unknown fields rather than silently publishing private columns. Preserve historical published snapshots for retained usage and reject version-mismatched recommendation responses.
- AC-24.15 Separate public catalog publication from private usage
  - Given the static publication pipeline
  - When its assets are built or deployed
  - Then publish only the public catalog contract, never usage rows, credentials, Sheet IDs, approval notes or user goals. Keep usage append/retention and Google-authenticated analytics private. Analytics inventory and event-time tag joins must use published snapshots; an admin cannot substitute an unrelated or draft catalog by connecting another Sheet. Missing historical snapshots stay unmapped.
- AC-24.16 Nontechnical maintenance and technical setup
  - Given a configured FCNY source Sheet and publishing project
  - When staff maintain the library
  - Then ordinary maintenance needs only editing approved Sheet cells and using Publish library. A technical owner configures the source reference, repository, data branch, workflow, credential and Cloudflare target once. Keep secrets server-side. Use a dedicated content branch, never push generated data to main or bypass code review. Content publication deploys only the static catalog service and does not replace application code or enable production logging/paid LLM calls.
- AC-24.17 Publication boundaries and recovery
  - Given a valid publication followed by invalid edits, an overlapping click, a failed deployment or a retagged video
  - When publication or reporting runs
  - Then tests prove that the live snapshot remains valid until atomic deployment, old versions remain available, only successful deployment plus expected live-manifest verification reports published, and historical activity retains its event-time tags. Provide rollback by republishing an approved snapshot and preserve the private usage purge. Never log authorization headers or raw upstream failures.

### Published task tags

- AC-24.18 Task-name compatibility
  - Given a published task tag, an equivalent engine task name or an approved task alias
  - When a submission creates a keyword event
  - Then store only matched original published task values, deduplicate and bound them, and never infer requested keywords from returned cards. Analytics still joins historical events to their own catalog snapshots without rewriting prior tags or events.

### Real-match counting and export

- AC-24.19 Count only real matches after a search
  - Given recommendation-mode impressions and clicks, including default picks shown before any search, cards shown after Clear and labeled fallback cards
  - When the report aggregates appearances and clicks
  - Then count an impression or click only when a search event exists for its sessionId, searchId and catalogVersion and its matchType is `strong` or `semantic`. Default picks with no search, and `weak`, `start-here` or `cross-area` cards, count in no video, tag, association or fact total and are not reported as unattributed. Keyword searches still count. Direct and topic modes are unchanged. The rule uses existing version 1 fields, so it also applies to previously retained events. A real match whose search event was lost in delivery is also excluded, so totals stay conservative.
  - Given a learner using the revised AC-16.7 browser producer
  - When default cards are browsed before submission or after Clear
  - Then passive display creates no events; actual play/YouTube actions contribute only to the separate direct-view and direct-click metrics. Do not rewrite historical events to infer browsing actions or missing submissions.
- AC-24.20 Aligned numeric columns
  - Given any analytics table
  - When it renders numeric columns
  - Then each numeric heading, including its sort control, and its cells share one centered class, while video, tag and category text stays left-aligned.
- AC-24.21 Spreadsheet export without new permissions
  - Given a loaded report with filters applied
  - When a staff member chooses Download CSV or Copy as CSV
  - Then the export contains every filtered row in the current sort and only the visible columns, named `library-analytics-<view>-<start>-to-<end>.csv`. Text cells beginning with `=`, `+`, `-`, `@`, tab or carriage return are prefixed with `'`. Export runs in the browser, adds no server function or OAuth scope, and never writes to a Sheet.

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
