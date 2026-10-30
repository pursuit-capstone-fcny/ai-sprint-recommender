# #83 Up to eight recommendations

Status: Test policy approved by Jason on October 29, 2026.

- Given enough relevant catalog items, when a search completes, then show six
  to eight distinct cards, never more than eight. There is no further expansion.
- Given fewer eligible items, when results render, then show the smaller set
  without duplicates, invented matches or padding. Rules weak-match and
  Start-here handling retain their existing eligibility rules.
- Given model picks, when validation runs, then preserve the existing two-real-
  primary-task gate and top-three diversity ordering. Six is not a validity
  threshold. Invalid output still causes complete rules fallback.
- Given eight displayed cards, when usage logging is enabled in a test, then
  the search count and impressions reflect all eight exactly once. Resubmission
  creates a new search and resets playback; editing alone makes no model call.
- Given the frozen benchmark, when #19 evaluates results, then retain the
  original top-three score and separately record the full displayed set,
  counts, existing-label hits and unreviewed IDs. Full-set quality approval
  remains with the client; missing labels do not mean a video is irrelevant.

Production LLM calls and usage logging remain disabled.
