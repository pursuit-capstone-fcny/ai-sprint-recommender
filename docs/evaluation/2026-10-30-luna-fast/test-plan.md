# V12 Fast processing trial

Jason approved an additional $1 to fix V12's provider timeouts without losing
breadth and rerun #19. The [allowance record](allowance.json) raises the deployed
Luna cumulative cap from $1 to $2. Preserve the $0.861150 prior ceiling,
including $0.225000 of unresolved reservations. At least $1.138850 is available.
Keep the same Durable Object and all historical records. No refund, reset,
production LLM calls or usage logging. Haiku and isolated comparisons retain
their earlier allowance limits.

## Evidence and hypotheses

The captured V12 run has 20/30 accepted lists with six to eight videos, four
provider timeouts and top-three scores of 7/10, 8/10 and 10/10. Its saved-output
audit remains red. All four delayed calls spent 4.300 to 4.383 seconds in the
provider; catalog reads took 11 to 19ms. Terminal output and usage are absent
for those calls. Their exact remote latency cannot be reproduced locally.

Ranked hypotheses are provider scheduling or throughput variability, additional
reasoning for broader selection, and delayed terminal delivery. Test Fast
processing first because it preserves V12's breadth instructions and token
caps. Existing transport tests verify that terminal output does not wait for
connection close. Unit tests validate request equality, tier accounting and
budget bounds; fresh trials measure remote quality and latency.

## Candidate

`catalog-rank-luna-v12-fast` sends the exact V12 request with only
`service_tier` changed from `default` to `fast`. The ten
[recorded request hashes](v12-request-hashes.json) come from V12 source
`925e4d1669a1293bdca947ae3a57f48d354a9961`. Tests normalize only the tier and
verify equality. Preserve all 89 videos, ranking fields, low effort, disabled
caching, 50,000-input-token byte bound, 1,000-output-token cap, strict output
schema, streaming, 4.5-second server and five-second client deadlines.

[OpenAI Fast mode](https://developers.openai.com/api/docs/guides/fast-mode)
supports per-request opt-in and reports the actual processing tier. Requests
can be downgraded to Standard. [Luna pricing](https://developers.openai.com/api/docs/pricing)
is $0.20 per million input tokens and $1.00 per million output tokens for Fast,
twice Standard. This is a paid latency experiment, not a latency guarantee.

Reserve at most $0.011 per request, $0.374 for all 34 calls. Accept `fast` and
`priority` as Fast responses, recording the returned tier in bounded test
diagnostics. A Standard response is rejected as Fast evidence and charged at
the Standard rate. A missing or unknown tier retains its full reservation;
it cannot establish measured cost. Keep historical reservations at their
original amounts and verify the entire allowance chain before enabling calls.

The two new preflight tests initially failed on Standard requests and the old
$1 ceiling. They now verify exact V12 payload preservation and the additional
grant. Integration tests cover tier downgrade, missing tier, rejection of
unapproved cap increases and unchanged cumulative charges after lease expiry.

## Evaluation and shutdown

Run three fresh ten-profile trials and the same four separate probes. Preserve
benchmark labels, task tags, browser selection, task-diversity gate and all
historical results. Use the V12 report as the baseline. Each trial still needs
at least eight passing profiles; rules fallbacks never count as LLM passes.
Require zero timeouts, complete measured usage and diagnostics, and at least
V12's 20/30 accepted six-to-eight lists. Report the earlier 23/30 breadth recovery
target separately. Neither breadth count changes the original scoring gate or
establishes relevance for unreviewed expanded cards.

Pin approval to one clean source and workflow attempt. Do not retry a failed
paid case or discard its score. Preserve cooldown and catalog-recovery evidence.
Always disable test calls, save the durable balance, remove test keys, and
remove the temporary approval and trigger after the run. A further trial must
reserve its entire maximum cost within the remaining authorized allowance.
