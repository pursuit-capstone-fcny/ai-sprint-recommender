# Luna low on the deployed test endpoint

Fresh deployed trials score **9/10, 8/10, 8/10**, with rules at **8/10**.
All three meet the numeric relevance threshold. Full #19 evidence is still
incomplete: one invalid response and two timeouts remain, including one unknown
provider charge. The report keeps `relevanceEvidenceComplete: false` and
production enablement pending. Both separate wording probes have two unchanged
label hits. Benchmark labels and the two-real-primary-task gate were unchanged.

[Run 40910291157, attempt 2](https://github.com/pursuit-capstone-fcny/ai-sprint-recommender/actions/runs/40910291157)
validated source `736384a1adb3c45989a051d32c1a212c8346093d` on October 29.
The same test URL uses GPT-6 Luna low, standard reasoning, V7, a 4.5-second server
deadline and a five-second client deadline. No paid retries or response caching.
The catalog, labels and selection code match the previous direct comparison.
Fingerprint: `298ffdb6199c3a8bdb9ef48063ccfc4e16ca5efda14267a240c93d42d20b6d09`.

## Fresh results

| Measure                      | Previous direct-provider run | Deployed endpoint |
| ---------------------------- | ---------------------------- | ----------------- |
| Trial passes                 | 9/10, 9/10, 8/10             | 9/10, 8/10, 8/10  |
| Rules fallbacks              | 0, 0, 1                      | 0, 1, 2           |
| Rules baseline               | 8/10                         | 8/10              |
| Median / p95 request latency | 1.957s / 3.398s              | 2.610s / 4.530s   |

Hits among the first three displayed cards; two hits pass. Fallback cards do
not count as LLM passes. These are fresh samples, so differences include sampling
variation and deployed request overhead.

| Profile           | Rules hits | Trial 1 | Trial 2                    | Trial 3           |
| ----------------- | ---------- | ------- | -------------------------- | ----------------- |
| leadership-01     | 2          | 2       | 2                          | 2                 |
| leadership-02     | 3          | 3       | 3                          | 3                 |
| operations-01     | 2          | 2       | fallback: invalid-response | 2                 |
| operations-02     | 2          | 2       | 2                          | 2                 |
| programs-01       | 3          | 3       | 3                          | fallback: timeout |
| programs-02       | 2          | 2       | 2                          | fallback: timeout |
| communications-01 | 1          | 3       | 3                          | 3                 |
| communications-02 | 2          | 2       | 2                          | 2                 |
| fundraising-01    | 3          | 3       | 3                          | 3                 |
| fundraising-02    | 0          | 1       | 1                          | 2                 |

Operations-01 trial 2 failed output validation. Programs-01 trial 3 timed out
before catalog/budget completion, with no provider reservation. Programs-02
trial 3 timed out after its provider reservation; its $0.007 remains charged.
Both timeout responses arrived within the browser's five-second limit, at
4.532s and 4.530s. No task-diversity fallback occurred. Funder rehearsal remains
the weakest semantic profile, with one label hit in two trials and two in one.

All 34 submitted benchmark/probe request IDs and four cache warmups have
correlated sanitized diagnostics. One call stopped before provider dispatch;
32 calls have measured token cost and one retains unknown usage. No provider
response text, reasoning text, goals, IPs or credentials were captured in logs.

## Separate probes and failure checks

- The new Operations wording returned the feedback-report, feedback-analysis
  and survey-chart videos, with two hits using the existing labels.
- The new Fundraising wording returned donor role-play, interview research
  and grantee review, also with two existing label hits.
- The nonsense goal returned no model picks and used the rules fallback.
- The goal-injection probe returned only active catalog IDs. Fifteen deployed
  checks with synthetic dependencies also passed, covering malformed/unknown
  IDs, catalog-description injection, empty/retired catalogs, provider errors,
  budgets/rate limits, deadlines and disabled calls. Synthetic checks are not
  proof against every live injection.

New wording is separate from the ten-profile denominator and still awaits
Ali/Eliot review. The browser check after shutdown loaded 89 videos, named
OpenAI in its disclosure and used Standard matching with three valid cards.
Test usage logging stayed disabled.

## Failed attempt and budget

The [first deployment](runs/40908665576-2/state/luna-budget.json) failed because
Cloudflare rejects `redirect: error` before network dispatch. Two reservations
were retained; the concurrency cap blocked further provider attempts. Its
0/10 trials and incomplete diagnostics are preserved as a failed deployment,
not evidence of Luna quality. The actual-adapter workerd test reproduced the
error, then passed with `manual` redirect mode and explicit non-2xx rejection.
See [Cloudflare's Request documentation](https://developers.cloudflare.com/workers/runtime-apis/request/).
The fix does not follow redirects or retry calls, and changes no prompt content.

| Allowance accounting                     |                 Amount |
| ---------------------------------------- | ---------------------: |
| Prior cumulative ceiling                 |              $0.337635 |
| Failed deployment, retained reservations |              $0.014000 |
| Corrected run, measured token cost       |              $0.040320 |
| Corrected run, unknown reservation       |              $0.007000 |
| Added this iteration, ceiling            |              $0.061320 |
| Cumulative ceiling                       |          **$0.398955** |
| Remaining original $1 allowance          | **at least $0.601045** |

The durable budget readback equals the measured costs plus retained reservations.
Known cumulative token cost is $0.237955; cumulative unknown reservations are
$0.161000. Costs use $0.10/M input and $0.50/M output, including reasoning once;
they are estimates, not a billing export. No allowance was reset or extended.
Future workflows verify all capture hashes and the sequential budget readbacks.

## Final state and remaining review

The test endpoint retains the Luna code with paid calls disabled after the
bounded run. Both provider keys and its rate key were confirmed absent. The
one-time approval variable and trigger label were removed. No follow-up or
additional paid run is scheduled. Production remains the static release
`5f630024b9e662018d430fba0dc92311a5507132`, with production logging disabled.
No production or Apps Script deployment was made.

Local validation: 549 tests, typecheck, lint, build and an actual Cloudflare
runtime adapter test with zero external requests. The deployed workflow also
passed its failure checks and cleanup. #19 remains open for complete measured
usage evidence, timeout/invalid-output review, Ali/Eliot semantic and weak-profile
review, runtime/privacy/budget approvals, and #23 demo evidence.

[Fresh report](runs/40910291157-2/comparison/report.md),
[probe records](runs/40910291157-2/live/probes.json),
[budget readback](runs/40910291157-2/state/luna-budget.json),
[disabled check](runs/40910291157-2/state/disabled.json),
[secret cleanup](runs/40910291157-2/state/secret-cleanup.json).
