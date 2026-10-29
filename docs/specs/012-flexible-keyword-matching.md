## #12 Add flexible keyword matching

Owner:

Status: Draft

Date: Oct 29, 2026

Source: [Spec library](https://fcny-spec-library.jason-zeng94.chatgpt.site/#spec-12)

### Problem

- Exact word matching misses most real searches: people type "deck", misspell "fundraising", or ask about tools the library doesn't cover, like Claude Design (FR-004).

### Goal

- In the rules path used by #43, goal words are widened with the synonym table, small typos still match, and unknown tools fall back to adjacent ones.
- Aligned with GitHub #12 after the midpoint requirements update. #82 covers text-first discovery, #83 covers 6–8 results and #84 covers branding.

### Work order

- **Priority:** P1
- **Track:** Complete matching
- **Next action:** Finish Sheet-driven synonyms, adjacent tools and bounded typo handling.
- **Development dependencies:** #6 mappings, #9 snapshot and #11 engine.
- **Release / validation gates:** Keep the rules path usable independently of LLM enablement.

### Non-goals

- LLM calls in this keyword matcher; #43 owns MVP semantic ranking. Embedding-based search remains out of scope.
- Changing the ranking order from #11.

### Acceptance criteria

- AC-12.1 Synonyms
  - Given the goal "make a deck"
  - When the engine matches
  - Then presentation videos are matched through the synonym table (#6)
- AC-12.2 Normalization and typos
  - Given goal words, canonical tags or aliases
  - When matching runs
  - Then it case-folds, trims and tokenizes punctuation, matches whole words or phrases, and allows one edit only for tokens of at least five characters; "fundrasing" matches fundraising, and exact/alias matches take precedence
- AC-12.3 Uncovered tools
  - Given a dictionary tool without a catalog video, or a tool name in goal text
  - When matching finds its canonical alias or an unambiguous typo match
  - Then only explicit #6 adjacency supplies related tools, marked as related; "Claude Design" needs a mapping. Without one, other input signals and #13 fallbacks still apply
- AC-12.4 Synonyms from the Sheet
  - Given Eliot adds a synonym row
  - When the catalog endpoint (#9) next serves it
  - Then matching uses it with no code change
- AC-12.5 Flexible matching
  - Given validated Sheet vocabulary and synthetic search examples
  - When the rules matcher processes a query
  - Then use the validated #9 mapping snapshot rather than hardcoded vocabulary. Test exact/alias precedence, bounded typos, unfamiliar/adjacent tools and false positives; invalid mappings must not crash ranking.
- AC-12.6 Flexible matching
  - Given validated Sheet vocabulary and synthetic search examples
  - When the rules matcher processes a query
  - Then verify this deterministic matcher remains available when #43 is disabled, times out or fails.

### Open questions

- [ ] Confirm a short, tested stop-word list and phrase precedence with #7; tied fuzzy tool matches should remain unmapped rather than choose arbitrarily.

### Evidence required

- Test: engine tests for each AC on the fixture
- Log or metric: share of searches that hit the no-match fallback
- Manual check: try five synthetic misspellings and one ambiguous tool name
- Rollback signal: typo matching produces wrong picks in the golden test (#19); tighten the tolerance
- Review: acceptance evidence names the tested release or document version, unresolved failures and follow-up owners. Updating this specification does not mark the implementation complete.
