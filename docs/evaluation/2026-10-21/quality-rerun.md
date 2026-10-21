# Quality improvement rerun

Historical V3/V4 evidence. The [wording and timeout rerun](wording-timeout-rerun.md)
records the current V7 result: LLM 10/10 in all three trials, both wording
regressions passing and no timeouts. Earlier failures below remain preserved.

Jason requested quality improvements and another #19 evaluation on October
21, 2026, within the remaining original $1 allowance. The approved benchmark,
catalog and labels remain unchanged. Production LLM calls and usage logging
remain disabled.

The comparison baseline is the saved `a865d2e` run: rules 3/10; LLM 4/10,
4/10 and 3/10. Its original responses and failures remain in the repository.
The benchmark fingerprint remains
`4ab7cb1d8eaa76b1e79d0b3f0fe675740bce9da4076be8a86d63f36fda519dde`.

## Limits

- Same isolated Worker, Haiku 5.5, five-second deadline and no retries.
- Same $1 daily/monthly ledger and October 22 00:00 UTC expiry. Never reset
  storage, create a replacement budget namespace or refund unknown outcomes.
- A 34-request rerun reserves at most $0.212704. One additional browser
  verification can reserve up to $0.006256. The planning allowance is
  $0.60 for V4, conservatively below the original allowance after previous
  known calls and maximum reservations for earlier attempts. The persistent
  ledger remains authoritative if any other test-site use consumed budget.
- Three fresh ten-profile trials, plus the same two separately scored wording
  probes, nonsense and goal injection. The wording probes were not used for
  this tuning and are repeated probes, not newly unseen validation.
- Warm only the trusted catalog. Do not cache model answers. Record every
  failed attempt and disable provider calls afterward. A one-minute window
  after the trials permits the single browser verification before shutdown.
- Cold catalog timeouts may receive up to three unpaid load attempts per
  trial. Every attempt uses both a wrong catalog version and an invalid area,
  so it cannot reach provider dispatch. Preserve each timeout and still require
  the correct catalog/configuration plus a sub-second cache check before paid
  trials. Other warmup errors fail immediately; paid calls never retry.

## Candidate

Prompt/config V3 ranks the requested task and deliverable ahead of broad topic
or tool overlap, and selects catalog positions instead of copying video IDs.
V4 retains that policy and fixes the output-size defect diagnosed below.
All 89 videos remain candidates. Rules matching weights specific task evidence
above common shared words, with extra weight for titles and task tags. Generic
regression tests cover these changes independently of benchmark labels.

## V3 results

[Run 39608680366](https://github.com/pursuit-capstone-fcny/ai-sprint-recommender/actions/runs/39608680366)
evaluated `9911a6d`, Haiku 5.5 and `catalog-rank-v3` against the frozen labels.
Rules improved from 3/10 to **8/10**. LLM trials scored **4/10, 3/10 and
3/10**, with **18 invalid-response fallbacks**. The LLM quality gate failed.
The [comparison](runs/39608680366/report.md) preserves every result.

The 30 benchmark calls cost $0.049185; four separate probes cost $0.006530.
The measured total is **$0.055715**, from reported usage and approved prices,
not a billing export. Benchmark median/p95 latency was 1.305/2.050 seconds.
All 34 calls have matching diagnostics. The separate single browser submission
fell back to Standard matching and was not retried. Its cost is unknown and
bounded by its $0.006256 maximum reservation, outside the measured 34 calls.
The workflow confirmed shutdown afterward.

Before another full trial, two synthetic format probes may diagnose rejected
output. They use the existing budget ledger and reserve at most $0.012512.
Only fixed validation categories and bounded counts may be recorded, never
raw provider text. These probes are not benchmark trials. The planning
allowance is now $0.60; the original $1 cap and expiry remain unchanged.

Neither this request nor a better score approves production enablement or
substitutes for Ali/Eliot's final review.

## Format diagnosis and V4

[Run 39610228742](https://github.com/pursuit-capstone-fcny/ai-sprint-recommender/actions/runs/39610228742)
sent two approved synthetic profiles through the same budget-controlled
endpoint. Both returned 12 selections with zero malformed selection values,
exceeding the ten-selection contract. Their bounded
[diagnostics](runs/39610228742/probes.json) cost **$0.003278** in total.
Shutdown was confirmed. These probes do not count as relevance trials.

V4 keeps the task-matching policy and uses ten required nullable output slots
to enforce the size limit in the provider schema. The server still rejects
duplicates, unknown selections and malformed responses; it never truncates a
bad answer into a passing one. Three fresh trials compared against the saved
V3 report, with the same labels and limits.

## V4 results and decision

[Run 39611658736](https://github.com/pursuit-capstone-fcny/ai-sprint-recommender/actions/runs/39611658736)
evaluated revision `a1d3fa6a2a7b2f5ffe187606f6af41dafd7e9a0f`, Haiku 5.5 and
`catalog-rank-v4`. The unchanged benchmark now meets the numeric relevance
target. Each profile requires two approved picks among its first three cards;
rules and each of three LLM trials require at least eight passing profiles.
Fallback results never count as an LLM pass.

| Candidate            | Rules    | LLM trials            | Benchmark fallbacks |
| -------------------- | -------- | --------------------- | ------------------- |
| Previous V2 baseline | 3/10     | 4/10, 4/10, 3/10      | 7/30                |
| V3                   | 8/10     | 4/10, 3/10, 3/10      | 18/30               |
| V4                   | **8/10** | **8/10, 10/10, 9/10** | **1/30**            |

All 30 benchmark responses have matching usage/cost diagnostics. The single
fallback rejected a duplicate selection in full. Median/p95/max benchmark
latency was **1.488/3.116/3.625 seconds** with the catalog warmed. Two unpaid
catalog loads timed out before trial two; the third succeeded. This does not
establish acceptable cold-request latency.

The workflow still **failed its broader evidence-completeness check**. The
separate Operations wording probe timed out after 5.016 seconds without a
response request ID or attributable diagnostic. It selected rules fallback,
which is not an LLM pass. The Fundraising wording probe returned valid IDs
but scored **0/3**. These repeated probes remain outside the benchmark score
and were not used to tune this candidate. Nonsense and goal injection each
returned an empty selection and selected standard matching. These individual
checks do not establish general injection resistance.

No paid request was retried. The passing benchmark is preserved alongside the
failed probe and workflow status in the [comparison](runs/39611658736/report.md),
[probes](runs/39611658736/probes.json) and
[run status](runs/39611658736/run-status.json). The workflow confirmed provider
shutdown and removed the synthetic Worker. Its AI browser window was skipped
after the failed evidence check. A browser submission after shutdown displayed
[Standard matching](runs/39611658736/disabled-browser.png); a rendered live AI
success demonstration remains pending.

## Cost accounting

Costs use reported tokens and approved prices, not a provider billing export.

| Calls in this request        | Measured cost                 | Additional unknown-cost upper bound  |
| ---------------------------- | ----------------------------- | ------------------------------------ |
| V3 benchmark and four probes | $0.055715                     | $0.006256 for one browser submission |
| Two format diagnostics       | $0.003278                     | $0                                   |
| V4 benchmark                 | $0.061443                     | $0                                   |
| Four V4 probe attempts       | $0.006143 for three responses | $0.006256 for one timeout            |
| Total                        | **$0.126579**                 | **$0.012512**                        |

V4 benchmark usage was 603,507 input and 2,160 output tokens. Its measured
total with probes was **$0.067586**. The original allowance's earlier measured
cost was $0.059436, with up to $0.225216 reserved for unmeasured earlier calls.
Combining those with this request gives a conservative recorded upper bound
of **$0.423743**, below the original $1 allowance. This is not an exact account
balance or an assertion that unknown calls were free; the unchanged persistent
ledger remains authoritative, including any unrelated test-site use.

## Client review and remaining work

Two semantic examples for Ali/Eliot:

- Operations feedback now finds **3/3** approved videos in every trial:
  "Turn Program Feedback into a Director-Ready Report with AI", "Using CoPilot
  to Analyze Feedback" and "Uncover Patterns in Survey Data with AI". The V2
  baseline found 1, 0 and 1. Its separate wording probe still timed out.
- Funder rehearsal remains weak: **1/3, 2/3, then duplicate-response fallback**.
  "Prompt Nudges for AI" outranks the requested rehearsal workflow in the first
  two trials; only the second includes both donor role play and donor review.
  Its separate wording probe has no approved picks. Do not relabel it.

Internal FAQs pass two of three trials but repeatedly rank an inbox workflow
first. Rules still fail Communications wording with one approved pick and
funder rehearsal with none; the latter regressed from one approved rules pick.
The aggregate gain does not erase these weaknesses.

All 449 tests, typecheck, lint, build and formatting passed locally; CI and
preview checks passed on the evaluated revision. All 15 deployed synthetic
failure checks passed. Benchmark labels, catalog, repeated wording and the
budget configuration are unchanged.

Keep #19 open for Ali/Eliot's semantic and weak-profile review, wording
robustness and cold-request follow-up, production volume/budget approval and
#23 demo evidence. Neither the score nor this test allowance approves production
enablement. Production remains on `cc761a7113aba4ddb8bab3ba17f2daba35cdccfa`;
production LLM calls and usage logging are disabled. Test calls are off at rest.

## Preflight attempts

[Run 39605490096](https://github.com/pursuit-capstone-fcny/ai-sprint-recommender/actions/runs/39605490096)
stopped at the deployed synthetic checks, before enabling Anthropic. It used
no paid calls. The test endpoint was confirmed disabled and the temporary
synthetic Worker was removed. The original checker omitted the failed scenario
and HTTP status, so this attempt does not establish a cause. Its
[failure record](runs/39605490096/failure-checks.json) is preserved.

The free-only [run 39606482026](https://github.com/pursuit-capstone-fcny/ai-sprint-recommender/actions/runs/39606482026)
passed the synthetic success case, then received HTTP 404 for the known
`default-off` route just after deployment. The
[bounded diagnostic](runs/39606482026/failure-checks.json) preserves that
response status. This attempt also made no paid calls. The checker now allows
a bounded wait for synthetic-route 404/503 responses and records every
attempt; it never retries assertions or paid provider requests.

Free-only [run 39607060696](https://github.com/pursuit-capstone-fcny/ai-sprint-recommender/actions/runs/39607060696)
passed all 15 deployed checks. Its first synthetic request received 404, then
200 after a two-second wait. Every later check passed on the first attempt.
The [report](runs/39607060696/failure-checks.json) preserves both responses.
The test provider remained disabled and the temporary Worker was removed.

[Run 39607351190](https://github.com/pursuit-capstone-fcny/ai-sprint-recommender/actions/runs/39607351190)
passed the synthetic checks but stopped at unpaid readiness immediately
after enabling. The original readiness report omitted the response state.
Shutdown deployed `LLM_ENABLED=false`, but its immediate assertion saw the
older enabled handler rejecting invalid input. A separate probe then
[confirmed disabled](runs/39607351190/shutdown-confirmation.json). State
verification now waits for propagation using only blank or invalid intake,
which cannot reserve spend or dispatch Anthropic. Paid requests still have
one attempt each.

[Run 39608082503](https://github.com/pursuit-capstone-fcny/ai-sprint-recommender/actions/runs/39608082503)
confirmed state propagation but its cold catalog load hit the server's
5,000 ms deadline. No paid trial started. The
[warmup](runs/39608082503/warmups.json) and
[confirmed shutdown](runs/39608082503/disabled.json) are saved. This motivates
the bounded unpaid catalog warmup above; it does not establish acceptable
cold-request latency for production.
