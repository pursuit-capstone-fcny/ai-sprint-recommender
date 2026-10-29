## #13 Add fallbacks so no search comes back empty

Owner:

Status: Draft

Date: Oct 29, 2026

Source: [Spec library](https://fcny-spec-library.jason-zeng94.chatgpt.site/#spec-13)

### Problem

- Tags have gaps and some function areas, such as fundraising, have few videos, so some searches would come back empty (FR-005).

### Goal

- Support #83’s agreed 6–8-result policy when enough eligible videos exist, preserve available smaller sets and label fallbacks honestly.

### Work order

- **Priority:** P1
- **Track:** Complete matching
- **Next action:** Align thin/no-match behavior and approved Start-here picks with #83.
- **Development dependencies:** #5 Start-here data, #7 judgments and #11 ranking.
- **Release / validation gates:** Agree policy before changing result filling; do not pad with invented relevance.

### Non-goals

- Hiding thin results by padding them with unrelated videos without saying so.

### Acceptance criteria

- AC-13.1 Not sure
  - Given the function area "Not sure"
  - When the engine ranks
  - Then it ranks on task and tool alone
- AC-13.2 Thin function areas
  - Given a thin, empty, untagged or no-match catalog case
  - When the fallback path builds the displayed recommendations
  - Then preserve available in-area picks, then use labeled cross-area task/tool matches and unused Start-here picks according to #83's agreed weak-match policy. Do not pad with duplicates or invent relevance.
- AC-13.3 Start-here set
  - Given a thin, empty, untagged or no-match catalog case
  - When the fallback path builds the displayed recommendations
  - Then no-match searches show the available active Start-here set in deterministic date/ID order, capped by #83's agreed display policy. Distinct Start-here videos may share tasks.
- AC-13.4 Untagged videos
  - Given a video with no tags
  - When its title or description matches the goal
  - Then it can still be picked
- AC-13.5 Insufficient catalog
  - Given sample profiles, nonsense inputs and at least two valid distinct Start-here videos
  - When fallbacks run
  - Then every search returns at least two distinct picks; if fewer are available, show what exists and an honest unavailable message without duplicates or retired videos
- AC-13.6 Honest fallback results
  - Given a thin, empty, untagged or no-match catalog case
  - When the fallback path builds the displayed recommendations
  - Then short catalogs show what is available with an honest message. Reconcile the approved Start-here set with #5 and #83; no empty, thin or untagged case may introduce retired or duplicate IDs.

### Open questions

- [ ] Approve plain MVP wording before #14 ships; the optional #30 tone pass must not block fallback messages.

### Evidence required

- Test: deterministic cases for nonsense inputs, one match, missing Start-here flags, and zero/one valid video
- Log or metric: share of searches answered by the Start-here set
- Manual check: search for "asdf" on a preview
- Rollback signal: empty results despite a valid Start-here set; an empty catalog requires a data fix, not invented picks
- Review: acceptance evidence names the tested release or document version, unresolved failures and follow-up owners. Updating this specification does not mark the implementation complete.
