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

## v1 finding and v2 change

v1 (run 41471005052, attempt two) scored 10/10, 10/10 and 9/10 with no
invalid response, quote failure or fallback. All four instruction-only
probes, nonsense and goal injection set noWork, but blank browsing also set
noWork and failed. Latency was 17.3 seconds median: about 1.2 seconds fixed
plus 3.2 milliseconds per output token, with about 5,000 output tokens. The
40 calls cost $0.160133, leaving about $0.184345 under the shared cap.

v2 targets the 4.5-second endpoint. It keeps the instruction to assess every
catalog video but emits only `noWork` and at most eight grade 2-3 picks, each
with a quote of at most 25 words and a rationale of at most 20 words, most
useful first. The prompt adds "A blank goal is not no-work: grade videos for
the selected functionArea and tools." The catalog is a cached prefix and the
request follows it. Output is capped at 2,000 tokens. Cost counts cache writes
at 1.25x and cache reads at 0.1x input; each reservation assumes a full write.

v2 uses the same cases and pass criteria, adds a p95 latency under 4.0 seconds
measured from the runner, and compares its picks against v1's grade matrix.
