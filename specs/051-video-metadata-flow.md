# Spec: Suggest video metadata from pasted YouTube links

- **Issue:** #51
- **PR:** TBD
- **Status:** draft, pending Jason's review
- **Depends on:** #4 (tag dictionary), #9 (catalog contract), #5 (catalog Sheet)

## Scope decisions (Oct 11)

Link-first (no direct upload in v1). Real LLM for drafts, API key in the
FCNY-owned script's Script Properties. Suggest-only: nothing enters the
catalog without Eliot's approval. The daily staleness digest lives in #38,
not here.

## Mechanism

An "Intake" tab in the catalog Sheet: Eliot pastes a YouTube link in column
A. A custom menu action ("Process intake now") runs the flow; drafts land
in the row's review columns with a status. Time-driven processing can come
later; the menu keeps v1 deterministic.

Row states: `Pending` → `Drafted` → `Approved` → `Imported`, or `Failed`
with a reason in a status column Eliot can read.

## Acceptance criteria

Anything marked **[proposed]** is my addition; strike it in review.

### AC-51.1: Link intake

- **Given** a valid YouTube URL pasted on the Intake tab,
- **When** processing runs,
- **Then** the row's video ID is extracted and its state becomes `Drafted`
  with drafts filled, or `Failed` with a readable reason.

- **Given** a cell that is not a YouTube URL,
- **When** processing runs,
- **Then** the row is marked `Failed` with reason "not a YouTube link" and
  the run continues with other rows.

### AC-51.2: Transcript from YouTube, not from us

- **Given** the video has captions (auto or manual),
- **When** processed,
- **Then** the transcript text is fetched via the YouTube API and used for
  the drafts.

- **Given** the video has no captions,
- **When** processed,
- **Then** drafts are generated from the video's existing title and
  description only, and the status includes `needs-manual` so Eliot knows
  the drafts are weaker.

### AC-51.3: Tags come from the tag dictionary

- **Given** the transcript and the tag dictionary (#4),
- **When** the LLM drafts tags,
- **Then** every proposed tag is a dictionary tag, and any out-of-dictionary
  suggestion lands in a separate `new tag ideas` column for Eliot, never in
  the `tools`/`tasks` columns.

### AC-51.4: LLM perimeter

- **Given** the LLM call,
- **When** it runs,
- **Then** it receives only the transcript (or metadata fallback) and the
  tag dictionary, has no tools, and returns structured JSON
  (title, description, tags).

- **Given** an LLM response that is not parseable JSON or is missing fields,
- **When** processed,
- **Then** the script retries once, then marks the row `Failed` with the
  reason rather than writing partial drafts silently.

**[proposed]** The prompt is built by one function from one `IntakePrompt`
type (transcript, dictionary) in the same style as the #9 contract, so the
perimeter is a type, not a convention.

### AC-51.5: Suggest-only writes

- **Given** a row in state `Drafted`,
- **When** Eliot marks it `Approved`,
- **Then** the row is validated against the #9 catalog contract and appended
  to the catalog tab, and the intake row becomes `Imported`.

- **Given** a row in any state other than `Approved`,
- **When** any script runs,
- **Then** nothing is appended to the catalog tab.

- **Given** an approved row that fails the catalog contract (missing field,
  bad URL),
- **When** imported,
- **Then** it is reported on the Problems tab (#9) and the intake row stays
  `Failed` with the reason.

### AC-51.6: Duplicates

- **Given** a video ID already in the catalog, or already `Drafted`/`Approved`
  on the Intake tab,
- **When** the same link is pasted again,
- **Then** the row is marked `Failed` with reason "duplicate" and the catalog
  is never appended twice.

### AC-51.7: Testability split

- **Given** the repo's CI,
- **When** it runs,
- **Then** link parsing, prompt building, response parsing, dictionary
  filtering and the duplicate check are portable functions under
  `apps-script/` tested by Vitest with frozen fixtures (no network, no LLM,
  no Sheet), and only the thin adapter (UrlFetch, Sheets I/O, Script
  Properties) is verified manually in the deployed script.

## Notes

- Quota: captions and video metadata reads are a few units per row against
  YouTube's 10,000/day default; link-only v1 never uploads, so quota is a
  non-issue. Direct upload stays post-MVP.
- The API key lives in Script Properties of the FCNY-owned script
  (#8 decides the account, #35 the handoff). Spend is FCNY's decision;
  the digest in #38 reuses the same key.
- Privacy: transcripts are FCNY's own video content, not member data.
  Third-party LLM processing of that content is disclosed at #8.
- YouTube quota errors and LLM API errors land in the status column with
  distinguishable reasons, so Eliot's report is actionable.
