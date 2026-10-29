## #11 Implement the ranking rules

Owner:

Status: Draft

Date: Oct 29, 2026

Source: [Spec library](https://fcny-spec-library.jason-zeng94.chatgpt.site/#spec-11)

### Problem

- The MVP needs a deterministic, no-provider-cost fallback when LLM recommendations are unavailable (FR-003).

### Goal

- The rules fallback for #43 uses a pure TypeScript engine that ranks videos by function area, then task, then tool, and gives each pick a one-line reason.
- Aligned with GitHub #11 after the midpoint requirements update. #82 covers text-first discovery, #83 covers 6–8 results and #84 covers branding.

### Work order

- **Priority:** P1
- **Track:** Verify and adapt matching
- **Next action:** Verify the existing engine and adapt eligible-result behavior for #83; preserve deterministic reasons.
- **Development dependencies:** #4 vocabulary and #9 catalog.
- **Release / validation gates:** #13 owns fallback filling; #19 judges the revised displayed results.

### Non-goals

- LLM ranking inside this pure engine; that MVP work belongs to #43 and #63.
- Synonyms and typos (#12) and fallbacks (#13).
- Any network or page code inside the engine.

### Acceptance criteria

- AC-11.1 Pure function
  - Given catalog, normalized intake and matching config
  - When `src/engine` runs twice
  - Then both calls return identical results without mutation, clock, randomness, network, storage or DOM access; empty input returns an empty list
- AC-11.2 Function area first
  - Given eligible active videos
  - When the rules engine sorts them
  - Then area match is the first comparator tier, task match is second, and tool match is third; a missing signal contributes no preference
- AC-11.3 Task before tool
  - Given a task match and a tool-only match in the same function area
  - When ranked
  - Then the task match comes first
- AC-11.4 Exact tool before adjacent
  - Given videos tied on area and task
  - When their tool matches are compared
  - Then exact outranks adjacent, which outranks none; the best match among selected tools determines this tier
- AC-11.5 Ties and duplicates
  - Given videos tied on all match tiers
  - When top picks are chosen
  - Then newer `addedAt` wins, null dates sort last, then `youtubeId` ascending breaks ties. For duplicate nonempty canonical task sets, keep the first; empty task sets remain distinct
- AC-11.6 Reasons
  - Given a ranked video
  - When it is returned
  - Then it carries the signals actually matched and a one-line reason; missing area or task matches are never claimed, and #13 can label fallback picks
- AC-11.7 Tests
  - Given the frozen fixture and small synthetic edge cases
  - When unit tests run
  - Then they use no live data, cover deterministic order and tier precedence, and each test name starts with its AC ID
- AC-11.8 Match eligibility
  - Given a valid active video
  - When the engine matches an intake
  - Then it is eligible only if area, task/text or exact/adjacent tool matches; #13 adds Start-here fallbacks separately. A strong match has a task/text or exact-tool match and matches the selected area, unless the area is Not sure
- AC-11.9 Expanded rules results
  - Given valid catalog items and optional normalized inputs
  - When the deterministic rules engine ranks recommendations
  - Then return enough eligible distinct matches to support #83's 6–8-result policy. Preserve deterministic order, grounded reasons and task deduplication; #13 owns fallback filling. Missing optional inputs from #82 remain valid.

### Open questions

- [ ] Confirm the proposed comparator, full-task-set deduplication and strong-match definition against #7. They settle the draft ambiguities without adding a new Sheet column.

### Evidence required

- Test: unit tests per AC, including area-only, Not sure, null dates, complete ties, empty tags and empty catalogs
- Log or metric: golden-test score (#19)
- Manual check: Ali or Eliot reads the reasons for three sample profiles
- Rollback signal: the golden-test score drops below its last accepted value
- Review: acceptance evidence names the tested release or document version, unresolved failures and follow-up owners. Updating this specification does not mark the implementation complete.
