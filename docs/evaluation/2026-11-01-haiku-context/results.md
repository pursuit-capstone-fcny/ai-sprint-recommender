# Candidate-context results

Retain V44. Three different context changes failed to resolve weak supporting
picks while preserving its quality, breadth and reliability. The branch restores
V44's ranking, retrieval and parser exactly. No fresh paid V44 result is claimed.

## Comparison

All runs use Haiku 5.5 low with thinking disabled, one provider call per case,
the same forty cases, a 63,000 input bound, 512 output tokens and a 4.5-second
server deadline. Labels, catalog metadata and the task-diversity gate stay fixed.

| Candidate                         | Approach                                      | Top-three scores   | Accepted six-to-eight lists | Measured cost         |
| --------------------------------- | --------------------------------------------- | ------------------ | --------------------------- | --------------------- |
| V44, retained historical baseline | Original shortlist and selection evidence     | 10/10 each         | 30/30                       | Historical, unchanged |
| V51                               | All 89 candidates                             | 9/10, 10/10, 8/10  | 28/30                       | $0.088380             |
| V52                               | Add related methods to the original shortlist | 7/10, 10/10, 10/10 | 27/30                       | $0.061861             |
| V53                               | Present descriptions and tasks before titles  | 6/10, 9/10, 8/10   | 23/30                       | $0.060358             |

V51 tests whether omitted useful methods cause weak substitutes. It includes
every catalog item without changing the prompt or schema. Operations-02 times
out in trial one and duplicates a position in trial three. Fundraising-02 also
misses a labeled match in trial three. Its median/p95/max latency is
2.275/3.930/4.644 seconds. All controls pass, but the benchmark regresses.

V52 restores V44 and adds at most twelve related-method candidates. It retains
every original candidate and uses only public metadata similarity, with no
profile-specific rules or labels. Three duplicate responses cause benchmark
fallbacks. The mixed Fundraising control also falls back with insufficient
results. There are no timeouts or transport failures. Median/p95/max latency is
2.163/4.065/4.342 seconds.

V53 restores the original shortlist and changes only metadata field order in
the transmitted request. Seven duplicate benchmark responses fall back, as does
the Operations wording control. Other controls pass. There are no timeouts or
transport failures. Median/p95/max latency is 2.077/2.795/3.337 seconds. The eight
duplicates make this ordering unsuitable despite complete usage diagnostics.

Every accepted LLM list in these three runs has six to eight cards. The breadth
loss comes from failed LLM requests; eight-card rules fallbacks do not count as
accepted LLM breadth. All three quality audits fail. Successful workflow cleanup
and accounting do not make those audits pass.

## Supporting-pick review

The [V51](v51-expanded-review.md), [V52](v52-expanded-review.md) and
[V53](v53-expanded-review.md) reviews preserve every displayed card and identify
each trial's engine. Existing ideal/good labels are unchanged; other picks
remain unreviewed.

Previously questioned pairings appear 14, 13 and 12 times, versus V44's 22.
Those counts include two, one and five appearances in rules fallbacks. They
are review observations, not added benchmark labels or evidence that replacements
are approved. V51 still selects equipment negotiation for funding/staff work,
a podcast for a board deck, a newsletter for course design and SOAP notes for
student follow-up. V53 still selects slide-deck creation for internal-policy
answers, meeting minutes for survey reporting and negotiation for staff rehearsal.
Expanded quality remains unresolved.

The candidate audit established real omissions in the original shortlist, but
adding those candidates did not reliably improve the final output. Changing
field order also regressed uniqueness. Earlier planning and stricter usefulness
trials already failed to preserve breadth. Further testing needs a new grounded
hypothesis; these failures do not justify changing labels, relaxing the gate or
discarding difficult cases. The remaining allowance is preserved.

## Evidence and allowance

- V51: source `c7d5511a9ac4a4d9b34b5ed1b0e4b0509c0f781e`,
  [run 41323740103, attempt two](https://github.com/pursuit-capstone-fcny/ai-sprint-recommender/actions/runs/41323740103).
- V52: source `360fc5bd77e2df6e58d8c1948fbc2b9e61f471f5`,
  [run 41325133036, attempt two](https://github.com/pursuit-capstone-fcny/ai-sprint-recommender/actions/runs/41325133036).
- V53: source `d36abda5f679aec4c2955f8f11530a6ff07b3681`,
  [run 41326132545, attempt two](https://github.com/pursuit-capstone-fcny/ai-sprint-recommender/actions/runs/41326132545).

All 120 submitted cases have final measured accounting. V51's timeout also has
measured usage; no new unknown reservation is added. The three experiments cost
**$0.210599**. The cumulative ceiling rises from $4.023668 to **$4.234267** under
the existing additive $5 cap, leaving **$0.765733**. All **$0.379988** historical
unknown reservations remain charged. There are no paid retries, replacement
cases, budget resets, refunds or repricing.

Approvals bind each run to its exact source and workflow attempt. Preliminary
unpaid attempts and all failed results are archived. The original audit output
uses an older default unknown-reservation subtotal; each separate accounting
audit carries the actual $0.379988 forward, with the correction explained in
`state/accounting-carry-forward.json`. This does not alter costs or scores.

## Final state

V44's runtime files match the starting source `b129512d9b5d36ce28bc67e0f55288d7d6f98e10`.
Only cumulative accounting and evaluation evidence remain changed. Final local
verification is recorded in `local-checks.json`.

The deployed test artifact is disabled V53. Workflow cleanup removed provider
and rate keys, and an independent unpaid request confirms `reason: disabled`.
The temporary approval variable and evaluation trigger are removed. No further
paid calls or follow-ups are scheduled.

The [production deployment check](production-disabled.json) confirms the latest
successful production build still has LLM calls and usage logging disabled.
Benchmark labels, catalog and diversity code match the starting source.
Supporting-pick review, unseen-input evidence and human approval remain pending;
no merge or production-readiness claim is made.
