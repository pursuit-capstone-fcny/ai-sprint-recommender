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
