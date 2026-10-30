# Luna V10 transport and diagnostic rerun

Jason requested timeout and diagnostic fixes, then one #19 rerun within the
remaining $0.323446 of the shared $1 allowance. The cumulative ceiling is
$0.676554, including $0.175000 of unresolved reservations. All prior captures
and charges stay intact. Thirty benchmark calls plus four probes reserve at
most $0.238000. No paid retries or budget increases.

Keep GPT-6 Luna low, standard processing, V10 instructions, eight-slot output,
full catalog, frozen labels and the two-real-primary-task gate. Keep the
4.5-second server and five-second browser deadlines. Fingerprint:
`298ffdb6199c3a8bdb9ef48063ccfc4e16ca5efda14267a240c93d42d20b6d09`.

The adapter requests streaming and reads authoritative terminal output/usage,
without waiting for transport close or cancellation acknowledgement. Partial
text cannot establish success. Bounds, aborts, model/usage validation and
conservative unknown reservations remain enforced. Header/body timings separate
provider wait from body delivery. The [OpenAI terminal event contract](https://developers.openai.com/api/reference/resources/responses/streaming-events#response.completed)
defines the completion boundary; it does not guarantee a five-second response.

The authenticated test runner captures bounded diagnostics from response
headers, with console delivery as a supplementary source for late accounting.
Only the exact approved endpoint receives the temporary rate credential;
redirects are rejected. No goals, raw headers, model text or credentials enter
the saved diagnostics. Public and production requests cannot receive them.
[Cloudflare real-time logs](https://developers.cloudflare.com/workers/observability/logs/real-time-logs/)
are a delivery channel, not the sole source of complete benchmark evidence.

After a timeout, transport failure or rate limit, wait 61 seconds before the
next independent case. Preserve the failed score and reservation; never retry
that case. Record waits separately from latency. This avoids testing the next
profile against a still-held concurrency lease. The production concurrency
rules and budget object do not change. The existing ten-minute runner and
approval-expiry limits still bound the full run.

The unpaid reproduction command is:

```sh
pnpm exec vitest run server/luna.test.ts -t 'bounded transport and complete evaluation evidence'
```

Before the fix, both tests failed in under one second: a terminal response
stalled and an authenticated response lacked diagnostics when console delivery
was dropped. Both pass afterward. These synthetic tests establish failure-mode
coverage, not proof that transport close caused the historical live timeouts.
The fresh run must measure whether timeouts remain. Real workerd also exercises
a terminal stream that never closes or acknowledges cancellation, without any
external model request.

Save all three ten-profile trials and the same four reused probes. Preserve
original top-three scoring and separately report expanded sets; full-set
quality remains pending client review. Failed runs and missing evidence stay
visible. Always disable test calls, read the durable balance, remove test keys
and temporary approval/trigger afterward. Production LLM calls and usage
logging, and evaluation usage logging, stay disabled.

The first execution, run 40998381725 attempt 2, dispatched zero paid calls.
All 34 requests and four warmups have diagnostics, but period budgets blocked
model calls: monthly deployed spend was $0.338919 while a mistaken monthly cap
was set to the remaining $0.323446. That subtracts prior spend twice. Both
period caps now use the original $1 ceiling. The unchanged cumulative cap and
$0.676554 floor still allow only $0.323446 more. Counters, reservations and
historical charges are not reset. A regression test reproduces the block and
proves the corrected config still rejects a request exceeding $1 total. The
zero-spend run is preserved; it is not model quality evidence.

The funded run 40999051079 attempt 2 scored 4/10, 9/10, 10/10. All 34 request
diagnostics and four cache-check diagnostics were captured. Six first-trial
timeouts remain. One spent its deadline in Luna; five spent most or all of it
reading the catalog after the 61-second cooldown expired the 60-second cache.
The cooldown now reloads and verifies the catalog through the unpaid route
before the next independent case. Recovery loads and diagnostics are saved
separately and required for complete evidence. Failures still count; no paid
call is retried. This changes evaluation pacing, not the endpoint's freshness
or deadline, and does not establish idle-browser or cold-cache performance.

The funded run charged $0.055228: $0.034228 measured usage and $0.021000 of
unknown reservations. The cumulative ceiling is $0.731782 with $0.196000
unresolved. One corrected full run can reserve at most $0.238000 within the
remaining $0.268218. Keep every prior result and charge, including this failed
trial. No model, prompt, labels, task tags, diversity gate or cap changes.
