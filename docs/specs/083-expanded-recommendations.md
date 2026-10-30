## #83 Show 6–8 recommendations per search

Owner:

Status: Implementation policy confirmed; quality validation pending

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

### Confirmed display policy

Confirmed by Jason on Oct 30, 2026 in the implementation chat.

- Display all matched videos, capped at eight. If fewer than six match, append
  distinct fallback videos from the active catalog until six are displayed.
- Show fewer than six only when fewer than six eligible catalog videos exist.
  Exclude retired rows and every copy of a duplicate catalog ID.
- Rules matches use the existing strong-match classification. Keep the original
  three-slot task-diversity ordering; videos sharing a task may appear afterward.
- Model matches must pass the existing response, catalog-version and two-primary-task
  validation. Six is a display minimum, never a new model-validity threshold.
  Valid short selections receive rules-ranked fallback videos, with explicit
  fallback reasons rather than a claim that the model selected them.
- Start-here videos retain their label. Other fallback videos retain weak or
  cross-area labels in usage events and a visible fallback badge on their card.
- Show the complete set immediately. Show more is removed so it cannot exceed
  the eight-video cap or make another model call.
- One search event records the final displayed count, including fallback cards.
  One impression per video is sent for each search context. Resubmission creates
  a new context and stops playback. The accessible count describes the displayed
  set and its fallback count.

### Evaluation and release review

`src/evaluation/displayedResults.ts` scores the exact displayed set returned by
both selectors, after capping and filling. The original top-three metric still
requires two ideal/good picks, with missing slots counted as misses. It reports
all displayed IDs, known-good IDs and unreviewed IDs separately. Existing labels
are not rewritten or treated as exhaustive full-set judgments.

The #19 evaluation runner is on a separate unmerged branch. It must call this
scorer with the final `selection.results` when integrated. Existing reports stay
unchanged. Full-set judgments, fresh live evaluation and Ali or Eliot's quality
approval remain release gates, not evidence established by these fixture tests.

### Evidence required

- Test: counts around the chosen default, 0–5 eligible videos, duplicates, retired IDs, fallback sets, expansion and resubmission.
- Log or metric: displayed resultCount, one impression per video/search context and original top-three plus approved full-set evaluation.
- Manual check: signed-out rules/model/fallback results on desktop and mobile; expansion makes no extra paid call.
- Rollback signal: duplicate/invalid picks, misleading padding or degraded relevance; use the last validated display policy.

Run the offline expanded-set evaluator against the unchanged #19 benchmark and
optionally its three saved trial files in one trials envelope:

```sh
pnpm evaluate:displayed path/to/benchmark.json path/to/trials.json > expanded-report.json
```

This reuses the production selectors and emits ten rules profiles and, when
provided, three ten-profile model trials with engine/fallback metadata. Output
is explicitly marked offline replay and pending client review. It does not
replace historical reports or establish fresh live approval.
