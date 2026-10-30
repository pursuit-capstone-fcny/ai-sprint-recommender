# Luna top-three ranking trial

Jason requested fixing Fundraising-02's misses without losing breadth, using
the remaining allowance. The prior cumulative ceiling is $0.925374, including
$0.225000 of historical unknown reservations. At least $1.074626 remains of
the existing $2 cap. Keep all charges, labels, task tags, diversity validation
and historical results unchanged. Production LLM calls and usage logging stay off.

## Reproduction and hypotheses

The saved V12 Fast run scores Fundraising-02 at 2, 1 and 1 labeled top-three
hits. Its good reference is absent in trial two and ranked fourth in trial
three. Neither result was changed by browser trimming. Lists contain 6, 6
and 4 videos; accepted six-to-eight lists across all profiles total 27/30.

Run the unpaid reproduction from the repository root:

```sh
python3 docs/evaluation/2026-10-30-luna-ranking/audit-ranking.py docs/evaluation/2026-10-30-luna-fast/runs/41094923123-2
```

It fails on the two ranking misses and the four-video list. The actual model
choice is nondeterministic; saved-output replay is deterministic but cannot
predict new choices. Fresh complete trials supply the semantic regression check.

Ranked hypotheses:

1. The model substitutes research or repeated practice for the separate need
   to anticipate the intended counterparty's questions. Explicitly separating
   those needs should promote complementary direct demonstrations.
2. Expanded-list coverage competes with top-three ordering. Prioritizing
   distinct requested activities in those three slots should preserve later
   supporting videos without displacing direct matches.
3. Browser selection drops or reorders a stronger candidate. Saved raw and
   displayed orders already agree, so a selector change is not supported.

## Candidate and fixed controls

`catalog-rank-luna-v13-fast` appends one general instruction to V12 Fast:
cover distinct requested activities first; for conversation preparation,
distinguish the counterparty's perspective/questions from rehearsal. Prefer
those demonstrations before general research or further role-plays for other
audiences. Preserve transferable supporting videos in later ranks.

The instruction contains no benchmark IDs, expected ranks, video titles or
labels. It applies to conversation preparation across function areas.
The candidate is developed against an inspected benchmark, not unseen evidence.
No relevance judgments are added. Ten request-hash checks remove only this
instruction and normalize the service tier to reproduce the original V12 hashes.
The invariant test failed before wiring the instruction into the real request.

Keep Luna low, Fast processing, all 89 catalog items, 50,000 input-token byte
bound, 1,000 output-token cap, disabled caching, the strict positions schema,
actual-tier accounting and 4.5/5-second deadlines. Haiku is unchanged.
This is a prompt-only experiment, following the [official OpenAI guidance](https://developers.openai.com/api/docs/guides/latest-model#prompting-best-practices)
to evaluate instructions on the chosen model and workload.

## Evaluation and shutdown

Run three independent ten-profile trials and the same four separate probes.
At $0.011 per maximum reservation, all 34 calls reserve at most $0.374.
Pin approval to one clean source and workflow attempt. Retain all failures;
do not retry paid cases. Further experiments require their full maximum cost
to fit the remaining allowance after every recorded charge.

Keep #19's original scoring and diversity gates. Additional outcome checks
require Fundraising-02 to pass all three trials with six to eight videos,
at least 27/30 accepted six-to-eight lists overall, at least 9/10 in every
trial, zero timeouts or invalid output, and complete diagnostics and usage.
Report per-profile changes, raw orders and the expected video's position.
Expanded-card and unseen-wording review remain separate and pending.

Always disable the test endpoint, save its durable balance, remove its provider
and rate keys, and remove temporary approval and trigger after validation.
No production deployment or flag change is authorized.

## Catalog migration during this trial

Attempt 2 of run 41097724599 stopped during its initial unpaid catalog load.
Apps Script returned `CATALOG_UNAVAILABLE` while another authorized chat was
migrating that shared test project. No benchmark request was sent and the
durable budget increased by $0. Cleanup disabled test calls and removed keys.

The migrated published snapshot has exactly the same public data, including all
89 items and tags, but its canonical serialization gives a different version
hash. The [comparison record](catalog-migration.json) records this distinction.
Do not alter the frozen benchmark or relabel historical reports to match it.

The rerun therefore uses a separate test-only Worker entry point with a copy of
the original frozen public catalog. Preflight and unit tests require exact
equality with the existing benchmark catalog. The same catalog parser, cache,
recommendation handler, provider, budget and selection still run. Only the
exact frozen source URL is handled locally; provider requests remain real.
The ordinary Worker does not serve this snapshot, and production/Haiku config
rejects it. No shared Apps Script or production configuration changes.

This isolates ranking evaluation from the concurrent migration. Catalog load
latency is no longer an Apps Script measurement, and the rerun cannot certify
the migrated catalog's end-to-end integration. Provider latency and scoring
remain measured; record the source change alongside every result.

## V13 outcome and V14 correction

Run 41099659709 attempt 2 scored 10/9/9. Fundraising-02 improved to two
passing trials, with 8/6/6 picks, but one trial still placed the direct
counterparty-question demonstration fourth behind general research and staff
practice. Accepted six-to-eight lists regressed from 27/30 to 23/30. One
Operations-01 response repeated a position and correctly fell back. All 34
charges reconciled to $0.065372, bringing the ceiling to $0.990746 and leaving
$1.009254. No timeouts or new unknown reservations occurred. Retain the failed
candidate and its complete evidence; it does not meet the experiment targets.

V14 replaces only the appended instruction. It separates candidate selection
from ordering so that a stronger top three does not shrink useful later picks.
It distinguishes anticipating the counterparty's questions from researching
questions to ask them, and keeps missing tool tags from overriding direct
content evidence. A final duplicate-position check retains the strict parser.
It contains no IDs, titles or labels. This remains benchmark-informed tuning,
not unseen validation. All previous controls and targets remain fixed. Reserve
at most $0.374 for another complete 34-call trial; no per-case paid retries.

## Final sample

V14 run 41102285741 attempt 2 scores 10/10 in all three trials and meets the
unchanged supplemental ranking/breadth targets. Fundraising-02 has both
references in its first two positions with 7/6/6 videos. Accepted six-to-eight
lists total 28/30. All 34 measured charges sum to $0.065693; both paid revisions
together cost $0.131065, leaving $0.943561. See [results](results.md) for raw
orders, the preserved zero-call setup/transport failures, unreviewed picks and
the injection probe's valid-catalog non-abstention. No further paid run is needed
for this request. Expanded-set, unseen wording and client review remain pending.
