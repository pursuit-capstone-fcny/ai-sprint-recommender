# Spec: Maintain the catalog in the original tracker

- **Issue:** User request, November 3, 2026
- **PR:** Pending
- **Status:** in review

Keep FCNY's existing Video Tracker as the per-video source, generate the public
catalog on explicit publication, and keep activity in the original workbook.
Airtable integration is deferred; it can later produce the same catalog contract.

## Acceptance criteria

### AC-TRACKER-1: Original layout and public fields

- **Given** Video Tracker has its header in row 4 and its existing title,
  description, public YouTube link, primary/secondary category, tool and status
  columns, plus Task keywords, Metadata status and Instruction format
- **When** the configured tracker publisher reads it
- **Then** read only those whitelisted columns, include the two published YouTube
  statuses, and produce the existing versioned catalog without Catalog,
  Dictionary, Synonyms, Adjacent tools or Problems tabs. New vocabulary values
  require no application-code change; dictionary spelling conflicts and duplicate
  IDs block publication with safe field/row diagnostics.

### AC-TRACKER-2: Migration parity

- **Given** the verified current public snapshot and an unmigrated tracker
- **When** the owner initializes tracker maintenance
- **Then** match existing videos by YouTube ID or a unique exact published title,
  reconcile public title/description/link/category differences, seed existing task
  keywords and readiness, and prove complete catalog and version equality before
  writing. Retain existing dropdown constraints, private cells, source review
  statuses and usage policy. Refuse ambiguous identities, missing baseline videos,
  or overwriting staff metadata. A partial setup does not publish anything.

### AC-TRACKER-3: Review and explicit publication

- **Given** a maintained tracker and its current published catalog
- **When** staff choose Review changes
- **Then** show additions, metadata edits and retirements, plus actionable
  validation errors. Publication requires the reviewed draft and baseline to
  remain identical; stale reviews are rejected. Existing publication serialization,
  immutable history, last-good behavior and verified deployment status remain.

### AC-TRACKER-4: Additions without code changes

- **Given** a newly added tracker video with public metadata, task keywords,
  Ready status and reviewed instruction format
- **When** staff review and publish it
- **Then** generate the catalog JSON and dictionary automatically, include the
  video in both engines, and make it eligible for matching supported requests
  without editing any per-video code table or redeploying application code.
  Invalid/incomplete published rows block publication. New videos require an
  instruction format of demonstrated, walkthrough, explained or mentioned;
  mentioning a task is not evidence of teaching it. New procedural workflows
  and arbitrary language understanding are not inferred from flat tags.

### AC-TRACKER-5: Stable identity and history

- **Given** existing published videos
- **When** staff reorder rows, edit metadata, change a link or retire a video
- **Then** identity is its YouTube ID. Reordering alone preserves the complete
  catalog and results. A changed link appears as retirement plus addition;
  changed public metadata appears as an edit. Retired rows leave the active
  catalog while immutable snapshots retain event-time metadata. Retain published
  vocabulary and mappings, including terms without active videos.

### AC-TRACKER-6: Same-workbook activity

- **Given** tracker mode and the configured source workbook
- **When** the collector initializes, accepts or purges usage
- **Then** use that workbook's private Usage tab and reject a different usage
  workbook. Preserve approval flags, retention, limits and historical events;
  reject public, link-wide or domain-wide sharing at setup and each activity
  access, including if sharing changes after deployment;
  initialization neither enables collection nor copies another environment's
  logs. The dashboard keeps reading Usage from the connected source workbook.
  Activity and staff metadata never enter published catalog assets.

### AC-TRACKER-7: Evidence and reproducibility

- **Given** a public baseline and a whitelisted tracker export
- **When** the verification command runs
- **Then** prove exact catalog equality, unchanged deterministic results across
  task/tool/filter cases, identical LLM request bodies, row-order independence,
  and a new video accepted by both engines without code changes. Separate these
  checks from live paid LLM calls and deployment evidence.

## Verification

Use fictional fixtures for checked-in tests. Live baseline comparisons operate
on temporary public-only exports and save counts/hash evidence, never private
tracker fields. Source-sheet migration and Apps Script deployment are separate
from application code review and do not enable new permissions or paid calls.
