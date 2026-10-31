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
