# Haiku 5.5 compared with Luna low

Haiku scores **8/10, 8/10, 9/10** on the current benchmark. It is faster than
Luna low in these samples but costs **71% more per call**, with more rules
fallbacks. Both candidates meet the eight-profile minimum in all three trials
and have complete measured accounting. Neither is enabled in production.

| Measure                      |          Luna low |        Haiku 5.5 |
| ---------------------------- | ----------------: | ---------------: |
| Fresh trial scores           | 10/10, 9/10, 9/10 | 8/10, 8/10, 9/10 |
| Benchmark rules fallbacks    |              0/30 |             3/30 |
| Median client latency        |            2.336s |           1.528s |
| p95 client latency           |            3.414s |           2.826s |
| Longest client request       |            4.506s |           2.834s |
| 34-call token-cost estimate  |         $0.042546 |        $0.072834 |
| Mean cost per call           |         $0.001251 |        $0.002142 |
| Input tokens, all 34 calls   |           399,995 |          715,965 |
| Output tokens, all 34 calls  |             5,066 |            2,448 |
| Timeouts / invalid responses |             0 / 0 |            0 / 0 |

Haiku's median latency is about 35% lower. Its higher reported input-token count
explains the cost difference despite fewer output tokens. Both use uncached
standard rates of $0.10/M input and $0.50/M output. Token counts are not
interchangeable across providers. These are usage estimates, not invoices.

The earlier $0.441501 Luna figure was a cumulative ceiling across experiments
and unknown reservations. It was not the cost of a single 34-call benchmark.
The historical Haiku V7 run cost $0.069949 for 34 calls; it already had prompt
and input-order tuning. This rerun applies the completed task tags, corrected
selector, catalog refresh and accounting fixes that were added afterward.

## Candidate and provenance

[Haiku run 40925921428, attempt 2](https://github.com/pursuit-capstone-fcny/ai-sprint-recommender/actions/runs/40925921428)
tested source `938c6cb1e8db1eeec375514b9bb9b1a676651e52` on October 29.
Model `claude-haiku-5-5`, medium effort, thinking disabled, V7, 512 maximum
output tokens. The full-catalog conservative input bound is 65,000. Compare
with [Luna's deployed run](../2026-10-29-luna-reliability/results.md), low effort,
standard reasoning/processing and the same V7 prompt and public catalog.

Both runs use the same ten profiles, ideal/good labels, catalog task tags,
selector, two-real-primary-task gate and 4.5-second server / five-second client
deadlines. Neither uses paid retries, prompt-cache directives or a result cache.
Fingerprint: `298ffdb6199c3a8bdb9ef48063ccfc4e16ca5efda14267a240c93d42d20b6d09`.
The runs occurred at different times, so this is not an interleaved randomized
comparison. Sampling and network variation remain possible.

## Quality and failure behavior

| Profile           | Haiku trial 1  | Haiku trial 2  | Haiku trial 3  |
| ----------------- | -------------- | -------------- | -------------- |
| leadership-01     | 2 hits         | 2 hits         | 2 hits         |
| leadership-02     | rules fallback | rules fallback | rules fallback |
| operations-01     | 2 hits         | 2 hits         | 2 hits         |
| operations-02     | 2 hits         | 2 hits         | 2 hits         |
| programs-01       | 3 hits         | 3 hits         | 3 hits         |
| programs-02       | 1 hit          | 1 hit          | 2 hits         |
| communications-01 | 3 hits         | 3 hits         | 3 hits         |
| communications-02 | 2 hits         | 2 hits         | 2 hits         |
| fundraising-01    | 3 hits         | 3 hits         | 3 hits         |
| fundraising-02    | 2 hits         | 2 hits         | 2 hits         |

Leadership-02 returned three role-play videos with the same primary task in
every trial. The unchanged two-task gate rejected that set and displayed rules
cards; those cards' three hits do not count as LLM passes. Programs-02 had only
one label hit in two trials. Haiku did better than Luna on fundraising-02,
which reached two hits in all three Haiku trials.

Both reused wording probes reached two existing-label hits. They are regression
checks, not unseen wording and not additions to the ten-profile denominator.
Nonsense returned no model picks and used rules. The goal-injection probe
returned only active IDs and never the requested nonexistent ID; this does not
prove general injection resistance. Fifteen deployed synthetic failure checks
passed without provider calls.

The report sets `relevanceEvidenceComplete: true`; all 34 calls have final
measured usage. Ali/Eliot semantic and weak-profile review, fresh unseen wording,
FCNY runtime/privacy/budget approval and #23 demo evidence remain pending.

## Failed preflight and allowance

The [first deployment attempt](runs/40924730321-2/state/comparison-budget.json)
rejected requests before provider dispatch because the tagged catalog's
60,102–60,150 conservative bound exceeded the old 60,000 limit. It spent **$0**.
The full-benchmark regression test failed at that limit and passed at 65,000.
Preflight now checks every profile before deployment. No catalog rows, labels,
prompt content or task requirements were shortened or changed to pass.
The failed attempt and its incomplete diagnostic capture are preserved as
software validation evidence, not a Haiku quality score.

| Current comparison allowance    |                 Amount |
| ------------------------------- | ---------------------: |
| Prior cumulative ceiling        |              $0.441501 |
| Failed configuration attempt    |              $0.000000 |
| 30 Haiku benchmark calls        |              $0.064266 |
| Four separate Haiku probes      |              $0.008568 |
| New measured spend              |          **$0.072834** |
| New unknown reservations        |              $0.000000 |
| Cumulative ceiling              |          **$0.514335** |
| Remaining original $1 allowance | **at least $0.485665** |

The [accounting audit](runs/40925921428-2/state/accounting-audit.json) reconciles
all 34 distinct request IDs exactly to the durable budget increase. Historical
unknown reservations of $0.161000 remain charged. Haiku and Luna share the
existing comparison counter; the expired October 21 Haiku allowance was not
reopened, extended or reset. Earlier results remain unchanged.

The workflow confirmed test shutdown, removed both provider keys and the rate
key, and the one-run approval and trigger label were removed. Test logging
remained off. Production is still static commit `5f63002`, with LLM calls and
usage logging disabled. All 558 tests, typecheck, lint, build and synthetic
Cloudflare runtime checks passed. PR CI and preview passed for the tested source.
