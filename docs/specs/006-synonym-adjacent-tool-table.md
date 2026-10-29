## #6 Build the synonym and adjacent-tool table

Owner:

Status: Draft

Date: Oct 29, 2026

Source: [Spec library](https://fcny-spec-library.jason-zeng94.chatgpt.site/#spec-6)

### Problem

- People don't type the library's words ("deck" vs presentations), and they ask about tools the library doesn't cover.

### Goal

- A Sheet tab maps everyday words to tags and each tool to its neighbors, and Eliot can extend it without code.
- Aligned with GitHub #6 after the midpoint requirements update. #82 covers text-first discovery, #83 covers 6–8 results and #84 covers branding.

### Work order

- **Priority:** P1
- **Track:** Complete matching
- **Next action:** Finish maintained Sheet mappings and client-example coverage; avoid a second hardcoded vocabulary.
- **Development dependencies:** #5 catalog/dictionary and #7 examples.
- **Release / validation gates:** #12 verifies consumption and typo behavior.

### Non-goals

- The matching code that uses it; that's #12.
- AI-generated synonyms in the MVP.

### Acceptance criteria

- AC-6.1 Synonyms
  - Given a synonyms row
  - When the catalog loads it
  - Then it maps a normalized word or phrase to canonical tags with their category; "deck" and "slides" map to the presentations task
- AC-6.2 Adjacent tools
  - Given a supported task and tool pair
  - When the adjacency table is read
  - Then explicit directional rows name the source tool, related tool and applicable task; reciprocal rows make ChatGPT, Claude and Gemini neighbors for general writing
- AC-6.3 Profiles covered
  - Given the 10 sample profiles (#7)
  - When their wording is looked up
  - Then every profile maps to at least one tag
- AC-6.4 Self-service
  - Given Eliot adds or edits a mapping
  - When the catalog next refreshes
  - Then valid rows take effect without code; unknown targets and conflicting aliases appear on Problems, and matching expands mappings once without following cycles
- AC-6.5 Maintained mappings
  - Given the approved dictionary and synthetic discovery profiles
  - When staff review the Sheet mappings
  - Then review synonyms and adjacent tools against #7's task, role, mission and unfamiliar-tool examples. Keep hardcoded vocabulary out of the maintained source of truth.

### Open questions

- [ ] Confirm two tabs, Synonyms and Adjacent tools, with #9 serving both. Include an explicit alias or adjacency for "Claude Design"; edit distance alone cannot map it reliably.

### Evidence required

- Test: engine test for "deck" finding presentation videos (#12)
- Log or metric: fallback rate before and after a synonym change; Option A logging cannot recover unmatched wording
- Manual check: Eliot adds a synonym unaided
- Rollback signal: a synonym makes picks worse in the golden test (#19); remove the row
- Review: acceptance evidence names the tested release or document version, unresolved failures and follow-up owners. Updating this specification does not mark the implementation complete.
