# Haiku expanded relevance and short lists

Jason authorized fixing weak expanded picks and remaining short lists, then
rerunning #19 within the existing allowance. Carry forward $2.325255 under the
unchanged $3 cap, leaving $0.674745. All $0.225000 historical unknown reservations
remain charged. Production LLM calls and usage logging remain disabled.

## Reproduction

Copy V25's saved artifacts and run the unpaid observation:

```sh
python3 docs/evaluation/2026-10-31-haiku-relevance/audit.py /tmp/fcny-haiku-v25-expanded-repro
```

It exits 1 with five short lists and four appearances of existing review flags:
Job Applications for student follow-up, AI Peer Learning Groups for a board deck,
and Transforming Print to Podcast for that deck in two trials. Provider and
displayed counts agree. The fixed quality audit passes at 25/30, so it does not
by itself detect these requested symptoms.

This separate observation does not change ideal/good labels, task tags, scoring
or the task-diversity gate. It tracks existing review concerns and short-list
counts, not a new relevance score. No case IDs, video IDs or label facts enter
the model prompt. Every other expanded pick still needs inspection.

Ranked hypotheses are broad topical matches being mistaken for useful methods,
missed preparation/follow-through methods, and failure to refill after rejecting
a weak candidate. V26 adds one nonblank-goal instruction before the breadth pass:
connect the described operation to a concrete work step, reject invented projects
or outputs, then check unused candidates for better-supported replacements.
Keep V25's breadth paragraph and all current mixed, blank and final safeguards.

## Verification and run limits

The request-wiring test fails before insertion. Removing only the new paragraph
must restore all ten V25 request hashes, historical request invariants and the
unchanged catalog/user message. The semantic regression check is the saved
observation plus a fresh full run, not the wiring assertion.

Run thirty frozen benchmark requests and ten unchanged probes using Haiku 5.5
low with thinking disabled. Keep schema, token limits, deadline, transport and
maximum reservation unchanged. Forty times $0.006756 reserves at most $0.270240.
Pin approval to the clean source, run and attempt. No paid case retries, omitted
failures, new grants, budget resets, refunds or repricing.

Retain the existing validation audit unchanged: 10/10 per trial, all controls,
at least 24/30 accepted six-to-eight lists, forty final diagnostics and reconciled
usage, no transport failure, timeout, invalid response or duplicate. For this
follow-up, separately seek no remaining short lists and no appearances of the
existing review flags. Do not declare the expanded set approved merely because
those particular flags disappear; inspect all returned picks and report limits.
Never fill the target count with unrelated content.

Archive every candidate and charge. After each run, disable test calls, save
durable spend, remove remote test keys and temporary approval/trigger. Keep
production configuration and all frozen inputs unchanged. Human review, merge
and production enablement remain manual.

## V26 result and V27 implied-work check

The first trigger captured the previous PR head and was cancelled with zero
jobs. Correct-source attempt 1 was cancelled during installation before paid
work. Attempt 2 stopped on its initial unpaid readiness request: HTTP 200 lacked
the required diagnostic header. Exact remote cause is unknown. No benchmark
case ran, durable additional spend was zero, and shutdown/key removal passed.
Attempt 3 used the same source with a new exact-attempt approval; it did not
replace a paid outcome. All preliminary artifacts remain saved.

V26 run 41218987637 attempt 3 removes all four appearances of the existing review
flags. It retains 10/10 each, all forty final diagnostics and reconciled usage,
all controls and clean reliability. However, it fails the fixed breadth target
at 23/30, with seven short lists and 190 cards. Cost $0.081568 raises the ceiling
to $2.406823, leaving $0.593177. Test calls are disabled and keys removed.

The next hypothesis is that the new relevance test treats implied preparation
and follow-through too narrowly. V27 retains the V26 paragraph and adds a check
for operations that directly help the same work even when not explicitly named
in the goal. It names general operations, not profiles, videos or label facts.
Require a direct benefit; an extra project remains ineligible. Keep all other
instructions, inputs, limits and validation targets fixed. Removing the whole
method-connection paragraph still restores V25 requests. Repeat the same forty
cases with at most $0.270240 reserved from $0.593177.

Local V26 checks initially hit an existing approval-entry test's five-second
limit under full parallel load. The isolated test and all 629 tests with two
workers pass without changing assertions or timeout limits. Candidate CI also
passes with its normal configuration.

## V27 result and V28 choice encoding

V27 run 41219954995 attempt 2 retains 10/10 each, all controls and forty final
diagnostics with clean reliability. Existing review flags stay absent, but seven
lists remain short and the fixed breadth check fails at 23/30. Total cards are 194. Cost $0.082224 brings this follow-up to $0.163792, cumulative ceiling
$2.489047 and remaining allowance $0.510953. Calls are off and keys removed.
The preliminary attempt skipped both paid steps.

More prose did not improve recall. A different hypothesis is that numeric
positions weaken the model's connection between a later selection and its
intended video. The server mapping itself is consistent; this is a model-selection
hypothesis, not a proven indexing defect. V28 keeps V27's semantic guidance and
replaces only the output-choice representation and its copying instruction.
Each required rank is an exact `position: title` string from the trusted catalog,
or null. One shared schema definition avoids repeating the full choice list.

The adapter maps only exact strings to the original IDs. Unknown choices,
mismatched number/title pairs, altered case, duplicates, numeric values in this
protocol, missing fields and extra fields reject the whole result. Known usage
still settles on invalid results; no repair, paid retry or fallback padding is
introduced. The old numeric provider path remains unchanged. Only the bounded
Haiku test candidate requests the new protocol. Browser output and the diversity
gate stay unchanged.

[Anthropic's structured-output documentation](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
supports string enums and internal schema references. It also warns that enum
capitalization can differ, so exact server validation remains necessary. Schema
acceptance and runtime quality still require live evidence; the documentation
does not establish the hypothesis.

The new adapter tests fail before implementation. They cover exact mapping in
rank order, empty/partial selections, strict failures, measured usage and invalid
trusted maps before dispatch. Real workerd tests exercise both numeric and title
choices with synthetic responses only. Restoring the numeric schema/copying
instruction and removing the method paragraph reconstructs V25 request hashes.
Catalog fields, goals and label facts remain intact.

The largest frozen request bound is 62,584 bytes against the unchanged 65,000
limit. The longest eight choice strings serialize to 604 JSON characters. Keep
the 512-token output cap, 4.5-second server deadline and $0.006756 maximum charge
reservation. The compactness test now compares the same schema/prompt with compact
versus object catalog encoding; the hard input limit is unchanged. Schema size
and output tokens may increase measured cost, and first-use schema processing may
affect latency. Record failures normally, with no hidden paid warm-up or retry.

Repeat the same forty requests with at most $0.270240 reserved from $0.510953.
Keep every fixed audit and separate follow-up observation, then inspect all picks.
