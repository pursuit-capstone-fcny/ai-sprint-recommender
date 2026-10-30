# Luna breadth rerun

Jason requested better recommendation breadth without returning to timeouts,
within the existing allowance. Carry forward $0.810414, including $0.203000
in unresolved historical reservations. At least $0.189586 remains. Production
LLM calls and usage logging stay disabled.

## Diagnosis

The saved V11 run returns six to eight accepted recommendations in 8/30 cases,
down from 23/30 in V10. All 29 accepted V11 lists reach the browser unchanged;
the remaining case fails the unchanged task-diversity gate. The regression is
in the model's output, not browser trimming. The largest measured V11 output
is 236 tokens; V10's previous completed benchmark outputs peak at 344.

Run the saved-output comparison without provider calls:

```sh
python3 docs/evaluation/2026-10-30-luna-breadth/audit-breadth.py docs/evaluation/2026-10-30-luna-compact/runs/41085742178-2
```

It reports eight broad lists and fails the comparison target. This reproduces
the observed symptom from captured responses. It cannot determine how a new
prompt will change remote model behavior. Local tests cover request construction
and bounds; the fresh deployed evaluation is the quality and latency experiment.

Ranked hypotheses:

1. The final "up to eight" instruction allows stopping after the strongest few
   matches. More explicit completion instructions should increase useful lists.
2. Luna overlooks supporting steps and alternative demonstrations. A bounded
   coverage check should recover complementary videos without adding weak ones.
3. Compact catalog rows reduce recognition of secondary matches. Keep this
   encoding unchanged first, so the prompt experiment does not also change data.

## Candidate and limits

`catalog-rank-luna-v12` keeps compact rows, all 89 videos and every V11 ranking
field. Its output instruction asks for six to eight useful positions when
available, keeping the strongest three direct matches first. Before stopping
below six, check remaining catalog entries for other requested activities,
direct supporting steps and useful alternative methods. Prefer existing task
diversity only among equally useful options. Never invent tags or pad the list.
Empty and shorter lists remain valid. The schema still caps output at eight.

Keep GPT-6 Luna low, standard tier, no caching, streaming terminal usage and
the 4.5-second server / five-second client deadlines. No shortlist, label edits,
catalog changes, selector changes, task-gate changes or new evaluation labels.
Haiku and historical isolated Luna requests retain their previous contracts.

Enforce a smaller **1,000-token total output cap**, including reasoning tokens,
with the unchanged 50,000-token input bound. This allows a maximum $0.0055 per
call and $0.187 for all 34 calls. It is a real provider request limit, not a
reduced estimate or refund of historical spend. The cap exceeds the observed
outputs but can still truncate a future response. Retain truncations as failures
and measured charges; never accept partial output or retry a paid case.

The [payload audit](payload-audit.json) records conservative input bounds, not
measured tokens. The budget regression first failed on the old 2,000-token
request and now verifies the new bound, strict usage limits and rejection of
truncated output. Existing tests reconstruct every catalog field losslessly.

[OpenAI's model page](https://developers.openai.com/api/docs/models/gpt-6-luna)
confirms low effort, streaming and structured output support. The
[prompting guidance](https://developers.openai.com/api/docs/guides/latest-model#prompting-best-practices)
calls for evaluating family guidance on the selected model and workload; it
does not establish a Luna breadth or latency guarantee.

## Run and comparison

Run three independent ten-profile trials and the same four separate probes.
Use the V11 report as the before comparison. Preserve the original top-three
threshold and denominator. Report accepted six-to-eight lists separately;
the recovery target is at least the previous V10 count of 23/30 with no timeouts
and all trials at or above eight passing profiles. This is a comparison target,
not a replacement for client review or a change to the task-diversity gate.
Expanded relevance has no new labels. Reused wording probes are not unseen tests.

Pin approval to one clean source and workflow attempt. Preserve all diagnostics,
failures, measured usage and unknown reservations. Keep unpaid catalog recovery
after cooldowns. Always disable test calls, save the durable balance, remove
test keys, and delete the temporary approval and trigger. Stop after this run;
do not assume remaining funds can reserve another complete validation.
