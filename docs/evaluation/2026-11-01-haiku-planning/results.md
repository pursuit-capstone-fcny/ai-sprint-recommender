# Planning and full-candidate-rating results

Retain V44. None of V47 through V50 resolves weak supporting picks while
preserving its quality, breadth and reliability. The branch restores V44's
ranking request and parser exactly. The 63,000 input bound and updated additive
$5 budget remain. This restoration is not a fresh paid V44 run.

## Comparison

All candidates use Haiku 5.5 low with thinking disabled, one provider call,
512 output tokens and a 4.5-second server deadline. Benchmark labels, catalog,
candidate retrieval and the browser task-diversity gate are unchanged. No paid
retry, replacement case, output repair or automatic padding was introduced.

| Candidate                         | Approach                                        | Top-three scores   | Accepted six-to-eight lists | Recorded charge       |
| --------------------------------- | ----------------------------------------------- | ------------------ | --------------------------- | --------------------- |
| V44, retained historical baseline | Short usefulness statement before each position | 10/10 each         | 30/30                       | Historical, unchanged |
| V47                               | Plan first, consolidate instructions            | 7/10, 5/10, 8/10   | 21/30                       | $0.055709             |
| V48                               | Plan first, restore V44 instructions            | 10/10, 9/10, 10/10 | 29/30                       | $0.063994             |
| V49                               | Plan first, numeric ranks                       | 10/10 each         | 28/30                       | $0.055768             |
| V50                               | Independently rate every candidate              | 9/10, 8/10, 8/10   | 4/30                        | $0.049452             |

V47 has eight duplicate benchmark responses, one accepted four-card list,
Fundraising-02 ranking misses and an instruction-only failure. V48 restores the
controls but one duplicate causes a benchmark fallback. V49 has no duplicate,
timeout, transport or invalid-response failures, but Fundraising-01 has a
five-card list, Leadership-02 a three-card list, and blank browsing abstains.
All forty requests in each of these three runs have measured accounting.

V50 changes selection to one score per candidate, then sorts scores and returns
at most eight useful positions. It reduces broad lists to 4/30. Five benchmark
lists use rules fallback, including one provider timeout. The nonsense control
receives HTTP 400 and the runner stops after 33 submissions. Seven controls are
unrun. Thirty-one calls have measured usage. Both the timeout and rejected
request retain their full reservations. The precise HTTP 400 cause is unknown;
no raw provider response was retained. The full audit fails on missing evidence.
The separate [partial accounting](runs/41322026247-2/state/partial-accounting.json)
reconciles charges without treating the incomplete run as a pass.

V50's score-key schema worked for the 48-candidate benchmark requests and failed
on a full-catalog control. The sanitized status does not establish the rejection cause. It does not
justify changing the control, increasing limits or discarding its charge. Its
breadth regression independently rules it out as the requested fix.

## Supporting-pick review

The [V47](v47-expanded-review.md), [V48](v48-expanded-review.md),
[V49](v49-expanded-review.md) and [V50](v50-expanded-review.md) reviews preserve
all displayed cards and mark each trial's engine. Unlabeled picks remain
unreviewed. Rules fallback lists are not evidence of model improvements.

V49 reduces appearances of previously questioned picks from V44's 22 to eight,
but replacements still include a newsletter for course design, SOAP notes for
student follow-up, and job-application drafting for a funder conversation.
New questions include public-search optimization for internal policy answers
and a fundraising webinar for a board deck. V48 also substitutes questionable
supporting activities. Fewer old flags alone does not approve these replacements.
V50's lower flag count comes with substantially shorter lists and fallbacks.
No expanded-set quality improvement is accepted.

The experiments suggest that asking for an explicit work plan can improve
selection discipline, but it does not reliably resolve the tradeoff between
supporting relevance and list length. Full-candidate scoring was stricter and
produced short lists. We did not lower its usefulness threshold to inflate
breadth, change benchmark labels, or weaken the diversity gate. Human review of
the expanded set remains necessary before claiming the remaining picks useful.

## Evidence and allowance

- V47: source `06523f788393e193441555275ec6f692ab838782`,
  [run 41269410494 attempt two](https://github.com/pursuit-capstone-fcny/ai-sprint-recommender/actions/runs/41269410494).
- V48: source `65d27113b05e0c23efb50d7cded3bdd4315bb304`,
  [run 41320011047 attempt two](https://github.com/pursuit-capstone-fcny/ai-sprint-recommender/actions/runs/41320011047).
- V49: source `bd5955239f33d6a6e4a1a43aacab049769121fc8`,
  [run 41321080272 attempt two](https://github.com/pursuit-capstone-fcny/ai-sprint-recommender/actions/runs/41321080272).
- V50: source `c55fdeaf10fdeaaf3479cd8aec3b6fbb338ad9b1`,
  [run 41322026247 attempt two](https://github.com/pursuit-capstone-fcny/ai-sprint-recommender/actions/runs/41322026247).

The first V47 attempt pair stopped unpaid because the bounds script lacked
explicit Node imports. That failure and all cancelled preliminary attempts are
preserved. Each paid attempt has an approval pinned to its source, run and
attempt. Failed results and historical charges remain intact.

The new $1 grant raises the cumulative cap from $4 to $5. These experiments
record **$0.224923**, including $0.211811 measured and $0.013112 newly reserved
for unknown usage. The cumulative ceiling is **$4.023668**, leaving **$0.976332**.
All **$0.379988** cumulative unknown reservations remain charged. There were 153
submitted cases across the four experiments, 151 with measured usage. No budget
reset, refund or repricing occurred.

The retained candidate still needs review of weak supports. Further paid trials
should test a specific new hypothesis rather than repeat these failed designs.
Unused allowance remains available; no further calls are scheduled.

## Final state

The restored V44 files match the starting retained source. The ledger validates
all new artifact hashes and the additive grant. Final local checks pass: 662 tests, typecheck, lint, formatting, build and
unpaid Haiku/Luna Cloudflare runtime checks. The active budget tests retain the
new $5 cap. No live result is attributed to the final bookkeeping commit.

The deployed test artifact is disabled V50. The workflow removed provider and
rate keys, and an independent unpaid invalid-intake probe confirmed shutdown.
Temporary spending authorization and the trigger label are removed. Production
remains at its prior deployment with LLM calls and usage logging disabled.
No merge, approval, review request or follow-up automation was performed.
