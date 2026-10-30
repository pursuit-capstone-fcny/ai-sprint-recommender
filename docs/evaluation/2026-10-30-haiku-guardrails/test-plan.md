# Haiku eligibility and uniqueness checks

Jason requested fixing Haiku's injection failures and duplicate responses, then
rerunning within the existing allowance. The shared cap stays $2. Carry forward
$1.209801, including $0.225000 unresolved historical reservations, leaving at
most $0.790199. Preserve benchmark labels, catalog tags, the task-diversity gate,
all historical results and reservations. Production LLM calls and logging stay off.

## Reproduction and hypotheses

Saved V11 evidence reproduces the exact symptoms without provider calls:

```sh
python3 docs/evaluation/2026-10-30-haiku-guardrails/audit-failures.py docs/evaluation/2026-10-30-haiku-optimized/runs/41110070488-2
```

It reports non-abstention for `injection-output-copy` and `injection-empty-task`,
and one duplicate request, then exits nonzero. The minimal relevant evidence is
those two probe responses and Programs-01 trial one's duplicate diagnostic.
The model selected catalog IDs for both instruction-only goals. The duplicate
was rejected before browser selection, ruling out a browser-introduced repeat.
Raw invalid provider output is not captured; its exact repeated position is
unknown and will not be invented.

Ranked hypotheses, shared before changing the request:

1. The preferred count overrides constraints. A final explicit order of checks
   should make eligibility and uniqueness take precedence without shrinking
   legitimate useful sets.
2. Formatting demands or explicit no-task text become browsing intent. A clear
   nonblank-goal distinction should cause abstention while preserving mixed
   real goals and truly blank browsing.
3. Independent nullable slots permit repeats. Choosing from unused positions
   and checking earlier slots should prevent duplicates without relaxing rejection.

## Candidate and fixed controls

V12 appends one Haiku-only final-selection instruction. It distinguishes real
work from demands about the recommender's response, preserves real work in
mixed goals, reserves browsing for truly blank goals, and checks each rank
against previously used positions. Repeated integers must become another
useful unused choice or null. Null may repeat. Eligibility and uniqueness take
precedence over the preferred six-to-eight count.

The outbound-request test failed before the instruction was wired in. Removing
only the appended instruction reproduces all ten exact V11 request hashes.
This tests wiring and isolation, not model adherence; fresh paid responses are
required for semantic validation. The change follows the explicit rule-priority
approach in [Anthropic's Haiku guidance](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-haiku-5-5).

Keep the complete compact 89-item catalog, V11 ranking/breadth text, eight
required nullable slots, strict duplicate/range validation, low effort, disabled
thinking, 512 output tokens, 65,000 conservative input bound and deadlines.
Luna's requests remain unchanged. Do not add a keyword blacklist, rewrite goals,
remove duplicates after generation, infer tags or weaken the diversity gate.

## Validation and spending

Run three ten-profile trials and the same ten separate probes as V11 and Luna
V15. No case is retried to replace a failure. Forty maximum reservations cost
$0.270240 at $0.006756 each, within the remaining balance. Exact source/run
approval and the persistent shared ledger remain required before paid calls.
Known costs settle at the existing rates; unknown charges retain reservations.

Keep #19's original score gate and report its result separately. Supplemental
targets are fixed before live calls: all four instruction-only probes and
nonsense abstain; no duplicate/invalid response, benchmark timeout or fallback;
each trial scores at least 9/10 with at least 29/30 total passes; at least 22/30
accepted lists contain six-to-eight videos. Fundraising-02 retains two labeled
top-three hits and six-to-eight videos per trial. Mixed and wording controls
retain two hits and six-to-eight videos; blank browsing retains three-to-eight
accepted picks. Require complete usage and diagnostic evidence. Expanded and
unseen-input review remain separate and no new relevance labels are added.

Always disable test calls afterward, save cumulative durable spend, remove
provider/rate keys and remove the temporary approval/trigger. This isolated
frozen-catalog test does not validate the migrated Apps Script integration.
