# GPT-6 Luna low versus medium

**Keep production LLM calls and usage logging disabled.** Low effort performed
better under the existing time limit, but neither effort met the requirement
of at least 8/10 profiles in every trial.

The [approved run](https://github.com/pursuit-capstone-fcny/ai-sprint-recommender/actions/runs/40445851804/attempts/2)
completed 60 independent provider requests on October 26, 2026, New York time.
Source: `f78fd92f34dd81afb2b0df5be39f7334af744f5e`; model: `gpt-6-luna`;
prompt: `catalog-rank-v7`; standard mode and service tier; no prompt caching.
The benchmark labels, all 89 catalog items and distinct-task gate are unchanged.

## Results

| Candidate                                       | Trial 1 | Trial 2 | Trial 3 | Rules fallbacks / 30 | Timeouts / 30 | Median / p95 latency        |
| ----------------------------------------------- | ------- | ------- | ------- | -------------------- | ------------- | --------------------------- |
| Haiku 5.5 medium, historical responses rescored | 3/10    | 3/10    | 3/10    | 21                   | 0             | 1.409s / 2.228s, historical |
| Luna low                                        | 4/10    | 5/10    | 3/10    | 18                   | 1             | 1.357s / 2.971s             |
| Luna medium                                     | 0/10    | 1/10    | 0/10    | 29                   | 19            | 4.500s / 4.502s             |

Each profile passes only when at least two of its first three displayed cards
are labeled good/ideal and the selection remains on the LLM path. Rules
fallbacks never count as LLM passes. The rules baseline remains 8/10.

Low returned 29 valid rankings; 17 were rejected by the unchanged distinct-task
gate and one other request timed out. Medium produced 11 rankings within the
deadline; ten failed the task gate. Nineteen medium requests timed out, one
with usage received just after the deadline. No returned ranking was malformed
or truncated. Increasing effort did not improve this application under the
4.5-second provider deadline.

All median values in this table average the middle two observations. The
generated run summary uses the nearest-rank p50 instead, 1.342s for
low. Timeout observations are included; the timer can fire a few milliseconds
after its nominal deadline.

## Cost and allowance

| Effort   | Requests with known usage | Input tokens | Output tokens, including reasoning | Reasoning tokens | Known token cost | Unknown maximum reservations | Conservative total |
| -------- | ------------------------- | ------------ | ---------------------------------- | ---------------- | ---------------- | ---------------------------- | ------------------ |
| Low      | 29/30                     | 327,078      | 3,695                              | 1,937            | $0.034567        | $0.007000                    | $0.041567          |
| Medium   | 12/30                     | 135,328      | 3,868                              | 3,124            | $0.015473        | $0.126000                    | $0.141473          |
| Combined | 41/60                     | 462,406      | 7,563                              | 5,061            | $0.050040        | $0.133000                    | $0.183040          |

At least **$0.816960 remains** of the new $1 allowance. Unknown provider usage
retains the full $0.007 request reservation. No failed request was retried.
Known usage averages about $0.00119 per completed low-effort request; the
conservative average including its timeout is at most $0.00139 per request.
Medium's incomplete cost coverage prevents a useful measured average across
all requests. These are token-based calculations, not a billing export.

The original expired Anthropic allowance and all its recorded costs are
unchanged. The Haiku reference comprises thirty benchmark requests costing
$0.061722, about $0.00206 per request, excluding its separate probes.

## Interpretation and evidence

Low is the better Luna candidate for further work at the current deadline.
It improved the observed pass count over the historical Haiku replay in two
trials and tied in one. This small, previously inspected benchmark does not
establish general superiority. The main remaining low-effort failure is
insufficient task diversity under the existing catalog and selection rule.
No labels or task tags were changed to improve the score.

This was an isolated provider comparison using the shared browser selector.
It did not test a deployed Luna endpoint, Apps Script, browser rendering or
unseen goals. Luna used a 2,000-token output ceiling including reasoning;
Haiku used 512 with thinking disabled. Haiku latency/cost are historical, and
its quality numbers come from the corrected-selector replay. No fresh Haiku
requests were made. None of these results grants production readiness.

- [Sanitized capture and approval](runs/40445851804-2/capture.json)
- [Low trials, diagnostics and scoring](runs/40445851804-2/low.json)
- [Medium trials, diagnostics and scoring](runs/40445851804-2/medium.json)
- [Generated summary](runs/40445851804-2/comparison.md)
- [Historical Haiku replay](../2026-10-21/review-replay/report.json)

Both saved reports reproduce exactly from the captured responses without
additional provider calls. The workflow passed all 520 tests before execution.
The one-time approval variable and trigger label were removed after completion.
The repository OpenAI secret is retained; no provider key was deployed to
Cloudflare or the browser. Production and Apps Script configurations are unchanged.
