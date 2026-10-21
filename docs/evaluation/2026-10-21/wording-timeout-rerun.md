# Wording and timeout rerun

Jason requested fixes and another evaluation on October 21, 2026, within the
remaining original $1 allowance. Benchmark labels, the 89-video catalog and
the existing wording probes stay unchanged. Production LLM calls and usage
logging remain disabled.

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

## Results

Pending local and deployed checks. No result or approval is implied by this
plan. Preserve all attempts and update this section after the run.
