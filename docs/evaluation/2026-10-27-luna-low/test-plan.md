# Luna low quality rerun

Jason requested a quality improvement and fresh low-effort trials on October 27,
using the remainder of the October 26 $1 allowance. Production LLM calls and
usage logging stay disabled. This is an isolated provider experiment on PR #76.

## Diagnosis and change

An unpaid replay of the original capture reproduces 4/10, 5/10 and 3/10 passes.
Seventeen valid low-effort responses fail the unchanged task-diversity gate;
one request times out. The frozen catalog has task tags for only 10 of 89 videos.
For example, the first program-planning response contains nine videos but only
one tagged task, so it falls back despite relevant direct matches.

The first experiment changes only the system prompt, version
`catalog-rank-luna-v8`. It asks for complementary steps that directly help with
the requested activity, explains that diversity uses existing primary task tags,
and prefers different tasks only among equally useful matches. It explicitly
forbids unrelated padding, inventing tags or replacing a stronger untagged answer
with a weaker tagged item. The existing V7 instructions remain in place.

Catalog coverage may prevent this prompt from reaching 8/10. Passing by adding
irrelevant tagged videos would not establish better recommendations. Inspect
returned supporting picks as well as the unchanged numerical score. No catalog
tags, benchmark labels, selector, gate, deadline or response schema are changed.
The model receives public catalog fields and synthetic inputs, never labels.

## Run and budget

- Three independent ten-profile trials, `gpt-6-luna`, low effort, standard mode.
- Same 4.5-second deadline, 2,000 total output tokens, no caching or retries.
- Reserve $0.007 per dispatch, at most $0.21 for these 30 requests.
- Carry forward $0.183040 from run 40445851804, attempt 2, including all unknown
  timeout reservations. The existing $1 total cap leaves $0.816960 before this run.
- Verify the prior capture's SHA-256 and computed spend before any provider call.
  Approval must include the prior spend, approved prompt and effort, exact source
  commit, run, attempt and expiry. Remove the one-time approval and label afterward.
- Preserve partial evidence and count unknown costs at their full reservation.
  Never reuse a run approval or treat a timeout as free.

The frozen fingerprint remains
`4ab7cb1d8eaa76b1e79d0b3f0fe675740bce9da4076be8a86d63f36fda519dde`.
The prior capture hash is
`547265442f5afcec3f372d81d486acbefd8575ea3003c852a90d175ee9820ed4`.

Save per-profile selections, scores, fallbacks, latency and token costs alongside
the original evidence. This is a development benchmark that has already been
inspected. It does not certify generalization, a deployed Luna endpoint or
production readiness. No Cloudflare or Apps Script deployment is involved.

## Second experiment

V8 completed in run 40545682960, attempt 2. Scores fell to 2/10, 3/10, 3/10;
median latency rose to 3.066 seconds. It made 30 calls, with $0.036028 known
cost and one $0.007 unknown reservation. Reject V8 as a quality improvement.
The capture and generated report are retained unchanged in meaning.

Test `catalog-rank-luna-v9` next. It replaces the long combined instructions
with a shorter prompt distinguishing exact matches from transferable workflows.
It retains relevance ahead of diversity, forbids weak padding, and leaves
catalog data, schema, gate, deadline and low effort unchanged. It contains no
benchmark-specific examples or labels. This tests prompt wording only.

Carry forward $0.226068 across both completed runs, leaving at least $0.773932.
Authorize at most 30 new calls and $0.21 additional maximum reservations on one
new source/run/attempt. The V8 capture hash is
`2f52b62ac70c686a3b4e569a6d6b5e71c2d72d53ba117e928961244e6499f63b`.
Stop after this comparison and record regressions as well as gains.
