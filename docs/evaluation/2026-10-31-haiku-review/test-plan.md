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
