# Change Proposal: Implement the ranking rules

Owner: Jason Zeng
Status: Draft
Date: 2026-10-12
Issue: #11

## Problem

- Picks must be explainable, free to run, and repeatable for tuning (#19), which rules out AI in the MVP loop (FR-003: rules, not AI).

## Goal

- A pure function in `src/engine` turns catalog + intake into ordered, deduplicated picks, each carrying a one-line reason, identical across runs.

## Non-goals

- LLM or AI-assisted ranking (post-MVP, #43)
- Free-text to tags parsing (#12 - the engine consumes normalized intake)
- Empty-state UX (#13 - the engine returns the truth, the page decides)
- Freshness recusal (#38)

## Acceptance Criteria

- AC-11.1 Purity: Given the engine called with catalog, intake, and matching config, When it runs, Then it returns ranked matches with no imports of network or DOM and no clock reads; Given identical inputs, When run twice, Then results are deeply equal.
- AC-11.2 Area dominates: Given one video in the person's function area and one outside it, otherwise identical, When ranked, Then the in-area video is first.
- AC-11.3 Task beats tool-only: Given two in-area videos, one matching goal words against title/description/task keywords and one matching only a tool, When ranked, Then the task-matched video is first.
- AC-11.4 Exact beats adjacent: Given the person's tool is Excel with one video tagged `Excel` and one tagged `Sheets` (adjacent per the synonym table), When ranked, Then the exact match is first.
- AC-11.5 Ties and dedupe: Given ties on all tiers, When ranked, Then the newer `addedAt` wins; Given multiple videos covering the same task in different tools, Then top picks hold at most one.
- AC-11.6 Reasons: Given a matched pick, When rendered, Then it carries one line naming area and task in the form "In Fundraising, about grant reports".
- AC-11.7 Test discipline: Given CI, When tests run, Then every test uses `fixtures/catalog.json` only and every test name starts with the AC id it covers.
- AC-11.8 (proposed addition): Given an empty or all-filtered catalog, When ranked, Then it returns `[]` without throwing - the hook #13 builds on.

## Open Questions

- [ ] `IntakeProfile { functionArea, goalWords, tools }` as the engine input - does it match #10's form plan?
- [ ] Comparator over tiers (area, task, exact-vs-adjacent, date, id) instead of numeric weights - #19 then tunes tier order, not constants. OK?
- [ ] Keep proposed AC-11.8?

## Evidence Required

- Test: Vitest suite on `fixtures/catalog.json` only, names prefixed `AC-11.x`, including a run-twice determinism test.
- Log or metric: none by design - the reason strings are the observable artifact.
- Manual check: top-5 picks spot-checked against #7's sample profiles during #19 tuning.
- Rollback signal: relevance regression in a #19 tuning run or any fixture test failing; revert is a plain code commit.
