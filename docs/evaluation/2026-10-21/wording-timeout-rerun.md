# Wording and timeout rerun

Jason requested fixes and another evaluation on October 21, 2026, within the
remaining original $1 allowance. Benchmark labels, the 89-video catalog and
the existing wording probes stay unchanged. Production LLM calls and usage
logging remain disabled.

V7 passes all three trials at **10/10**, with wording regressions at **3/3**
and **2/3**, no timeouts and no benchmark fallbacks. Rules remain **8/10**.
The original labels are unchanged. See the V7 evidence below; V5 and V6
misses remain recorded. Production enablement is still pending owner review.

## Budget and comparison

The previous recorded cost plus maximum unknown-cost reservations is
$0.423743. This run's planning allowance is $0.50, below the remaining
$0.576257 for those recorded requests. The unchanged persistent ledger also
accounts for any other test-site use and remains authoritative.

Thirty benchmark calls and four probes reserve at most $0.212704; one browser
verification can reserve another $0.006256. No paid request retries are allowed.
The Worker, budget namespace, $1 daily/monthly caps, model, token caps, prices
and October 22 00:00 UTC expiry remain unchanged. Disable test provider calls
afterward, including after failure. Do not reset or refund unknown outcomes.

The comparison baseline is V4 revision `a1d3fa6`,
[run 39611658736](runs/39611658736/report.md): rules 8/10; LLM 8/10, 10/10 and
9/10; one duplicate-response fallback. The separate Operations wording probe
timed out without an attributable request ID; Fundraising wording scored 0/3.
These inspected wording probes are now regression examples, not unseen
validation. They remain outside the ten-profile benchmark denominator.

## Diagnosis

Replaying the saved Fundraising response reproduces 0/3 approved picks. The
relevant role-play and donor-review videos are already fourth and fifth in
the returned list, below generic prompting and AI-concern videos. Synthetic
first/middle/last and reversed-order checks confirmed correct position-to-ID
mapping. Both relevant descriptions reach the provider intact under the
500-character limit. The evidence supports a ranking-policy problem; it does
not establish whether a different model effort would help.

The previous warmup deliberately sent a wrong catalog version, forcing fresh
Sheet reads that took 3.35 seconds to beyond five seconds. Subsequent cached
checks took 3–4 ms on the server. Those warmup failures do not establish that
the later wording timeout had the same cause; its phase and actual cost are
unknown. The server and browser also shared a five-second deadline, leaving
no delivery margin for timeout responses and their request IDs.

## Candidate

`catalog-rank-v5` explicitly preserves the requested activity, output and
audience or counterparty when interpreting paraphrases. Demonstrated task
workflows rank ahead of general prompting or AI advice unless that advice is
the requested goal. All 89 candidates, their ordering, the nullable output
slots, low effort and disabled thinking remain unchanged. Runtime prompts
contain no benchmark examples, profile IDs or approved video IDs.

The test site loads its public catalog through same-origin `GET /api/catalog`.
That unpaid load validates the trusted Sheet response and warms the same
60-second cache used by recommendations. Catalog loading has a separate
nine-second server limit within the browser's existing ten-second catalog
limit. Recommendation responses have a 4.5-second server deadline within the
unchanged five-second browser deadline. This leaves delivery margin without
extending the visitor's recommendation wait. Slow or failed requests still
fall back; no finite deadline can guarantee every external request succeeds.

The evaluator follows that public catalog-loading path before each trial and
before the separate probes. It retains an invalid-area POST check to confirm
the frozen version and candidate configuration, a cache hit under one second,
and zero provider dispatch. Catalog GET timeouts may retry at most twice;
every attempt is recorded. Paid requests still have exactly one attempt.

## V5 results

[Run 39619325524](https://github.com/pursuit-capstone-fcny/ai-sprint-recommender/actions/runs/39619325524)
tested revision `9a1df76`. Rules stayed **8/10**; LLM trials scored **8/10,
8/10 and 7/10** with zero benchmark fallbacks. The third trial missed the
relevance gate. A successful workflow means complete evidence, not passing
relevance. [Saved comparison](runs/39619325524/report.md).

Both wording regressions scored **1/3** and completed in 2.304 and 1.825
seconds. The separate single browser Fundraising submission displayed
[AI suggestions](runs/39619325524/ai-browser.png) with **2/3** approved picks.
That variation is evidence against calling the wording issue solved. Neither
probe nor browser scores enter the benchmark denominator. Nonsense and goal
injection returned empty selections and used standard matching.

All 34 automated requests have matching cost diagnostics. Benchmark median,
p95 and maximum latency were **1.428, 2.212 and 2.425 seconds**. The first
unpaid catalog load took **4.684 seconds**; subsequent loads took 68–153 ms.
All four phases succeeded on their first attempt. Invalid-area cache checks
took 36–71 ms end to end, with no provider dispatch. This demonstrates the
new catalog path under observed conditions, not a guarantee after cache
expiry, eviction, a different Cloudflare location or provider failure.

The benchmark cost **$0.061722** and four probes **$0.008227**, totaling
**$0.069949** measured from usage. The browser request has unknown actual
cost and retains its **$0.006256** maximum reservation. All recorded prior
and current costs plus unknown maximum reservations total **$0.499948**,
leaving **$0.500052** of the original allowance for recorded requests. The
persistent ledger also accounts for unrelated visits and is authoritative.

All 477 tests, typecheck, lint, build and formatting passed. CI and preview
passed. All 15 deployed synthetic failure checks passed, including the
4,500 ms server timeout. The workflow confirmed test calls disabled and
removed the synthetic Worker. Production remained on `cc761a7`, with LLM
calls and usage logging disabled.

## Controlled effort comparison

V5 removed transport failures but still misses task matches. V6 changes only
Haiku 5.5 effort from low to medium, while keeping V5 prompt text, catalog
order, ten nullable ranks, disabled thinking and token caps unchanged. The
version identifies the request configuration as well as prompt text. This
isolates an inference-setting comparison from further benchmark-driven prompt
changes; no quality or latency gain is assumed.

The next three fresh trials and same four regression probes reserve at most
**$0.212704**. An optional single browser submission reserves another
**$0.006256**. Planning allowance is **$0.45**, below the remaining conservative
amount. No budget reset, paid retry, new labels or production changes. Preserve
all V5 evidence regardless of the outcome.

## V6 results

[Run 39620354628](https://github.com/pursuit-capstone-fcny/ai-sprint-recommender/actions/runs/39620354628)
tested `331a00d`. Rules stayed **8/10**; LLM trials scored **7/10, 9/10 and
6/10**, with zero benchmark fallbacks. Both wording probes scored **0/3**;
the single browser Fundraising request also scored **0/3**. Medium effort did
not establish an improvement. [Saved comparison](runs/39620354628/report.md).

All 34 calls have measured diagnostics, no request timed out, and all catalog
warmup phases completed. Benchmark median/p95/max latency was **1.450/2.541/
2.764 seconds**. Benchmark and probes cost **$0.061722 + $0.008227 = $0.069949**.
The browser call retains its **$0.006256** maximum unknown reservation.
Conservative cumulative accounting is now **$0.576153**, leaving **$0.423847**
for recorded requests. All 15 deployed synthetic checks passed, test shutdown
was confirmed and the synthetic Worker was removed. Production is unchanged.

## Final controlled input-order comparison

V7 moves the complete catalog before the function area, goal and tools in the
user JSON message. It preserves V5 system text, V6 medium effort, disabled
thinking, catalog order, metadata, output schema and all caps. The provider
receives roughly 20,200 input tokens per request. Anthropic's [long-context
guidance](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)
recommends placing long data before the query. Whether that ordering explains
these misses remains a hypothesis, not an established cause.

One final three-trial run and the same four probes reserve at most
**$0.212704**. There will be no additional paid browser submission. Planning
allowance is **$0.35**, below the conservative remaining balance. Preserve all
results, labels and prior failures; retain the original ledger and expiry.

## V7 results and decision

[Run 39621407792](https://github.com/pursuit-capstone-fcny/ai-sprint-recommender/actions/runs/39621407792)
tested revision `5e54e23`, Haiku 5.5 and `catalog-rank-v7`. Rules stayed
**8/10**; LLM scored **10/10 in each of three fresh trials**, with zero
benchmark fallbacks. No paid request was retried. The [comparison](runs/39621407792/report.md)
preserves per-profile cards, approved hits and variation.

| Candidate                     | Three LLM trials    | Operations wording | Fundraising wording | Benchmark fallbacks |
| ----------------------------- | ------------------- | ------------------ | ------------------- | ------------------- |
| V4 baseline                   | 8/10, 10/10, 9/10   | Timeout            | 0/3                 | 1/30                |
| V5 policy and timeout changes | 8/10, 8/10, 7/10    | 1/3                | 1/3                 | 0/30                |
| V6 medium effort              | 7/10, 9/10, 6/10    | 0/3                | 0/3                 | 0/30                |
| V7 catalog before intake      | 10/10, 10/10, 10/10 | 3/3                | 2/3                 | 0/30                |

The Operations paraphrase returned survey-pattern analysis, the director-ready
feedback report and CoPilot feedback analysis. Fundraising returned donor role
play and donor review in its first two cards. Their latency was **1.520 and
1.466 seconds**. These are repeated regression examples, not unseen wording
validation. All ten benchmark profiles passed in all three trials, but their
selected cards still varied. Rules still miss Communications 01 and
Fundraising 02; passing the aggregate target does not erase those misses.

Changing input order was the only provider-request change from V6 to V7.
This comparison supports that packaging change for this catalog and benchmark;
it does not establish general reliability or isolate whether low effort would
also work with the new order. Keep the evaluated medium-effort configuration.

All **34** automated request IDs have matching diagnostics and known usage.
No request timed out. Benchmark median/p95/max latency was **1.409/2.228/2.566
seconds**. The first unpaid catalog load took **4.409 seconds**, later loads
35–68 ms; all succeeded on their first attempt. Invalid-area checks took
34–59 ms end to end and dispatched no provider calls. All **15 deployed
synthetic checks** passed, including the **4,500 ms** server deadline.

Nonsense and goal injection returned empty selections and used complete rules
fallback. These probes do not establish general injection resistance. All
478 tests, typecheck, lint, build and formatting passed locally; the evaluated
revision passed CI and preview. The workflow confirmed [test shutdown](runs/39621407792/disabled.json)
and removed the synthetic Worker. The subsequent browser submission showed
[Standard matching](runs/39621407792/disabled-browser.png) without a provider
call. No V7 paid browser submission was made; its live results use the deployed
API and shared browser selection code. V5/V6 rendered AI checks remain separate.

V7 benchmark usage was **606,267 input tokens and 2,160 output tokens**, costing
**$0.061722**. Four probes cost **$0.008227**, for **$0.069949** measured total.
This task's three runs measured **$0.209847**; its two browser requests retain
at most **$0.012512** in unknown-cost reservations. Adding prior recorded
spend and unknown maximum reservations gives **$0.646102** of the original
**$1**, leaving **$0.353898** conservatively for recorded requests. These are
usage-based calculations, not a billing export. Unrelated visitors, if any,
remain accounted for by the unchanged persistent ledger. It was never reset.

Keep test provider calls off at rest. Production remains on `cc761a7`, its
October 21 04:25 UTC deployment, with LLM calls and usage logging disabled.
At this historical revision, the numeric and existing wording regression gates
passed. The October 22 review replay below supersedes that readiness claim.
#19 remains open for
Ali/Eliot's label/catalog and semantic review, fresh unseen wording checks,
production runtime/privacy/volume approval and the final #23 demo record.
Retain the ordinary rules-only deployment until those approvals are recorded.

## October 22 review fixes and unpaid replay

PR #75 now counts only actual primary task tags toward its two-task minimum.
Previously, per-video placeholders let untagged videos satisfy the gate.
The corrected selector at `10044469b63e6577e0f22c295b37bb53dbbc2dcf`
replayed the saved V7 responses against the same frozen catalog and labels.
[Replay report](review-replay/report.md) and [JSON](review-replay/report.json)
record **3/10 in each trial, with seven complete rules fallbacks per trial**.
Rules remain **8/10**. The affected profiles lack two distinct primary task
tags in their selected videos. These are reused responses, not fresh trials;
their latency, token and cost fields belong to the historical V7 requests.
The original reports remain unchanged. This replay made no provider calls.

The current LLM relevance gate fails. Catalog task coverage and selection need
review before another approved live evaluation. Do not change the frozen
labels or count the historical 10/10 result as current readiness. The original
allowance expired at `2026-10-22T00:00:00Z`; recorded cumulative spend remains
at most **$0.646102** and no extension or budget reset is approved.

PR #76 also validates actual catalog content, rejects inconsistent baseline
reports, and checks a clean approved source revision and expiry before paid
work. Shutdown removes the remote test provider and rate-key bindings even
after deployment failure. All **503 tests**, typecheck, lint, build, formatting
and the offline CI evaluation pass. The PR #75 preview loaded all 89 videos.
Production LLM calls and logging remain disabled.
