# Bounded Haiku review experiment

V36 reproduces three podcast-for-board-deck picks and a five-video
Fundraising-01 list in its saved results. The frozen-label score is 10/10 in
all three trials. These expanded-set observations are not new relevance labels.

V38 tests a separate review pass. For an eligible nonblank request, Haiku first
ranks the existing 48-candidate shortlist. A second call reviews that draft and
unused alternatives, up to 18 candidates. It checks actual methods and outputs,
replaces weak supporting picks and looks for useful additions before stopping
below six. Candidate metadata and original order remain unchanged. Both calls
use the existing numeric schema and strict validation. Nothing is padded after
model output. Empty or invalid drafts are not reviewed.

The two calls share the unchanged 4.5-second server deadline, 65,000-token input
bound, 512-token total output limit and $0.006756 request reservation. Each stage
has 256 output tokens. Conservative input bounds are checked before dispatch;
blank browsing or a context too large for two stages retains the single-call
path. Unknown review usage keeps the entire reservation. Known usage is summed
across stages before the existing cost calculation. A failed review never
silently returns the draft. No retries or paid warm-up.

Local adapter and endpoint tests check reindexing, schema mapping, duplicate
rejection, abort handling, known and unknown charges, single-pass fallback and
all frozen profile/wording bounds. Cloudflare runtime checks use synthetic
responses only. These checks establish wiring and accounting, not relevance.

Run the unchanged thirty benchmark cases and ten probes once. Use the fixed
validation audit, the existing expanded-set observation and an additional
non-scoring stage-accounting audit. Inspect every expanded recommendation for
new weak picks, rather than treating removal of the original flags as approval.
Retain the change only if quality, breadth and reliability support it.

The shared $4 allowance has $3.206673 charged, leaving $0.793327. All $0.292560
historical unknown reservations remain charged. Bind approval to the exact
commit, run and attempt. Disable calls and remove keys afterward. Production
LLM calls and usage logging stay disabled. Benchmark labels, goals, catalog,
task-diversity gate and prior results remain unchanged.

## V39 follow-up

V38 preserves reliability but fails the Fundraising wording control, reduces
breadth to 27/30 and retains all three podcast flags. All 74 provider calls across
40 client requests reconcile to $0.071940. The remaining allowance is $0.721387.
Its results and failed fresh-comparison gate remain recorded.

V39 changes only the review task and its output adapter. The second call receives
the same draft-plus-alternatives pool without identifying the draft selections.
It classifies each candidate as 0 unrelated, 1 useful support or 2 direct.
These temporary model judgments are not benchmark labels. The adapter rejects
missing/extra/out-of-range fields, removes zeros, ranks direct matches first,
retains draft priority within each positive group and caps the result at eight.
The browser task-diversity gate remains unchanged. No positive quota or output
count is supplied to the classifier. Both stages retain the same combined
reservation, deadline and strict failure accounting. Run the same forty cases
once with exact-attempt approval, preserving every outcome.

## V40 request-format correction

V39 violates the provider's documented limit of 16 union parameters by wrapping
18 plain integer judgments in `anyOf`. Remove those unnecessary wrappers without
changing classification, candidates, labels or gates. Add a red-capable schema
limit regression. Allowlisted HTTP status diagnostics distinguish provider
rejection from transport failure without storing error bodies. After saving a
permanent 400/401/403/404/422 rejection, stop before submitting another paid case;
unsubmitted cases remain missing and the failed run cannot pass validation.

Repeat the forty-case validation within the $0.653827 balance. Carry the new
$0.067560 unknown reservations forward, for $0.360120 total unknown spend.
Keep the combined stage reservation and deadline unchanged. No retries or
replacement cases; production LLM calls and usage logging stay disabled.
