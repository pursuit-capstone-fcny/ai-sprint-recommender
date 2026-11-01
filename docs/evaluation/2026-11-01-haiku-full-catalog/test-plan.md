# Full-catalog Haiku validation

Jason clarified the product scope: Haiku receives the user input and all 89
videos, without rules-based candidate prefiltering. V54 removes retrieval from
the request path and deletes its unused helper. All active catalog items reach
the provider in source order. Keep this scope even if validation scores regress;
do not restore the V44 shortlist to improve the score.

Use the existing V44 selection instructions and strict eight-slot usefulness
format. This is a fresh repetition of V51's all-catalog configuration, chosen
for scope rather than a new quality optimization. No other prompt, parser or
metadata changes. Titles/descriptions retain the existing 200/500-character
bounds; the library remains the same frozen public snapshot. User goals,
function area and selected tools are sent without benchmark labels, expected
answers, scores, prior conversation or external research.

The real Worker regression first fails when returning catalog position 88:
the old shortlist makes it invalid. After removing prefiltering, assert that the
outbound provider request contains all 89 records with the original fields and
position-to-ID mapping, and that positions zero and 88 map to the expected IDs.
Check every unique validation input's complete wire bound before deployment.

Run #19 once: three ten-profile trials and ten controls, with unchanged labels,
catalog and task-diversity gate. Haiku 5.5 low, thinking disabled, one call per
case, 63,000 input bound, 512 output tokens, server 4.5 seconds and client five
seconds. Preserve every fallback, timeout, duplicate and missing diagnostic.
No paid retries, replacement cases, repairs, padding or additional model call.
Report top-three quality, accepted six-to-eight lists and expanded picks
separately; unreviewed picks remain unlabeled.

Carry the existing $4.234267 ceiling, including all $0.379988 unknown
reservations, under the unchanged additive $5 cap. Available allowance is
$0.765733. Maximum reservation remains $0.006556 per call and $0.262240 for
forty cases. No new grant, refund, reset or repricing. Bind approval to the exact
source, workflow and attempt. Afterward disable test calls, remove provider/rate
keys and temporary authorization, and reconcile the durable budget. Production
LLM calls and usage logging stay disabled. No merge, approval or follow-up
automation is authorized.
