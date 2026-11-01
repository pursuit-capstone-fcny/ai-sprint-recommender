# Haiku selection evidence experiment

V36's saved results reproduce three podcast-for-board-deck picks and one
five-video Fundraising-01 list. The existing unpaid observation fails. Frozen
labels still score 10/10 in each trial. These observations add no relevance labels.

V43 tests a different selection format in one provider call. Each of eight
required rank objects contains a short statement of the taught method and its
use for the goal, followed by the catalog position. This makes the model state
the practical connection before selecting. An unused object has an empty use
and null position. The adapter validates the complete response, strips the
statements and exposes only trusted catalog IDs. Missing evidence, extra fields,
duplicates, out-of-range positions or truncation reject the whole response.
There is no second call, retry, automatic padding or server reranking.

The request retains V36's retrieval, candidate order and catalog metadata. The
additional instruction distinguishes transferable operations from changing the
requested deliverable and asks for useful preparation/checking/follow-up methods
before stopping below six. Injection handling and blank browsing remain required.
The implementation does not read profile IDs, ideal/good labels or review flags.

The wire request includes all eight nested schemas in its conservative token
bound. All fields are required, with eight existing integer/null unions and no
unsupported string-length constraint sent to the API. The local validator caps
use statements at 80 characters. Anthropic documents
[required-property ordering and schema limits](https://platform.claude.com/docs/en/build-with-claude/structured-outputs#property-ordering).
The statement precedes the position in schema order. This format asks for a
brief usefulness statement, not private reasoning or a chain of thought.

Local tests cover the actual adapter, endpoint, accounting and Worker runtime.
The new adapter tests first fail under V36, then pass with V43. These checks
verify wiring and bounded requests, not recommendation quality. Run the same
30 benchmark cases and ten probes once, then apply the unchanged validation and
expanded-set observation. Inspect all expanded picks, including replacements.
Keep failures and partial results. Do not retry or replace paid cases.

The shared $4 cap has $3.547947 charged, leaving $0.452053, including all
$0.360120 unknown reservations. Forty requests reserve at most $0.270240. Keep
Haiku 5.5 low, disabled thinking, the 4.5-second deadline, 65,000 input bound,
512 output-token cap and $0.006756 per-request reservation. Bind approval to the
exact source/run/attempt. Disable calls and remove keys afterward. Production
LLM calls and logging, benchmark labels, task-diversity gate and historical
results remain unchanged.

## Unpaid startup correction

Run 41258570330 attempt two stops on an HTTP 200 readiness response without
the diagnostic header. Its fixed blank intake cannot call the provider. No
benchmark case is submitted and durable spend remains $3.547947. Preserve that
failed attempt, independent shutdown confirmation and zero-charge budget record.

The readiness loop may wait within its existing 30-second deadline when this
specific missing-header response occurs. It only ever resubmits the fixed blank
intake, never a benchmark goal. Invalid diagnostics, HTTP errors and network
errors still stop the run. Save all startup failures separately in readiness.json;
the existing paid-case transport and reliability audit remains unchanged.
Adapter, ranking, model, limits and remaining allowance are unchanged. The next
workflow run gets its own exact-source and attempt approval.

## V44 statement parsing and shorter output

V43 run 41258981865 attempt two submits all forty cases. One times out; 34 fail
schema validation and five all-null abstentions parse successfully. Every
nonempty selection fails, so its 0/10 scores are rules fallbacks, not evidence
about the new selection quality. All 39 completed calls have measured accounting.
Record $0.067283, including the timeout's full $0.006756 reservation. The remaining
allowance is $0.384770 and cumulative unknown reservations are $0.366876.

A local test reproduces an avoidable parser rejection: one otherwise valid
selection statement over 80 characters rejects the entire list. V43's existing
diagnostics do not identify which statement constraint caused its live failures,
so the specific live cause is not established. V44 removes the auxiliary prose
length limit, preserving the existing 2,048-character whole-response bound,
strict eight-object shape, nonempty selected statements, empty unused statements
and all numeric-ID checks. Request at most five words per statement to reduce
output latency. Add sanitized statement/schema issue counts, without text.

Stop after saving any structural response-schema rejection instead of submitting
more paid profiles with a bad format. Unsubmitted cases remain missing and the
run fails validation. This does not retry or replace a failed case. The adapter
and the real evaluation callback are regression tested before a new run.

Repeat the same forty cases once within the $0.384770 remainder. Keep the input,
output, deadline and reservation caps, all benchmark labels, catalog metadata,
task-diversity gate and production flags unchanged. All V43 failures remain.
