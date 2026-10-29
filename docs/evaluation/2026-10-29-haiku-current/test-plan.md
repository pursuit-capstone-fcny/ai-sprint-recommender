# Haiku 5.5 with the current catalog and selector

Jason requested another Haiku benchmark after the Luna reliability run.
Use the remaining **$0.558499** of the October 26 $1 comparison allowance.
Do not increase it or reopen the expired October 21 Haiku allowance. The existing
Durable Object and hashed spend chain retain the **$0.441501** prior ceiling,
including every unknown reservation. Both models use this shared counter.

Run `claude-haiku-5-5`, medium effort, thinking disabled, with the same V7 prompt,
full 89-video catalog and strict rank-slot schema. This was already the best
historical Haiku prompt configuration. The new comparison adds the completed
task tags, corrected selector, catalog refresh and final usage accounting.
Keep all profile inputs, ideal/good labels and the two-primary-task gate unchanged.
Benchmark fingerprint:
`298ffdb6199c3a8bdb9ef48063ccfc4e16ca5efda14267a240c93d42d20b6d09`.

- Use the existing deployed test endpoint and three fresh ten-profile trials.
- Include the same two wording regression probes, nonsense and injection probes,
  reported separately. Reused wording is not unseen validation.
- Keep the 4.5-second server and five-second client deadlines, no paid retries,
  no prompt-cache directives and no result cache.
- Reserve **$0.006756** before each call from a 65,000-input / 512-output token
  bound. At most 34 calls reserve **$0.229704**, within the remaining allowance.
- Bind approval to the exact clean source, workflow run and attempt. Verify
  Anthropic model access/capabilities without generation before enabling calls.
- Save final measured usage, unknown reservations, failures and durable budget
  readback. Disable the endpoint and remove test keys afterward. Production
  LLM calls and usage logging remain disabled, as does test usage logging.

The [current Haiku price](https://platform.claude.com/docs/en/models/haiku-5-5/overview)
is $0.10/M input and $0.50/M output below 100,000 prompt tokens. The conservative
input bound stays below that tier threshold. Costs are token-based estimates,
not provider invoices.

Compare against [Luna's fresh deployed run](../2026-10-29-luna-reliability/results.md):
10/10, 9/10, 9/10; 34 calls cost $0.042546, about $0.001251 per call.
The historical Haiku V7 run cost $0.069949 for 34 calls, about $0.002057 each.
Its reported 10/10 scores used the old selector and cannot establish current
readiness. The saved Luna run and this new Haiku run occur at different times;
latency and sampling differences are not a randomized head-to-head experiment.

The first attempt, [40924730321](https://github.com/pursuit-capstone-fcny/ai-sprint-recommender/actions/runs/40924730321),
rejected every request before provider dispatch. The full tagged catalog's
conservative wire bound was 60,102–60,150 tokens, just above the old 60,000
limit. Its durable budget increase was zero. A regression test reproduces this
with the full benchmark; a 65,000 bound now covers it without changing or
truncating the input. Preflight checks every profile before deployment.
The failed run's saved requests are deployment evidence, not Haiku quality results.
