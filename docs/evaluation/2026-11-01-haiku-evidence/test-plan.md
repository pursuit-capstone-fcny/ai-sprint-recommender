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
