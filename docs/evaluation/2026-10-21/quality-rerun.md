# Quality improvement rerun

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
  $0.70, conservatively below the original allowance after previous known
  calls and maximum reservations for the earlier attempts. The persistent
  ledger remains authoritative if any other test-site use consumed budget.
- Three fresh ten-profile trials, plus the same two separately scored wording
  probes, nonsense and goal injection. The wording probes were not used for
  this tuning and are repeated probes, not newly unseen validation.
- Warm only the trusted catalog. Do not cache model answers. Record every
  failed attempt and disable provider calls afterward. A one-minute window
  after the trials permits the single browser verification before shutdown.

## Candidate

Prompt/config `catalog-rank-v3` will rank the requested task and deliverable
more precisely and avoid fragile copying of video IDs. Rules matching will
distinguish specific task evidence from a single common shared word. Generic
regression tests must justify these changes independently of benchmark labels.

Results and the exact candidate revision will be added after the live run.
Neither this request nor a better score approves production enablement or
substitutes for Ali/Eliot's final review.

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
