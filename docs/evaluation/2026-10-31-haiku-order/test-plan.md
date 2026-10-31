# Haiku V30 catalog-order test

Jason requested a different approach to weak expanded picks and short lists,
within the remaining allowance. Start at source
`88b88e28d40a640290f43ebb0a1abd02dbbe76dc`, restored V25. The shared $3 cap has
$2.646311 charged, including $0.292560 unknown reservations, leaving $0.353689.
A forty-request run reserves at most $0.270240. No new grant or refund.

## Reproduction and hypothesis

The unchanged unpaid expanded-followup audit on V25 reproduces five short lists
and four appearances of the existing review flags. Frozen top-three scores are
10/10 each, with 25/30 accepted six-to-eight lists and 193 displayed cards.

Ranked hypotheses: source ordering hides complementary methods; the model drifts
from the main task in later selections; or some goals have too few useful catalog
items. Test the first with deterministic goal-relevance ordering before the model.
All 89 items remain available. The model still decides relevance and may abstain.
Lexical order alone does not prove a video is useful or eligible.

## One structural change

Use the existing task-relevance scorer on the same public title, description and
task fields already sent to Haiku. It uses normalized goal words and the existing
synonyms, never benchmark labels, profile IDs or a video whitelist/denylist.
Sort descending by score with stable source-order ties. Assign consecutive numeric
positions and reorder the trusted ID map together. No catalog content changes,
additional truncation, prefilter, response padding or second model call.

Only the bounded Haiku test adapter uses this ordering. Blank or lexically
unmatched goals retain source order. Preserve V25 system instructions exactly,
including mixed-goal, blank-browsing, injection and uniqueness rules. Keep compact
array input, numeric output schema, low effort, thinking disabled, token limits,
4.5-second server deadline and all client validation. Production flags stay off.
The relevance scorer's input type is narrowed to fields it already reads; its
algorithm and browser ranking behavior are unchanged.

The offline ordering contains imperfect keyword matches, so retain the entire
catalog for semantic selection. The maximum input bound across the ten frozen
profiles is 58,542 bytes, below the unchanged 65,000 bound. No extra model input
or output tokens are introduced by the permutation itself.

## Verification and live evaluation

Synthetic ordering and real-adapter mapping tests fail before implementation,
then pass. Verify all items survive once, positions match IDs, ties are stable,
input is not mutated and blank/no-evidence order is unchanged. Frozen-request
tests reconstruct exact V25 hashes by restoring only source order; historical
request invariants still pass. Local tests prove wiring, not semantic quality.

Run the same thirty benchmark requests and ten separate probes. Pin approval to
source, workflow run and attempt. No paid warm-up, case retry or omitted failure.
Use the unchanged fixed validation audit and separate unscored observation of
short lists and existing review flags. Inspect all expanded picks, not just the
original flags. No new benchmark labels or relaxed task-diversity gate.

Keep every attempt and charge. Afterward disable test calls, save durable spend,
remove provider/rate keys and temporary authorization. Carry all unknown charges
forward, using the accounting helper's prior-unknown argument of 292560. Human
expanded-set review, merge and production enablement remain pending.
