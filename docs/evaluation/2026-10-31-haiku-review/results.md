# Haiku review-pass results

No candidate fixes weak picks and short lists together. V36 ranking is restored;
the HTTP rejection diagnostic and stop-on-rejection safeguard are retained.
The remaining allowance is $0.452053. Production calls and logging stay off.

The starting V36 result scores 10/10 in all three trials with 29/30 six-to-eight
lists. One Fundraising-01 list has five videos. Three podcast-for-board-deck
appearances and other weak supporting picks remain. The
[reproduction](v36-reproduction.json) uses saved evidence and makes no paid calls.

## V38: draft review

V38 adds a bounded second review of the draft plus alternatives. It preserves
10/10 in all three trials but reduces breadth to 27/30 and 190 displayed cards.
Leadership-02 trial one has five, Operations-02 trial one has three, and
Programs-01 trial two has five. The Fundraising wording control has one labeled
hit in its first three. All three podcast flags remain. The
[expanded review](v38-expanded-review.md) also retains AI-concerns videos for a
staff conversation, a grant-flier video for application preparation and a song
for public updates. V38 is rejected as a quality improvement.

All forty requests have final measured accounting. There are 74 provider calls:
34 two-stage requests and six single-stage requests. The additional
[stage audit](runs/41250093615-2/state/stage-accounting.json) reconciles every
stage to the existing request-level accounting. No timeout, transport failure,
invalid response, duplicate or new unknown reservation occurred. Median latency
is 1,944.5ms, p95 3,272ms and maximum 3,791ms. Four instruction-only probes
abstain; mixed controls and blank browsing pass.

The failed wording check stops fresh comparison assembly. Preserve that failed
validation; the expanded review reads the original live report and is not a new
fresh comparison. Benchmark labels, goals, metadata and the task-diversity gate
are unchanged. Unreviewed picks have not been promoted to good labels.

V38 source `e086eac5723fc6393846ef4854889d9f7ab1b40c`, run `41250093615`,
attempt 2, costs $0.071940. Cumulative spend becomes $3.278613 under the shared
$4 cap, leaving $0.721387. All $0.292560 historical unknown reservations remain
charged. Preliminary attempt one made no paid calls. The workflow and an
independent probe confirm test calls are off; provider/rate keys, temporary
approval and trigger were removed before the next candidate.

## V39: independent classification, rejected request format

V39 fails on the second provider call for all ten submitted cases. First-stage
usage is measured, but review usage is unknown. The ten-minute runner deadline
stops the sequence before trials two and three or probes. There is no complete
quality result. All failed cases, diagnostics and cooldowns remain in the
[partial evidence](runs/41250737844-2/state/partial-validation.json).

The review schema incorrectly wraps each of 18 integer fields in `anyOf`.
[Anthropic documents a 16-union-parameter limit](https://platform.claude.com/docs/en/build-with-claude/structured-outputs#schema-complexity-limits).
This is a confirmed request-format defect and is consistent with the second-call
failures, though V39 did not retain the provider HTTP status. The plain integer
schema removes the unnecessary unions. A regression test fails at 18 and passes
after the correction. V40 also records only an allowlisted numeric provider HTTP
status and stops subsequent paid cases after a permanent configuration rejection.
No raw provider error is exposed or recorded.

V39 source `f50b4987e73b5f4d4ef87a4b9997912f28036132`, run `41250737844`,
attempt 2, retains ten full $0.006756 reservations, adding $0.067560. No refund
is inferred from the suspected rejection or known draft usage. Cumulative spend
is $3.346173; $0.653827 remains. Unknown reservations increase from $0.292560
to $0.360120. The run is withdrawn. Shutdown, key cleanup and an independent
disabled probe pass; temporary approval and trigger are removed.

## V40: valid classification request

V40 corrects the schema defect and completes all forty client requests, including
74 provider calls. All usage is measured and reconciled. There are no timeouts,
invalid responses, duplicates, transport failures or new unknown reservations.
Median latency is 2,284ms, p95 3,112ms and maximum 3,494ms. Scores remain 10/10
in each trial; wording, mixed controls, four injection abstentions and blank
browsing pass.

Expanded quality remains incomplete. The [review](v40-expanded-review.md) has
205 cards, 121 unreviewed appearances, seven short lists and one podcast flag.
Breadth falls to 23/30, below the fixed 24/30 audit threshold and V36's 29/30.
The three board-deck lists have five, four and five cards. V40 is not retained as
a complete quality fix. The live report is preserved; the failed breadth check
prevents fresh comparison assembly.

Source `dfb51bb448e180713c419176ccd0057740776d7a`, run `41251931104`, attempt 2,
costs $0.071110. Cumulative spend is $3.417283; $0.582717 remains under the $4 cap.
All $0.360120 unknown reservations stay charged. Shutdown, key cleanup and the
independent disabled probe pass. Temporary approval and trigger are removed.

## V41: larger review pool

V41 completes all forty requests and 74 provider calls with measured accounting,
no invalid responses, duplicates, timeouts or transport failures. Scores remain
10/10 in every trial, but breadth falls to 22/30. Eight lists are short; the
Fundraising wording control has four cards. There are 205 cards, 122 unreviewed
appearances and two podcast flags in the [expanded review](v41-expanded-review.md).
Median latency is 2,422ms, p95 3,139ms and maximum 3,777ms. All four injection
probes abstain; mixed controls and blank browsing pass. The fixed audit fails.

Source `48cd9d9138f4964d2bdb2cf300cedc004e6cab77`, run `41252434631`, attempt 2,
costs $0.078150. Cumulative spend is $3.495433; $0.504567 remains. No new unknown
reservation occurs. Shutdown and key cleanup pass; approval and trigger are
removed. The two-pass approach is withdrawn because neither review format
improves weak picks and breadth together.

## V42: task-compatible single-pass candidates

V42 removes all original review flags, including the podcast-for-board-deck
picks. The identified AI-concerns and purchasing-negotiation picks no longer
appear for a staff conversation, and grant fliers no longer appear for
application preparation. All forty requests have measured accounting, with no
invalid response, duplicate, timeout, transport failure or new unknown charge.
Median latency is 1,315ms, p95 2,146ms and maximum 2,547ms. Wording and mixed
controls, four injection abstentions and blank browsing pass.

The complete fixed audit still fails. Scores are **10/10, 9/10, 10/10** and
breadth is **27/30**, compared with V36's 10/10 each and 29/30. Fundraising-02
trial two places generic staff-conversation videos ahead of the donor-roleplay
video and gets only one labeled top-three hit. Leadership-01 trial two has five
cards, Leadership-02 trial three has three, and Fundraising-01 trial three still
has five. The [expanded review](v42-expanded-review.md) contains 212 cards and
128 unreviewed appearances. Replacements include a SOAP-note demo for course
planning, AI guidelines for grant preparation, and webinar/social-media planning
for a board deck. Removing the original flags does not establish full quality.
V42 is withdrawn; no benchmark labels or task-diversity criteria are relaxed.

Source `aea3b4931e568d0a865417745bde2bc32eef6598`, run `41253220229`, attempt 2,
costs $0.052514. Cumulative spend is $3.547947, leaving **$0.452053**.
The workflow's live/probe step passes its original acceptance threshold, but the
separate unchanged retention audit catches the score regression. Both results
remain visible. Shutdown, key cleanup and the independent disabled probe pass;
temporary approval and trigger are removed.

## Retained change and decision

Restore V36's ranking, candidate retrieval and prompt version exactly. Its
historical 10/10 each, 29/30 result is the retained baseline, not a fresh run of
the final commit. Weak supporting picks and its five-card Fundraising-01 list
remain unresolved. The review-pass and task-scope experiments are removed from
the active implementation; their source commits and complete results remain.

Retain the evaluation safeguard: record only a numeric provider HTTP error
status and stop further paid cases after a saved permanent request rejection.
No raw provider error is retained. Transient failures keep the existing cooldown
and no-retry behavior. Optional stage diagnostic fields remain readable so the
archived two-pass evidence can still be parsed. This does not change ranking.

The five experiments submitted 170 client cases. Four complete runs have 160
fully measured requests; V39's ten review failures retain their full reservations.
Recorded charges total **$0.341274**, comprising $0.273714 measured and $0.067560
new unknown reservations. All **$0.360120** cumulative unknown reservations remain
charged under the unchanged $4 cap. Nothing is refunded or repriced. Each
preliminary attempt made no paid calls; no failed case was retried or replaced.

Test calls are disabled and provider/rate keys removed. The deployed artifact is
disabled V42; branch ranking is restored V36. Production LLM calls and usage
logging remain disabled. No merge, approval, review request or follow-up was
created. The requested complete quality fix has not been demonstrated. Further
expanded-set human review is needed to distinguish useful supporting methods
from padding; these experiments add no new paid evaluation labels.

Final local verification passes: 646 tests, typecheck, lint, build and an unpaid
Cloudflare runtime check with zero external requests. The added integration
test verifies that a permanent rejection is saved before the sequence stops,
with exactly one paid-case attempt. V36's ranking and prompt, frozen benchmark
and catalog, task-diversity gate and production deployment configuration match
the turn-start revision. The latest production deployment still records both
LLM calls and logging as disabled; temporary approval and trigger are absent.
