# V10 with up to eight recommendations

Haiku low reached **9/10 in each of three trials**. The prompt changes fixed
Programs-02 and the reused operations wording probe, but Leadership-02 fell
back to rules each time. This trades one weakness for another; it does not
improve the overall score over V7 low.

Luna low's run failed with two timeouts followed by rate limiting. Its endpoint
scores were **4/10, 0/10, 0/10**, with 26 benchmark fallbacks. Only four benchmark
requests produced accepted model lists. These results cannot isolate prompt
quality from availability failures. No failed calls were retried.

| Measure                                   |    Haiku low V10 |     Luna low V10 |
| ----------------------------------------- | ---------------: | ---------------: |
| Original top-three trial scores           | 9/10, 9/10, 9/10 | 4/10, 0/10, 0/10 |
| Benchmark rules fallbacks                 |             3/30 |            26/30 |
| Accepted LLM sets with 6–8 cards          |            20/30 |             3/30 |
| Accepted LLM sets with fewer than 6 cards |             7/30 |             1/30 |
| Benchmark timeouts / rate limits          |            0 / 0 |           2 / 24 |
| Measured paid calls                       |               34 |                4 |
| Additional unknown paid calls             |                0 |                2 |
| Measured token cost                       |        $0.070512 |        $0.004873 |
| Additional reservations retained          |               $0 |        $0.014000 |
| Total new allowance charge                |        $0.070512 |        $0.018873 |
| Full fresh validation                     |       Incomplete |           Failed |

Every displayed set stayed at or below eight, including rules fallbacks.
Full-set quality remains pending client review. Counts and existing-label hits
are descriptive; unreviewed videos are not automatically irrelevant. The
original top-three score and two-real-primary-task gate are unchanged. Rules
still scores 8/10 with the same top-three IDs for all ten profiles.

## Changes and comparison

V10 asks for direct coverage of each activity and deliverable, distinguishes
written-feedback analysis from numerical analysis, and requests six to eight
useful videos without padding. Both providers return at most eight ranked
slots. The page displays all eligible cards up to eight and removes Show more.
Thin relevant sets remain valid. Haiku uses low effort with thinking disabled;
Luna uses low effort with standard processing. Catalog, labels, task tags,
deadlines and the diversity gate did not change.

Haiku's Programs-02 top-three hits rose from one to two in every trial. Its
operations wording probe rose from one to two hits; fundraising wording stayed
at two. Leadership-02 changed from three accepted hits to rules fallback after
failing the unchanged task-diversity gate. Nonsense and goal injection returned
empty model lists and used rules. These reused probes are not unseen validation.

Haiku's median client latency was 1.156 seconds, p95 1.812 and maximum 2.082.
Its measured mean cost was $0.002074 per call, versus V7 low's $0.002142.
V7 low also scored 9/10 throughout, with no benchmark fallbacks. Prompt and
output size changed together, so this is not an isolated prompt experiment.

Luna dispatched six calls. Four completed with measured usage; two timed out
without usage. The budget keeps both full $0.007 reservations and their
concurrency leases. The remaining 24 benchmark requests and all four probes
returned rate-limited fallbacks. The captured denials occurred before provider
dispatch. The timing and budget code are consistent with those two occupied
leases blocking the rest of this short run. We did not release them early,
reset the counter, increase concurrency or extend deadlines to improve scores.
The four completed lists all met the top-three relevance threshold, but they
do not establish ten-profile quality. V7 Luna's historical 10/10, 9/10, 9/10
remains preserved, not current readiness evidence.

## Evidence and limits

- [Haiku run 40994419045, attempt 2](https://github.com/pursuit-capstone-fcny/ai-sprint-recommender/actions/runs/40994419045/attempts/2)
  tested `040e17fc12f1fa437b9e4f97356304c05539954f`. All 34 paid diagnostics
  reconcile exactly, but the third unpaid cache-check diagnostic is missing.
- [Luna run 40995485497, attempt 2](https://github.com/pursuit-capstone-fcny/ai-sprint-recommender/actions/runs/40995485497/attempts/2)
  tested `90b4dbd32e7ccdc1d387105c9407dfe26ac2c9d7`, with identical runtime code
  and the carried Haiku balance. It also lacks the third cache-check diagnostic
  and 16 request diagnostics. Four known costs plus two reservations reconcile
  to its durable increase, but complete measured usage remains unavailable.
- Both workflows remain failed. Saved [Haiku replay](runs/40994419045-2/replay/report.md)
  and [Luna replay](runs/40995485497-2/replay/report.md) preserve per-profile
  results and final available diagnostics. Replays do not repair fresh evidence.
- Both runs passed all 15 hosted synthetic failure checks. All 563 local tests,
  typecheck, lint and build pass. The [Cloudflare preview check](preview-check.json)
  confirmed 89 videos loaded, eight cards, no Show more, keyboard submission
  and focus on the results. It used standard matching and no paid model calls.

The frozen benchmark fingerprint remains
`298ffdb6199c3a8bdb9ef48063ccfc4e16ca5efda14267a240c93d42d20b6d09`.
No labels or historical results changed. Expanded-set review, unseen wording,
semantic and weak-profile review, production approvals and demo evidence remain
pending. The missing diagnostics and Luna timeout cascade need investigation
before another validation run; neither candidate is production approved.

## Allowance and shutdown

These runs charged **$0.089385** against the existing allowance. The cumulative
ceiling is **$0.676554**, including **$0.175000** of unresolved reservations.
**At least $0.323446 remains** of the original $1. No allowance was reset or
increased. Token costs are usage estimates, not invoices. Both test configs
and the hashed ledger carry the latest durable balance.

Haiku shutdown was confirmed at 02:59:47 UTC and Luna at 03:09:31 UTC on
October 30, still October 29 in New York. Both provider keys and the rate key
were absent after cleanup. Approval variables and trigger labels were removed.
Production remains static commit `5f630024b9e662018d430fba0dc92311a5507132` with
LLM calls and usage logging disabled. Evaluation logging stayed off. The
existing PR preview retains its separate test-event logging configuration.
