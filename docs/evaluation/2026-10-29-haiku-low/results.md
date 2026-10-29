# Haiku 5.5 low effort

Haiku low scored **9/10 in all three trials**, versus medium's 8/10, 8/10,
9/10. It had no benchmark fallbacks and a 24% lower median latency. Cost was
**identical: $0.072834 for 34 calls**, about **$0.002142 per call**.
Low effort did not reduce the reported token totals in this test.

The benchmark calls completed, but full fresh validation remains incomplete.
The runner did not capture one unpaid catalog cache-check diagnostic before
trial three. It correctly failed the final evidence check. All 34 paid calls
have final measured usage that reconciles exactly to the durable budget.
Do not interpret the numeric scores as production approval.

| Measure                      |        Haiku low |     Haiku medium |          Luna low |
| ---------------------------- | ---------------: | ---------------: | ----------------: |
| Trial scores                 | 9/10, 9/10, 9/10 | 8/10, 8/10, 9/10 | 10/10, 9/10, 9/10 |
| Benchmark rules fallbacks    |             0/30 |             3/30 |              0/30 |
| Median client latency        |           1.159s |           1.528s |            2.336s |
| p95 client latency           |           2.044s |           2.826s |            3.414s |
| Longest client request       |           2.195s |           2.834s |            4.506s |
| 34-call token-cost estimate  |        $0.072834 |        $0.072834 |         $0.042546 |
| Mean cost per call           |        $0.002142 |        $0.002142 |         $0.001251 |
| Input tokens, all 34 calls   |          715,965 |          715,965 |           399,995 |
| Output tokens, all 34 calls  |            2,448 |            2,448 |             5,066 |
| Timeouts / invalid responses |            0 / 0 |            0 / 0 |             0 / 0 |
| Full fresh validation        |       Incomplete |         Complete |          Complete |

Haiku low remains about 71% more expensive per call than Luna low in these
samples. The two Haiku runs reported identical input and output totals. These
are usage estimates, not provider invoices, and sequential runs are subject to
sampling and network variation. Compare the saved
[medium report](../2026-10-29-haiku-current/results.md) and
[Luna report](../2026-10-29-luna-reliability/results.md).

## Quality and provenance

[Run 40948211908, attempt 3](https://github.com/pursuit-capstone-fcny/ai-sprint-recommender/actions/runs/40948211908/attempts/3)
tested `2c1588dbdda2b07aa38c53056f9e45f7f74ddaf5` on October 29. Candidate:
`claude-haiku-5-5`, low effort, thinking disabled, V7, 512 maximum output tokens.
The approval and capability check pin low effort. Only effort changed from the
medium candidate; prompt, catalog, labels, selection, diversity gate and
4.5-second server / five-second client deadlines stayed unchanged.
Fingerprint: `298ffdb6199c3a8bdb9ef48063ccfc4e16ca5efda14267a240c93d42d20b6d09`.

Leadership-02 reached three label hits and passed the diversity gate in all
three low-effort trials; medium fell back on that profile each time.
Programs-02 remained weak, with one label hit in every trial. Every other
profile passed. Rules remained 8/10. The [offline comparison](runs/40948211908-3/replay/report.md)
lists all per-profile changes using the final saved diagnostics. It is explicitly
replay evidence and does not replace the missing fresh warmup diagnostic or
alter the original workflow report.

The reused operations wording probe slipped to one existing-label hit, versus
two for medium and Luna. The fundraising wording probe retained two hits.
Nonsense and the goal-injection probe returned empty model lists and used rules. These separate
probes do not enter the ten-profile denominator or prove general safety.
All 15 deployed synthetic failure checks passed. The first execution, attempt 2,
stopped on HTTP 404/500 from that synthetic Worker before provider enablement;
it made no paid calls. Its failure and shutdown records are preserved.

## Accounting and shutdown

The [accounting audit](runs/40948211908-3/state/accounting-audit.json) joins 30
benchmark diagnostics and four probe diagnostics to distinct request IDs.
Benchmark calls cost $0.064266; probes cost $0.008568. Their $0.072834 total
matches the [durable budget increase](runs/40948211908-3/state/comparison-budget.json).
There are no new unknown reservations. Historical unknown reservations of
$0.161000 remain charged. The cumulative ceiling is **$0.587169**, leaving
**at least $0.412831** of the original $1 allowance.

The missing unpaid diagnostic is request `429c26a9-6f8d-4c2e-b06d-58838d00e8c4`.
Its HTTP response was recorded, but diagnostic capture was incomplete. The
workflow and original report remain failed/incomplete; no further paid run was
made to replace this evidence.

The test endpoint confirmed disabled at 20:27:22 UTC. Both provider bindings
and the rate key were absent after cleanup; the one-run approval and trigger
label were removed. Production remains static commit `5f63002`, with LLM calls
and usage logging disabled. Test usage logging stayed off. Both test configs
carry the new balance without resetting the shared counter.

All 560 local tests, typecheck, lint, build and both adapter runtime checks pass;
CI and preview passed for the tested source. Ali/Eliot semantic and weak-profile
review, unseen wording, production approvals and demo evidence remain pending.
