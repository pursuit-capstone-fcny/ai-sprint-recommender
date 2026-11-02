# Offline catalog grader

V57 and V58 rank directly and failed instruction-only controls. This test
asks Haiku to grade every catalog video for each goal instead of ranking a
short list. It runs offline, outside the live endpoint, with no deadline.

## Request

Jason's grading prompt, with one change: "each catalog youtubeId" becomes
"each catalog position", because video IDs stay on the runner. One paragraph
describes the response fields. The response sets `noWork` first, then one
assessment per catalog position: rationale, grade 0-3, quote and rank.

The user message carries the same 89 public rows and truncation as the
endpoint. Haiku 5.5 at low effort with thinking disabled, 10,000 output tokens.

## Derived recommendations

`noWork` produces an empty list. A missing or repeated position makes the
response invalid. A grade 2-3 quote that is not an exact passage of that
video's sent description counts as grade 1. The remaining grade 3 picks come
first, then grade 2, ordered by the model's rank and then catalog position,
at most eight. The existing browser selector, including the task-diversity
gate, scores the top three; a gate-free score is reported beside it.

## Cases and pass criteria

Thirty benchmark cases (ten profiles, three trials) and the same ten controls
as the deployed runs, once each. Retain the grader as a candidate only if
every trial reaches at least 8/10, all four instruction-only probes and the
nonsense goal set `noWork`, blank browsing and both mixed goals produce a
list, both wording checks keep two inherited label hits, and no response is
invalid. Latency, output tokens, quote failures and grades given to labeled
videos are reported without thresholds.

## Allowance

Before each call the runner counts input tokens with the free token-counting
endpoint and reserves that count plus 2,000 schema tokens and the full 10,000
output tokens, about $0.0072 per call. It stops before any call that would
exceed the approved allowance, makes no retries, and stops on any provider
failure while keeping its full reservation. The shared cap leaves $0.344478.

These calls bypass the deployed test budget object. Any later deployed run
must subtract the grader's spend from its allowance. Run artifacts stay
outside the repository.
