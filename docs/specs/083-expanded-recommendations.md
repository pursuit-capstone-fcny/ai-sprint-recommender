## #83 Show 6–8 recommendations per search

Owner:

Status: Draft

Date: Oct 29, 2026

Source: [Spec library](https://fcny-spec-library.jason-zeng94.chatgpt.site/#spec-83)

### Problem

- The implementation and linked specs default to three results. Eliot confirmed a 6–8-result discovery experience.

### Goal

- Show 6–8 eligible distinct recommendations when available, with consistent rules/model/fallback behavior and honest smaller sets.

### Work order

- **Priority:** P1
- **Track:** Revised core experience
- **Next action:** Agree exact default/weak-match/expansion policy, then coordinate UI, engine, model and event changes.
- **Development dependencies:** Existing #11/#13/#14/#16 foundations; #8 decisions; develop with #82.
- **Release / validation gates:** #19 must score the final displayed set; six results is not an automatic model-validity threshold.

### Non-goals

- Padding with duplicates or invented relevance.
- Replacing the original top-three quality benchmark or changing approved judgments to raise scores.

### Acceptance criteria

- AC-83.1 Initial recommendations
  - Given validated ranked recommendations and the agreed display policy
  - When the page renders, expands or replaces a result set
  - Then A search shows 6–8 eligible, distinct videos when available.
- AC-83.2 Small result sets
  - Given validated ranked recommendations and the agreed display policy
  - When the page renders, expands or replaces a result set
  - Then Smaller eligible sets display without duplicates or invented matches.
- AC-83.3 Shared result policy
  - Given validated ranked recommendations and the agreed display policy
  - When the page renders, expands or replaces a result set
  - Then Agree one result-count policy across rules, LLM output, weak matches, Start-here fallbacks and Show more.
- AC-83.4 Accurate events
  - Given validated ranked recommendations and the agreed display policy
  - When the page renders, expands or replaces a result set
  - Then Search events, impressions and accessible announcements reflect the displayed results.
- AC-83.5 Resubmission
  - Given validated ranked recommendations and the agreed display policy
  - When the page renders, expands or replaces a result set
  - Then Resubmission resets results and playback without duplicate events.
- AC-83.6 Quality evaluation
  - Given validated ranked recommendations and the agreed display policy
  - When the page renders, expands or replaces a result set
  - Then Update #19's evaluation for the expanded results while preserving the original top-three score for comparison.

### Open questions

- [ ] Confirm the exact default within 6–8 and Show-more behavior.
- [ ] Agree how weak matches and Start-here picks fill thin sets and what happens when fewer than six eligible videos exist.
- [ ] Agree the additional full-set quality metric with Ali or Eliot.

### Evidence required

- Test: counts around the chosen default, 0–5 eligible videos, duplicates, retired IDs, fallback sets, expansion and resubmission.
- Log or metric: displayed resultCount, one impression per video/search context and original top-three plus approved full-set evaluation.
- Manual check: signed-out rules/model/fallback results on desktop and mobile; expansion makes no extra paid call.
- Rollback signal: duplicate/invalid picks, misleading padding or degraded relevance; use the last validated display policy.
