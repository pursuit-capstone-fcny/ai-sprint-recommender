# Luna timeout and diagnostic fixes

The corrected Luna low run scored **9/10 in all three trials**. Every request
and unpaid cache-check diagnostic was captured. One provider timeout remains,
so complete measured usage and full #19 validation remain incomplete. Production
LLM calls and usage logging stay disabled.

| Run                                | Top-three scores | Benchmark timeouts / rate limits | Request diagnostics | New allowance charge |
| ---------------------------------- | ---------------- | -------------------------------- | ------------------- | -------------------- |
| Previous V10, 40995485497          | 4, 0, 0          | 2 / 24                           | 18/34               | $0.018873            |
| Streaming and headers, 40999051079 | 4, 9, 10         | 6 / 0                            | 34/34               | $0.055228            |
| Catalog recovery, 41000470999      | 9, 9, 9          | 1 / 0                            | 34/34               | $0.046867            |

All runs used the same frozen labels, catalog, V10 prompt, eight-video cap and
two-real-primary-task gate. Scores count the first three displayed cards;
rules fallbacks never count as LLM passes. Rules remains 8/10. The initial
zero-spend run 40998381725 is also preserved. Its budget denials are not model
quality evidence.

## Fixes and remaining timeout

Luna now reads authoritative streaming completion and usage without waiting
for the connection to close or cancellation to acknowledge. Partial output
cannot pass. Synthetic tests reproduce the old stall and pass with the fix.
They establish coverage for that failure mode, not its frequency in live calls.

Authenticated test responses carry bounded diagnostics, including provider
header and body timings. The runner captures these directly and merges late
accounting from console logs. It sends the temporary credential only to the
exact approved endpoint and rejects redirects. Public and production responses
cannot expose these headers.

The first funded run exposed a second cascade. Waiting 61 seconds for an
unknown reservation's concurrency lease expired the 60-second catalog cache.
Five subsequent calls spent most or all of their deadlines reading the Sheet.
The runner now reloads and verifies the catalog through the unpaid route after
each cooldown. It saves recovery evidence separately and stops if verification
fails. Failed paid calls are retained and never retried within a trial. Catalog
freshness, concurrency limits and the 4.5-second server deadline are unchanged.

In the corrected run, catalog reads took at most 19ms, with no catalog timeouts,
rate limits or invalid responses. The first Leadership-01 request still timed
out after 4.295 seconds in the provider, including 1.225 seconds to headers.
Its terminal usage never arrived. The original failure remains in the score,
and its full $0.007 reservation remains charged. This is unresolved provider
latency, not a missing diagnostic. Warm-cache evaluation does not establish
performance after a real visitor leaves the page idle or the cache is evicted.

## Quality and evidence

The final source was `be17fb4389a8e46777553f2daf28a5403d806873`, tested in
[run 41000470999, attempt 2](https://github.com/pursuit-capstone-fcny/ai-sprint-recommender/actions/runs/41000470999/attempts/2).
The [fresh report](runs/41000470999-2/comparison/report.md) and
[accounting audit](runs/41000470999-2/state/accounting-audit.json) retain the
failed request and incomplete usage. Workflow success does not override those
flags or grant production approval.

- 29/30 benchmark calls returned accepted LLM lists. Of these, 23 displayed
  six to eight videos and six displayed fewer. Every list stayed at or below
  eight. Full-set quality still needs client review.
- Leadership-01's timeout caused the first-trial miss. Fundraising-02 had only
  one labeled good pick in trials two and three. Other profiles met the
  original two-good-picks threshold in each accepted LLM response.
- Both reused wording probes had two good top-three picks. Nonsense and goal
  injection returned empty model lists and used rules. Reused wording is not
  unseen validation.
- All 34 request headers, four initial cache-check headers and the additional
  recovery cache-check header were saved. No diagnostic IDs are missing.
- Median client latency was 1.381s, p95 3.634s and maximum 4.541s. The 61-second
  cooldown and unpaid catalog recovery are recorded outside request latency.
- All 589 tests, typecheck, lint and build pass. Local workerd transport checks
  made no external requests. All 15 hosted synthetic failure checks pass.

The fingerprint remains
`298ffdb6199c3a8bdb9ef48063ccfc4e16ca5efda14267a240c93d42d20b6d09`.
Historical results, labels and task tags are unchanged. Complete usage, reliable
deadline performance, expanded-set review, semantic and weak-profile review,
unseen wording, production approvals and demo evidence remain pending.

## Allowance and shutdown

The corrected run measured $0.039867 across 33 calls and retained $0.007 for
one unknown call, a $0.046867 allowance charge. This task's two funded runs
charged $0.102095 in total, including $0.028000 of new unknown reservations.
The zero-spend diagnostic run charged nothing.

The cumulative ceiling is **$0.778649**, including **$0.203000** of unresolved
reservations. **At least $0.221351 remains** of the unchanged $1 allowance.
That is below the $0.238000 maximum reservation needed for another full
34-request run. No further paid calls were made. Costs are usage estimates,
not invoices; unknown charges were not refunded to make another run fit.

Both test configs carry the final balance. Daily and monthly ceilings remain
the original $1; the cumulative cap and carried floor enforce the remainder.
Previously shrinking period ceilings to the remainder counted prior deployed
spend twice. Regression tests cover that correction and the unchanged $1 cap.

The test endpoint was confirmed disabled at 04:05:52 UTC on October 30, and its
provider and rate keys were absent after cleanup. An independent unpaid check
also confirmed shutdown. The temporary approval and trigger label are removed.
Production remains static commit `5f630024b9e662018d430fba0dc92311a5507132` with
LLM calls and usage logging disabled. Evaluation usage logging stayed off.
