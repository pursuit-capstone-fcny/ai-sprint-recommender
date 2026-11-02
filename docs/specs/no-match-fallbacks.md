# Spec: Clearly labeled no-match fallback videos

- **Issue:** User request, November 2, 2026
- **PR:** #114
- **Status:** in review

The user requested fallback videos when either engine has no matches and selected
up to six videos. This supersedes the no-replacement behavior in #43's demo
engine selection. Engine ranking and provider validation remain independent.

## Acceptance criteria

### AC-FALLBACK-1: No-match results for either engine

- **Given** a nonblank submitted task and a usable catalog
- **When** deterministic matching returns zero videos, Haiku validly abstains,
  or Haiku is unavailable, invalid, disabled or times out
- **Then** show up to six distinct active catalog videos as general fallback
  suggestions. Prefer Start-here videos, then newest known dates and ascending
  IDs. Exclude every copy of duplicate IDs, including active/retired pairs.
  Do not invoke the other engine or make another provider request.

### AC-FALLBACK-2: Honest presentation

- **Given** a fallback-only result set
- **When** its cards appear
- **Then** preserve the no-match or AI-unavailable message, use the heading
  "Fallback videos", explain that these are general suggestions rather than
  matches, and visibly label every card "Fallback video". Titles, descriptions
  and links come from the catalog. Playback and copying still work.

### AC-FALLBACK-3: Preserve other states

- **Given** a nonempty match list, loading request, engine switch or blank AI task
- **When** the page updates
- **Then** keep nonempty lists unchanged without filling them; show no fallback
  while loading, before a submission, or for blank AI input. Initial browsing
  and Clear keep their existing behavior. An empty eligible catalog stays empty.
  Late AI responses cannot overwrite a newer submission or engine choice.

### AC-FALLBACK-4: Actual fallback analytics

- **Given** enabled usage collection and displayed fallback cards
- **When** search, impression, playback or feedback events are produced
- **Then** use the existing local `rules` result-origin metadata with the original
  bounded AI failure reason or `insufficient-results` for a valid AI abstention.
  Preserve known model/prompt versions. Fallbacks are weak or Start-here events,
  never strong or semantic matches, and do not establish an AI success. Log only
  actual displayed cards, preserve deduplication, and never include raw goals.
