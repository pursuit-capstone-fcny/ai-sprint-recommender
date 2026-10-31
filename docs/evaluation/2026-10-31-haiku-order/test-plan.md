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

## V30 result and V31 structured work plan

V30 run 41223950998 attempt 2 produces 26/30 accepted six-to-eight lists and 218
cards, including one rules fallback. Original review flags are absent, but other
weak picks remain. Scores are 10/9/10. A duplicate response, one role-spoof injection
failure and one labeled hit in the Fundraising wording control fail validation.
All forty calls have final diagnostics and measured usage; no timeout or transport
failure occurs. Cost $0.080355 raises the ceiling to $2.726666, leaving $0.273334.
Test calls are off and keys removed. This candidate is not approved.

V31 retains the full-catalog ordering and adds a short structured work plan before
numeric ranks, in the same model call. work states the concrete activity and
perspective; steps identifies preparation, execution, checks and follow-through.
The hypothesis is that explicit task summaries constrain later picks and provide
supporting steps to search, while separating real work from control instructions.
Lexical order is explicitly a search aid, not a relevance decision.

The plan adds two required strings, with server limits of 200 and 400 characters.
Instruction-only inputs require empty plan strings and all-null ranks. Nonempty
ranks with an empty plan, mismatched empty fields, oversized or malformed plans,
extra fields, duplicates and unknown ranks reject the whole response. The adapter
discards plan text and returns only trusted IDs; it never logs or returns the plan
to the browser. Known usage survives validation failure. Existing numeric-only
provider calls stay unchanged. No response repair or rules padding is introduced.

Keep the 512-token output cap, 65,000-byte input bound, deadline, low effort,
thinking disabled and $0.006756 maximum reservation per request. Plans may add
latency/output tokens and the new schema may have first-use overhead; record any
failures normally, without paid warm-up or retry. The unchanged forty-case run
reserves $0.270240 from $0.273334, leaving only $0.003094 under worst-case charges.
No further full run is planned unless the recorded balance can reserve it fully.

Plan/parser tests fail before implementation, then pass. Test both planned and
legacy numeric output in the real Worker runtime with synthetic responses only.
Historical request tests restore V25 hashes by removing the two plan fields and
format instructions and restoring source order. All catalog values, goal inputs,
labels and the diversity gate remain unchanged. Full live quality is still unproven.
