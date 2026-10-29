# Luna low after fixing deduplication

Rules recovers from **5/10 to 8/10**. Fresh Luna low scores **9/10, 9/10, 8/10**,
meeting the isolated comparison's numeric target in all three trials. Benchmark
labels, task tags and the two-real-primary-task acceptance gate are unchanged.
Production LLM calls and usage logging remain disabled.

## Change and provenance

The shared selector treated a task category as a duplicate video identity.
After task-tag completion, it demoted useful same-task alternatives and even
truncated three distinct videos across two tasks to two cards. Selection now
retains relevance order while reserving slots for two real primary tasks when
available. Two same-task videos may remain in the first three. Blank and
secondary tags still cannot establish diversity; repeated, unknown or retired
IDs still reject the whole LLM response. Show more reveals demoted videos
without moving already visible cards.

Six regression failures were reproduced before their respective fixes: five
selection cases and one browser-component expansion case. Synthetic fixtures
exercise the behavior without benchmark IDs or labels. No matching weights,
ranking tiers, model prompt or timeout settings changed.

[Workflow 40804527443, attempt 2](https://github.com/pursuit-capstone-fcny/ai-sprint-recommender/actions/runs/40804527443)
ran on `ec0d3e330b7e6b6e06c9a5a58f230c56bc1b7566`, October 28 in New York
(October 29 UTC). The [plan](test-plan.md) and [unpaid replay](offline-replay.json)
were committed first. Exactly 30 fresh `gpt-6-luna` low-effort calls used standard
mode, `catalog-rank-v7`, a 4.5-second deadline, 2,000 output tokens including
reasoning, no caching and no retries. The approval was bound to that clean
commit, run, attempt and the unchanged benchmark fingerprint
`298ffdb6199c3a8bdb9ef48063ccfc4e16ca5efda14267a240c93d42d20b6d09`.

## Results

| Measure         | Before fix, fresh tagged run | Same responses, fixed selection | Fresh fixed run  |
| --------------- | ---------------------------- | ------------------------------- | ---------------- |
| Trial passes    | 6/10, 7/10, 7/10             | 9/10, 10/10, 9/10               | 9/10, 9/10, 8/10 |
| Rules fallbacks | 0, 0, 1                      | 0, 0, 1                         | 0, 0, 1          |
| Rules baseline  | 5/10                         | 8/10                            | 8/10             |
| New paid calls  | 30                           | 0                               | 30               |

The middle column isolates the selection change using previously captured
responses. The final column includes fresh sampling variation. Historical
reports are preserved with their original source versions; they must not be
silently rescored as if their selector had been the new one.

Hits among the first three displayed cards; two hits pass. `F` is rules fallback
and cannot count as an LLM pass, even when the fallback picks have two hits.

| Profile           | Rules before → after | LLM before  | Fresh LLM after |
| ----------------- | -------------------- | ----------- | --------------- |
| leadership-01     | 2 → 2                | 2 / 2 / 2   | 2 / 2 / 2       |
| leadership-02     | 2 → 3                | 2 / 2 / 2   | 3 / 3 / 3       |
| operations-01     | 1 → 2                | 1 / 1 / 1 F | 2 / 2 / 2       |
| operations-02     | 1 → 2                | 1 / 1 / 1   | 2 / 2 / 2       |
| programs-01       | 2 → 3                | 2 / 2 / 2   | 3 / 3 / 3       |
| programs-02       | 2 → 2                | 2 / 2 / 2   | 2 / 2 / 2 F     |
| communications-01 | 1 → 1                | 3 / 3 / 3   | 3 / 3 / 3       |
| communications-02 | 1 → 2                | 1 / 1 / 1   | 2 / 2 / 2       |
| fundraising-01    | 2 → 3                | 2 / 2 / 2   | 3 / 3 / 3       |
| fundraising-02    | 0 → 0                | 1 / 2 / 2   | 1 / 1 / 1       |

No provider timeout or task-diversity fallback occurred. Programs-02 trial 3
returned an invalid response and safely used rules. No raw provider response
text or reasoning was retained. All calls returned measured usage.

The remaining consistent LLM miss is funder preparation: Luna ranks the donor
roleplay first but grantee assessment fifth or eighth, behind background research
and general difficult-conversation practice. The selected first three already
have two primary tasks; deduplication does not cause this miss. Rules still misses
communications-01 and fundraising-02, as before the tag-completion regression.
These cases need semantic and unseen-wording review; labels were not revised.

## Cost and latency

- This run: **$0.037775**, averaging **$0.001259 per call**.
- Usage: 352,932 input and 4,939 output tokens. The 3,111 reasoning tokens are
  included in output, not charged twice.
- Median latency: **1.957 s**; nearest-rank p50 **1.823 s**, p95 **3.398 s**.
  These are provider-runner timings, not browser end-to-end timings.
- Across five Luna runs: **$0.197635 known + $0.140000 unknown maximum
  reservations = at most $0.337635**. At least **$0.662365** remains of the
  original $1 allowance. The expired Anthropic ledger remains separate.

Rates remain $0.10/M input and $0.50/M output from the
[official release](https://developers.openai.com/api/docs/changelog#sep-22).
Costs are token estimates, not a billing export. Every prior unknown reservation
is retained. The one-time approval variable and trigger label were removed;
no further paid run is scheduled.

Saved [capture](runs/40804527443-2/capture.json),
[approval](runs/40804527443-2/started.json),
[scored responses](runs/40804527443-2/low.json) and
[workflow summary](runs/40804527443-2/comparison.md) record the new run. JSON
formatting is normalized without changing artifact values. The ledger verifies
the committed capture hash before permitting any future authorized call.

## Validation and remaining gate

All 532 tests, typecheck, lint, build and formatting pass. The unchanged-labels
and task-tag tests pass. The code diff preserves the primary-task gate, and all
earlier benchmark snapshots and reports are untouched.

The [Cloudflare preview](https://61e7cdee-ai-sprint-recommender.jason-zeng151.workers.dev/)
loads 89 videos. The operations-01 browser check shows the report, chart and
CoPilot feedback videos, with two frozen-label hits. Keyboard Show more expands
to six cards while preserving the initial three. The preview keeps LLM calls
off and retains its existing test-only usage setting. The isolated provider
workflow makes no Cloudflare or Apps Script deployment.

Production remains on static commit `cc761a7113aba4ddb8bab3ba17f2daba35cdccfa`
with usage logging disabled. This PR is unmerged and no production flags changed.

#19 still needs three fresh passing deployed-endpoint trials, Ali/Eliot's
semantic and weak-profile review, unseen-wording checks, runtime/privacy/budget
approval and #23 demo evidence. Passing this inspected direct-provider benchmark
does not enable production or satisfy the deployed-endpoint gate.
