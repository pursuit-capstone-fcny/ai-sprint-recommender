# Recommendation evaluation

The evaluator scores the first three cards selected by the same functions as
the browser. Missing slots count as misses. A profile passes with two ideal or
good picks; a run passes with eight of ten profiles. Rules fallback picks never
count as an LLM pass. Each of the three LLM trials must pass separately.

The default CI benchmark is **draft fictional data**, not FCNY relevance
evidence. Its labels have not been reviewed. Issue #7 still needs ten approved
synthetic profiles and ideal/good video IDs with reasons. Do not edit labels to
raise a candidate's score.

The separate [October 21 evaluation](evaluation/2026-10-21/test-decision.md)
uses Jason's approved initial benchmark against the frozen 89-video catalog.
Its metadata-based labels and $1 test allowance do not replace Ali/Eliot's
final review. The label-triggered test workflow captures sanitized diagnostics,
then disables paid calls. It does not run in ordinary PR CI.

## CI and local checks

```sh
pnpm evaluate
pnpm evaluate --trials fixtures/evaluation/mock-trials.json
```

Both commands make zero network requests. CI runs the second command and adds
the report to its job summary. Reports are written to `build/evaluation/`.
Low rules relevance produces a warning, not a failed job. Invalid fixtures,
catalog hashes, references, trial configuration or behavioral tests fail CI.
The mock trials exercise reporting and fallback accounting. They cannot prove
model quality, even when their scores pass.

The benchmark embeds a frozen public catalog and matching configuration. Its
SHA-256 must match those contents. The profile inputs and labels contribute to
a second fingerprint, which must match each trial file and approval. Reports
also record the local Git revision, including a dirty-worktree marker. Pin that
revision when comparing rules changes; the existing rules engine's vocabulary
is code, not dynamically read from the Sheet configuration.

## Prepare live evidence

1. Resolve #7 with the benchmark owner. Replace the fictional catalog and
   labels with reviewed public data, include all function areas, and record
   `approval.status: "approved"`, `approvedBy`, `approvedAt` and `evidence`.
   Keep private inputs out of fixtures. Use synthetic goals only.
2. Freeze that benchmark and configure the separate #63 test Worker to use
   the same catalog version. Ordinary PR previews and production stay disabled.
3. Resolve #1/#8 runtime, privacy and budget decisions. Record the exact model,
   prompt, deployed candidate revision and server limits in the approval
   evidence. The server's atomic budgets and kill switch enforce spend. The
   runner does not set or raise them.
4. Save the approval JSON outside the Git checkout with the fields below.
   Obtain actual human approval; the template is not approval. The allowance
   must cover the workflow's 34 maximum request reservations. Amounts use
   microdollars, where 1,000,000 is one US dollar. Approval covers one named
   GitHub workflow run and attempt; paid entry points reject local execution.

```json
{
  "approvedSourceRevision": "approved 40-character Git commit SHA",
  "approvedWorkflowRunId": "approved GitHub workflow run ID",
  "approvedWorkflowRunAttempt": 0,
  "expiresAt": "YYYY-MM-DDTHH:MM:SSZ",
  "benchmarkFingerprint": "copy from report.json",
  "environment": "test",
  "endpoint": "https://ai-sprint-recommender-llm-test.jason-zeng151.workers.dev/api/recommendations",
  "modelVersion": "approved-model-version",
  "promptVersion": "approved-prompt-version",
  "approvedBy": "owner",
  "approvedAt": "YYYY-MM-DD",
  "runtimeDecision": "reviewed decision reference",
  "privacyDecision": "reviewed decision reference",
  "budgetDecision": "reviewed decision reference and deployed limits",
  "allowanceMicrodollars": 0,
  "maxRequestMicrodollars": 0
}
```

The placeholder dates, revision, run ID, hash and zero values deliberately fail
validation.
`approvedSourceRevision` must equal `git rev-parse HEAD` in a clean checkout,
including no untracked files. `expiresAt` is the owner's agreed UTC deadline,
checked again before every paid request with room for its five-second timeout.
The runner rejects an expired approval or a different or dirty checkout before
network access. The October 21 allowance has expired and does not authorize
another run.
Only the exact endpoint shown above is accepted, matching the workflow's
deployed Worker. Other accounts and version-prefixed URLs are rejected.
No provider key belongs in an approval, benchmark or browser environment.

## Run three fresh trials

For a future owner-authorized run, first trigger the test workflow and let its
missing-approval preflight fail without model calls. Then record approval for
that run ID and its next attempt in `LLM_EVALUATION_APPROVAL`, and rerun that
failed workflow. GitHub [increments the attempt on every rerun](https://docs.github.com/en/actions/reference/workflows-and-actions/variables).
Relabeling creates another run ID; neither action can reuse that approval.
The workflow deploys the approved checkout before invoking the paid CLI:

```sh
pnpm evaluate --benchmark /path/to/approved-benchmark.json \
  --live-approval /path/to/approval.json --allow-paid \
  --output build/evaluation/candidate
```

This sends exactly one POST per profile per trial, sequentially, with no cache,
credentials or retries and a five-second deadline. Each request contains only
function area, synthetic goal, tools and catalog version. No session IDs or
source tags are sent. A changed model or prompt stops the run immediately.
The workflow also runs four separate probes, with no extra browser window,
and bounds server expiry by the earlier of its configured and approved deadlines.
`live-progress.json` saves each completed call, including partial evidence if
the run stops. A partial file is not a passing trial and fails trial validation.

The public response does not expose spend. Export only the bounded #63 JSON
diagnostics for these requests, then join them by `x-recommendation-request-id`:

```sh
pnpm evaluate --benchmark /path/to/approved-benchmark.json \
  --trials build/evaluation/candidate/trials.json \
  --diagnostics /path/to/test-diagnostics.json \
  --baseline /path/to/prior-report.json \
  --output build/evaluation/comparison
```

The diagnostics input is a JSON array of #63 diagnostic records from the test
environment. It contains request IDs, outcome, latency, versions, tokens and
cost, with no goals or request bodies. Bounded stage timings and explicit dispatch/
final-accounting flags distinguish pre-dispatch zero cost from unknown paid usage.
The runner waits for final accounting records. Reports show missing measurements as
`null`, never zero. Uncertain paid failures may have a reservation without an
actual cost; reconcile these before approval. Repeated request IDs across
trials fail validation. Baseline and candidate must use identical benchmark
fingerprints. The comparison writes both complete reports to `comparison.json`
and shows before/after per-profile rules and LLM scores in Markdown.
Saved-input reports are replay-only, show the captured source as unknown, and
cannot certify fresh relevance. Only the workflow's newly completed requests
and matching diagnostics receive fresh source/run provenance.

## Owner review before enabling production LLM

The [Luna test deployment plan](evaluation/2026-10-29-luna-deployed/test-plan.md)
uses the same endpoint with `wrangler.luna-test.json`. Its `Validate Luna test
deployment` workflow accepts only GPT-6 Luna low, standard reasoning and V7.
The `validate-luna-test` label on #76 starts the unpaid preflight. An approved
attempt uses `LLM_EVALUATION_APPROVAL`, including `reasoningEffort: "low"`,
`priorSpendMicrodollars`, `totalAllowanceMicrodollars: 1000000`, remaining
`allowanceMicrodollars` and a `maxRequestMicrodollars` reservation of 7000.
Read the current hashed ledger in `src/evaluation/luna-ledger.ts`; never reuse
an older balance or reset the original allowance.

The cumulative Durable Object budget survives date changes and redeployments.
After shutdown the runner saves its authenticated budget readback, then removes
both provider keys and the rate-key binding. Future runs verify the entire
spend chain, including unknown reservations. Test builds name OpenAI in the
disclosure and disable usage logging. Production rejects the Luna configuration.
Run `node scripts/test-luna-runtime.mjs` to verify the actual adapter in workerd
with synthetic responses and zero external calls.

- Review two semantic-match examples and the weakest profiles with Ali or
  Eliot. Record the report, candidate revision, versions and approved limits.
- Keep reviewed new wording in a separate held-out file. Report it separately;
  it never changes the ten-profile denominator or tuning labels.
- Exercise synthetic goal and catalog-description injection, nonsense goals,
  unknown IDs, empty and retired catalogs, provider errors, rate limits,
  exhausted budgets and the five-second deadline on the test deployment.
  Confirm only active IDs render and blocked requests cause no paid call.
  Server and browser unit tests cover these branches without paid calls; this
  manual deployment check is still required.
- Verify the rules-only switch, production logging remains off, and #23 demo
  examples include LLM success and failure. Record runtime/privacy/budget
  approval and the client's relevance acceptance.

`relevanceEvidenceComplete` covers approved labels, per-run thresholds and
measured live diagnostics. It is not an enablement command. Every report keeps
`productionEnablement: "pending-owner-review"`; the evaluator never changes
deployment flags. Missing approval or evidence leaves the LLM path disabled.

Latest deployed evidence: [October 29 Luna reliability rerun](evaluation/2026-10-29-luna-reliability/results.md).
Three fresh trials score 10/10, 9/10, 9/10 with complete measured usage and no
invalid responses or timeouts. The cumulative ceiling is $0.441501; at least
$0.558499 remains. Strict validation, labels and the diversity gate are unchanged.
Client review and production approvals remain pending; test calls are disabled.

### Retest Haiku on the current catalog

The `evaluate-llm-test` label on #76 runs the current Haiku workflow, with the
same approval and shutdown process. Its approval uses `modelVersion:
"claude-haiku-5-5"`, `reasoningEffort: "medium"`, `thinking: "disabled"`, the
current shared `priorSpendMicrodollars` and remaining allowance, and
`maxRequestMicrodollars: 6756`. The 65,000-input bound includes the completed
catalog tags. Both providers verify every full benchmark request before deployment.

The existing Durable Object name and historical `luna-ledger.ts` names are
retained to preserve the counter and evidence chain. They now cover the shared
October 26 comparison allowance, including the requested Haiku rerun. Never
create a fresh per-provider counter, reopen the expired October 21 allowance,
or reuse a prior approval. Both configurations stay disabled at rest.

[Current Haiku comparison](evaluation/2026-10-29-haiku-current/results.md):
8/10, 8/10, 9/10, three diversity fallbacks and complete measured usage. Haiku
cost $0.072834 for 34 calls versus Luna's $0.042546, with lower median latency.
The cumulative ceiling is $0.514335, leaving at least $0.485665. Labels and the
diversity gate are unchanged; client review and production approvals remain pending.
