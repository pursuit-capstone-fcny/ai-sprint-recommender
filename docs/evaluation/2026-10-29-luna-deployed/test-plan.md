# Luna low deployed validation

Jason authorized deployment to the existing test endpoint and #19 validation
on October 29. Production LLM calls and usage logging remain disabled.

Use GPT-6 Luna, low effort, standard reasoning, catalog-rank-v7 and the unchanged
October 28 tagged benchmark. Fingerprint:
`298ffdb6199c3a8bdb9ef48063ccfc4e16ca5efda14267a240c93d42d20b6d09`.
No label, catalog, selection or distinct-task gate changes are part of this run.

Run three fresh trials of ten profiles against the deployed Worker, then two
new wording probes and nonsense/injection probes. The four probes are separate
from the ten-profile denominator. Ali/Eliot review remains pending.

The original Luna $1 allowance has a $0.337635 prior ceiling, leaving at least
$0.662365. Reserve $0.007 before each provider request. The 34 planned calls can
reserve at most $0.238. Daily/monthly caps do not reset the cumulative $1 limit.
Input is capped at 60,000 tokens; output at 2,000 including reasoning. No paid
retries or cached responses. Server deadline stays 4.5 seconds, client five.

Before enabling, verify the exact clean source, workflow run/attempt, unexpired
approval, benchmark fingerprint and hashes of all prior spend captures. Check
disabled calls, sanitized diagnostics and synthetic deployed failures without
provider calls. Tail diagnostics retain counts, costs, timing and versions only.

Afterward disable calls, save the durable cumulative budget, remove test
provider/rate-key bindings and the one-time GitHub approval. Save fresh reports
without overwriting earlier evidence. The test URL keeps the new code, with
paid calls disabled after this bounded run. Production configuration and the
benchmark labels remain unchanged regardless of the measured score.

## First deployment attempt and correction

Run 40908665576 attempt 2 reached the deployed endpoint but failed validation.
Two calls returned provider-error; retained unknown reservations exhausted the
concurrency slots, and the remaining 32 benchmark/probe requests fell back.
The recorded benchmark scored 0/10 in all trials, with incomplete diagnostics.
This is a failed deployment, not a Luna quality comparison.

A local workerd reproduction through the actual adapter fails before outbound
network I/O because Workers does not support `redirect: error`. The adapter now
uses `manual` and rejects non-2xx responses, including redirects. The regression
command `node scripts/test-luna-runtime.mjs` makes no external requests. Request
body, model, prompt, selection and benchmark remain unchanged.

The durable ledger conservatively retains $0.014 for the failed attempt.
Cumulative ceiling is $0.351635, leaving at least $0.648365. The next clean
revision/run will bind a new one-time execution record to the same existing
user allowance. It repeats the full 30 fresh trials and four separate probes,
with at most $0.238 in new reservations. The failed capture remains immutable.
