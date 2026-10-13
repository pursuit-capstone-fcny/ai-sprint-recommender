# Change Proposal: Suggest video metadata from pasted YouTube links

Owner: Jason Zeng
Status: Draft
Date: 2026-10-12
Issue: #51

## Problem

- Eliot maintains the catalog by hand: typing a title, description and tags for every video is slow, and hand-typed tags drift away from the tag dictionary (#4) that matching depends on.
- LLM output must never reach picks unreviewed, and the LLM must only see approved context.

## Goal

- Eliot pastes a YouTube link on an Intake tab; drafts (title, description, tags) appear in review columns; her explicit approval is the only path into the catalog, and approved rows pass the #9 catalog contract before import.

## Non-goals

- Direct video upload (post-MVP: YouTube's default quota allows roughly six uploads/day; link-first decided Oct 11)
- Speech-to-text (YouTube's own auto-captions are the transcript source; no STT spend)
- Any write to the catalog tab without Eliot's approval (suggest-only, always)
- The daily staleness digest (folded into #38)

## Acceptance Criteria

- AC-51.1 Link intake: Given a valid YouTube URL pasted on the Intake tab, When processing runs, Then the row becomes `Drafted` with drafts filled; Given a cell that is not a YouTube URL, When processed, Then the row is `Failed` with reason "not a YouTube link" and the run continues.
- AC-51.2 Transcript from YouTube: Given the video has captions, When processed, Then the transcript is fetched via the YouTube API and used for drafts; Given no captions, Then drafts come from the video's existing title/description and the status includes `needs-manual`.
- AC-51.3 Dictionary tags: Given a transcript and the tag dictionary, When the LLM drafts tags, Then every proposed tag is a dictionary tag and out-of-dictionary ideas land in a separate `new tag ideas` column, never in `tools`/`tasks`.
- AC-51.4 LLM perimeter: Given the LLM call, When it runs, Then it receives only the transcript (or metadata fallback) and the tag dictionary, has no tools, and returns structured JSON; Given an unparseable or incomplete response, Then the script retries once and then marks the row `Failed` with the reason.
- AC-51.5 Suggest-only writes: Given a row Eliot marks `Approved`, When import runs, Then the row is validated against the #9 catalog contract and appended to the catalog tab; Given a row in any other state, Then nothing is ever appended; Given an approved row fails the contract, Then it lands on the Problems tab and the intake row shows `Failed` with the reason.
- AC-51.6 Duplicates: Given a video ID already in the catalog or already in-flight on the Intake tab, When the same link is pasted, Then the row is `Failed` with reason "duplicate" and the catalog is never appended twice.
- AC-51.7 Test split: Given CI, When tests run, Then link parsing, prompt building, response parsing, dictionary filtering and the duplicate check are portable functions under `apps-script/` tested by Vitest on frozen fixtures, and only the thin adapter (UrlFetch, Sheets I/O, Script Properties) is verified manually in the deployed script.

## Open Questions

- [ ] Menu action "Process intake now" for v1, time-driven processing later - OK?
- [ ] Row states `Pending → Drafted → Approved → Imported`, plus `Failed` with reasons - OK?
- [ ] Prompt built from one `IntakePrompt` type (transcript, dictionary) so the perimeter is a type, not a convention - OK?

## Evidence Required

- Test: Vitest suite for the portable functions on frozen fixtures; no network, LLM or Sheet in CI.
- Log or metric: the intake row's status column distinguishes failure reasons (quota, LLM, parse, duplicate, not-a-link); Problems tab entries for failed imports.
- Manual check: live run in the deployed script on a test video with captions and one without; verify drafts, approval, and import.
- Rollback signal: repeated import-time contract failures or Eliot reporting wrong picks after imports - disabling the menu action stops inflow with no code revert.
