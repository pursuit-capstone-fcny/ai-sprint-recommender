# Spec: Curated default and fallback video collections

- **Issue:** User request, November 2, 2026
- **PR:** #122
- **Status:** in review

The user approved two ordered sets of eight videos. Default videos introduce
beginners to tools and integration possibilities. Fallback videos cover broader
topics across demos, walkthroughs and lectures. This supersedes the six-video
limit and ordering in AC-FALLBACK-1 of `no-match-fallbacks.md` for browsing
collections. Search matching and provider validation retain their existing rules.

## Acceptance criteria

### AC-COLLECTION-1: Beginner default collection

- **Given** a usable catalog containing the approved default videos
- **When** the deterministic view first loads, the user clears the form, switches
  back to deterministic, or submits a blank deterministic goal
- **Then** show the eight `DEFAULT_VIDEO_IDS` in `src/recommendations/curatedVideos.ts`
  in their approved editorial order, resolving displayed metadata from the
  current catalog. The collection starts with Starter Skills and aiSPIRE, then
  introduces Copilot in Word, Gemini in Sheets, Claude in Word, NotebookLM,
  Perplexity and ChatGPT with Gamma.

### AC-COLLECTION-2: Distinct general fallback collection

- **Given** a nonblank submitted goal and a usable catalog
- **When** deterministic matching returns no videos, AI abstains, or AI is
  unavailable, disabled, invalid or times out
- **Then** show the eight `FALLBACK_VIDEO_IDS` in their approved editorial order
  as labeled general fallback suggestions. The topics are interim AI guidelines,
  RFP review, podcasts, feedback reports, email automation, custom training
  assistants, syllabus planning and executive risk communication. Preserve the
  no-match or failure message and existing bounded usage metadata. Do not make
  another provider request. The two approved lists share no IDs.

### AC-COLLECTION-3: Catalog changes and small inventories

- **Given** missing, retired or duplicate catalog IDs
- **When** selecting either collection
- **Then** exclude every copy of duplicate IDs, including active/retired pairs,
  and select only active catalog items. Preserve the order of remaining curated
  videos. Fill vacancies with other eligible videos, preferring Start-here flags,
  then newest known dates and ascending IDs. Borrow from the opposite curated
  collection only after other replacements are exhausted. Show fewer than eight
  when fewer than eight eligible videos exist. Never mutate the input catalog.
  Reserve the default collection's actual replacements when filling the fallback
  collection, keeping both sets distinct whenever at least sixteen eligible
  videos exist.

### AC-COLLECTION-4: Independent search and interaction behavior

- **Given** the curated collections
- **When** a visitor submits a nonblank goal, switches engines, plays a video,
  copies a link or triggers usage collection
- **Then** preserve existing search matching, nonempty result counts, request
  cancellation, playback, links and usage semantics. Blank AI goals and loading
  requests show no collection. Curation makes no provider calls and does not
  change the published catalog or fabricate titles, descriptions or durations.
