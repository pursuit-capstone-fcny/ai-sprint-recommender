# Spec: Implement the ranking rules

- **Issue:** #11
- **PR:** TBD
- **Status:** draft, pending Jason's review
- **Depends on:** #9 (catalog contract + fixture), #4 (tag dictionary)

## Acceptance criteria

Each criterion maps to an issue AC. Anything marked **[proposed]** adds
detail the issue left open; strike it in review if you disagree.

### AC-11.1: Pure engine function

- **Given** `src/engine` exports the ranking function,
- **When** it is called with a catalog, an intake profile, and the matching
  config (tag dictionary, synonym table),
- **Then** it returns ranked matches, imports nothing, performs no network
  calls, and reads no clock.

- **Given** identical inputs,
- **When** the function runs twice,
- **Then** both results are deeply equal.

**[proposed]** Intake shape: `IntakeProfile { functionArea: string;
goalWords: string[]; tools: string[] }`, defined in `src/contracts`. #10
maps the form onto it; #12 maps free text onto `goalWords` and `tools`. The
engine consumes normalized values only, which keeps the tiers below
testable without string-matching logic inside the engine.

### AC-11.2: Function area dominates

- **Given** one video in the person's function area and one outside it,
  otherwise identical,
- **When** ranked,
- **Then** the in-area video appears first.

### AC-11.3: Task matches outrank tool-only matches

- **Given** two videos in the correct function area, one matching the goal
  words against its title, description or task keywords, one matching only
  a tool,
- **When** ranked,
- **Then** the task-matched video appears first.

### AC-11.4: Exact tool matches outrank adjacent tools

- **Given** the person's tool is Excel, one video tagged exactly `Excel`,
  one tagged `Sheets` (adjacent per the synonym table fixture),
- **When** ranked,
- **Then** the exact match appears first.

### AC-11.5: Ties and dedupe

- **Given** two videos tied on all match tiers,
- **When** ranked,
- **Then** the video with the newer `addedAt` appears first.

- **Given** three videos covering the same task in different tools,
- **When** ranked,
- **Then** the top picks contain at most one of them.

### AC-11.6: Every pick explains itself

- **Given** a video matched on function area and task,
- **When** ranked,
- **Then** its pick carries a one-line reason naming both, in the form
  "In Fundraising, about grant reports".

**[proposed]** Reason format is a pure formatter with its own test cases so
#14 renders it verbatim and #20 quotes it in the explainer.

### AC-11.7: Tests on the frozen fixture, named by AC

- **Given** the engine test suite,
- **When** it runs in CI,
- **Then** every test draws its catalog from `fixtures/catalog.json` only,
  and every test name starts with the AC id it covers (e.g.
  `AC-11.2: in-area video outranks out-of-area`).

**[proposed]** Implementation as a comparator, not numeric weights: the
comparison order is function-area match, then task match, then exact-vs-
adjacent tool, then `addedAt` descending, then `id` ascending as the final
deterministic tiebreak. Tuning in #19 changes tier order or adds tiers, not
magic numbers.

### AC-11.8: Empty input boundary **[proposed addition]**

- **Given** an empty catalog, or a catalog with nothing matching,
- **When** ranked,
- **Then** the function returns an empty array without throwing.

This is the input #13 (no-empty-results fallbacks) builds on; #13 decides
what the page shows, the engine only returns the truth.

## Notes

- Rules, not AI, rank picks in the MVP (issue summary). The LLM-perimeter
  design in ADR 0002's fallback and the future #43 work stays outside this
  issue entirely.
- All test data comes from the frozen fixture; no live Sheet calls in CI
  (data rules: fixtures hold public fields only).
