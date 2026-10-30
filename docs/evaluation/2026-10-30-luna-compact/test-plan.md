# Luna compact-format latency trial

Jason requested fixing the remaining provider timeout and rerunning #19 within
the remaining $0.221351. Carry forward $0.778649, including $0.203000 of unknown
reservations. No refund, new allowance, production LLM calls or usage logging.

The previous run scored 9/10 in each trial. One Leadership-01 call used 16ms
for the catalog, 189ms for budget reservation and 4.295s in the provider before
timeout. That trace isolates the delayed stage but does not identify provider
queueing, prefill or generation as the cause. It cannot be deterministically
reproduced without provider traffic. The live rerun tests a latency hypothesis;
unit tests establish protocol correctness, not a provider latency guarantee.

Ranked hypotheses are provider startup delay, redundant input processing, and
generation overhead. The chosen change reduces repeated catalog keys and output
syntax. The [OpenAI latency guide](https://developers.openai.com/api/docs/guides/latency-optimization#generate-fewer-tokens)
recommends reducing generated syntax; [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs#supported-properties)
supports bounded arrays. Neither promises a response within five seconds.

Candidate `catalog-rank-luna-v11` keeps all V10 relevance instructions and every
previous ranking field for all 89 videos. Encode rows with the explicit order
`position, title, description, functionAreas, tasks, tools`. Replace eight named
nullable output slots with one bounded `positions` array. No shortlist, extra
truncation, tag edits, labels or task-diversity changes. Keep GPT-6 Luna low,
standard processing, caching disabled, 2,000 output tokens, and the 4.5-second
server / five-second client deadlines. Haiku stays on V10; historical isolated
Luna bodies, decoders, results and reservations retain their original contracts.

The encoded full-catalog requests fit a stricter 50,000-token byte bound,
including the existing 1,024-token framing margin. Oversized requests fail
before any paid dispatch. With unchanged rates, new requests reserve at most
$0.006 each, so 34 reserve at most $0.204 within the $0.221351 balance. This is
an enforced smaller input envelope, not a lower estimate of unknown charges.
The output cap is unchanged. Old $0.007 reservations are not reduced.

Run three independent ten-profile trials and the same four reused probes.
Keep the original top-three score and separately report the at-most-eight set.
Retain every timeout and its reservation. Do not retry failed paid cases.
Keep authenticated diagnostic capture and unpaid catalog recovery after a
cooldown. Pin approval to one source and workflow attempt; stop on mismatch or
insufficient allowance. Always disable test calls, read the cumulative balance,
remove test keys, and remove the temporary approval and trigger afterward.

The compact adapter tests first failed on the old request/response contract and
then passed. Tests reconstruct every catalog field, validate all benchmark and
probe bounds, reject malformed arrays and preserve measured usage. These are
protocol tests, not a reproduction of the remote provider delay. Numeric
quality, actual latency and complete usage remain live evaluation outcomes.
