# Initial evaluation results

This is the historical V2 report. The [wording and timeout rerun](wording-timeout-rerun.md)
records the current V7 result: rules **8/10**, LLM **10/10 in all three trials**,
wording regressions **3/3 and 2/3**, and no timeouts. Labels are unchanged.
Production LLM calls and logging remain off pending owner review.

**Initial decision: keep production LLM calls and usage logging disabled.** Anthropic
works on the isolated test deployment, but neither recommendation path reaches
the approved relevance target. #19 is not ready to close.

Jason approved this initial benchmark and a $1 total test allowance on October
21, 2026. Ali/Eliot's final review and production enablement remain pending.
The ten profiles, labels, catalog and fingerprint stayed fixed.

## Results

| Candidate                                               | Rules pass | LLM trials pass  | Browser fallbacks |
| ------------------------------------------------------- | ---------- | ---------------- | ----------------- |
| Original rules                                          | 1/10       | Not run          | Not applicable    |
| `229500a`, prompt v2, uncached catalog                  | 3/10       | 0/10, 0/10, 0/10 | 30/30             |
| `a865d2e`, prompt v2, validated 60-second catalog cache | 3/10       | 4/10, 4/10, 3/10 | 7/30              |

Each profile needs two ideal/good picks among its first three displayed cards.
Each run needs at least eight passing profiles. Fallback cards never count as
an LLM pass. The rules improvement removes grammatical goal words before
synonym expansion; it does not change labels, priority tiers or tie-breaking.

The first live candidate spent most of its five-second deadline fetching the
catalog. Eight requests timed out, and 22 hit the concurrency limit. The next
candidate caches only validated public catalog snapshots, never model answers.
Unpaid cache checks took 50, 30 and 30 ms. New versions fetch fresh source data;
retirements can take up to 60 seconds to reach an older cached snapshot.

The second candidate completed all 30 benchmark requests and four separate
probes. Benchmark latency was 1.78 seconds median, 2.41 seconds p95 and
3.68 seconds maximum. Six invalid responses were rejected in full; one valid
but insufficient answer also fell back. This validates the fallback, not the
quality of those model answers.

## Cost and evidence

Costs below use provider-reported tokens and the approved prices; they are not
an Anthropic billing export.

- Benchmark: 505,707 input tokens, 3,818 output tokens, **$0.052492**.
- Two held-out paraphrases, nonsense and goal injection: **$0.006944**.
- Second run measured total: **$0.059436**, with all 34 request IDs joined to
  sanitized cost diagnostics and no unmatched records.
- First-run timed-out calls have unknown actual cost. Maximum reservations
  remain charged; missing cost is not zero. Budget storage was not reset.
- The test Worker retains its $1 daily/monthly cap and expires before either
  can reset. The workflow disabled provider calls after both runs. Production
  remains on `cc761a7113aba4ddb8bab3ba17f2daba35cdccfa`.

The [first run](runs/39552055432/report.md) and
[second run comparison](runs/39553320172/report.md) preserve per-profile cards,
variation and fallbacks. Their adjacent JSON files contain sanitized trials,
diagnostics and probes. The second report was regenerated from saved responses
after fixing cost-completeness reporting for rejected responses; no calls were
repeated and no scores changed. The recorded source revision is the deployed
candidate. See [workflow 39553320172](https://github.com/pursuit-capstone-fcny/ai-sprint-recommender/actions/runs/39553320172).

## Client review

Two semantic examples for Ali/Eliot:

- **Operations feedback:** the three LLM runs found 1, 0 and 1 approved picks.
  Financial document analysis repeatedly outranked the requested qualitative
  feedback report. The held-out paraphrase found 0/3 approved picks.
- **Funder rehearsal:** the three runs found 1, 0 and 2 approved picks. Only the
  third paired donor role play with donor review. The held-out paraphrase found
  0/3 approved picks. It remains separate from tuning examples.

The weakest profiles also include course planning, internal FAQs and funding
opportunity fit. Course planning found no approved LLM picks in two runs and
fell back in the third. Review task relevance and catalog tagging before
proposing another prompt or candidate policy. Do not relabel these examples
to raise the score. Any future candidate needs three fresh trials and separate
held-out wording.

## Remaining gate

The [failure evidence](failure-results.md) distinguishes live model checks,
deployed synthetic checks and mocked browser behavior. Goal injection returned
only active IDs; nonsense returned no IDs and selected standard matching.
These individual probes do not establish general injection resistance.

All 15 isolated failure checks passed on Cloudflare, including a 5,000 ms
server timeout and no provider dispatch for blocked requests. The temporary
Worker was removed. Final validation passed 410 tests, typecheck, lint and
build; CI and preview deployment passed on the tested revision.

Production requires improved relevance, Ali/Eliot's semantic and weak-profile
review, a production volume/budget decision and
the #23 demo evidence. The test site is configured but provider calls are off
at rest. Production LLM calls and logging remain disabled.
