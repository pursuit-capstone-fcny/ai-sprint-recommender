# Fix selection, rerun Luna low

Jason requested a rules-regression and deduplication fix on October 28, within
the remainder of the existing $1 allowance. Production LLM calls and usage
logging remain disabled.

## Change and diagnosis

The tagged catalog exposes an overly strict one-video-per-primary-task rule.
Distinct useful videos share task categories. A minimal `[A, A, B]` selection
was reordered and truncated to two cards. Five synthetic behavior tests fail
before the fix; they cover shared categories, slot reservation and untagged
picks without consulting benchmark labels or IDs.

Preserve rank order while reserving enough initial slots for two real primary
tasks when available. Three cards can contain two videos on one task and one on
another. Demoted videos remain available through Show more. Remove the separate
truncation that equated the number of task categories with the number of cards.
Keep the initial deduplication window fixed when expanding rules results; a
separate failing UI test catches Show more reordering already visible cards.
The LLM acceptance gate still requires two nonblank primary tasks; untagged
items and secondary tags cannot satisfy it. Invalid and repeated IDs still
reject the entire response. No relevance weights, prompt or ranking tiers change.

The fixed saved-response replay restores rules from 5/10 to 8/10 and changes
Luna low from 6/10, 7/10, 7/10 to 9/10, 10/10, 9/10. This isolates selection's
effect without new provider calls. Historical captures and reports remain
untouched; derived replay evidence is saved here separately.

## Frozen inputs and fresh trial

- Use the same [tagged benchmark](../2026-10-28-task-tags/benchmark.json),
  fingerprint `298ffdb6199c3a8bdb9ef48063ccfc4e16ca5efda14267a240c93d42d20b6d09`.
  Keep every profile, ideal/good label, reason, catalog field and task tag fixed.
- Use `gpt-6-luna`, low effort, standard mode and `catalog-rank-v7` for three
  independent ten-profile trials. Keep the 4.5-second deadline, 2,000 total
  output tokens including reasoning, disabled caching and no retries.
- Carry forward $0.299860: $0.159860 known plus $0.140000 maximum unknown
  reservations. At least $0.700140 remains. Reserve $0.007 before each of at
  most 30 calls, committing no more than $0.21 against the cumulative $1 cap.
- Verify all four previous capture hashes and costs. Bind approval to a clean
  source commit, this fingerprint, one workflow run and attempt, and expiry.
  Remove the approval and trigger label after completion.
- Send only synthetic inputs and public catalog metadata, never labels or
  supporting label reasons. Save per-profile results, fallbacks, latency,
  measured usage and unknown reservations before advancing the ledger.

This inspected development benchmark is not held out. Fresh direct-provider
results still cannot establish deployed-endpoint or production readiness.
Review the remaining rules misses, semantic quality and unseen wording
separately. No production deployment or flag changes are part of this run.
