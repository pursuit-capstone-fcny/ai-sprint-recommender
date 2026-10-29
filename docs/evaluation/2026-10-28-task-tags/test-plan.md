# Complete task tags, rerun Luna low

Jason requested missing catalog task tags and another Luna low benchmark on
October 28, within the remainder of the existing $1 allowance. Production LLM
calls and usage logging remain disabled.

## Catalog revision

The original 89-video snapshot and every historical result remain unchanged.
This revision keeps all ten synthetic profiles, ideal/good labels and reasons
identical. Only the catalog's missing task arrays and task dictionary change.
The selector, task-diversity gate, relevance threshold and scoring do not change.

`task-tags.json` records each of the 79 additions with an exact supporting phrase
from its public description. The first tag describes the demonstrated activity;
secondary tags describe supporting work. Repeated activities share a primary
tag, including survey analysis, chart creation, lesson planning and roleplay
simulation. No tag is assigned solely to make a recommendation pass. The ten
previously tagged items remain untouched. This is metadata review, not a claim
that the full videos were watched.

The source test Sheet serves both configured production and test catalog URLs.
Updated only `Catalog!E12:E90` and appended canonical terms to
`Dictionary!A60:B120`. Public GET readback matched all 79 mappings, 89 items,
the dictionary and every other original catalog field. Sheet save and wrapping
were checked in Google Sheets. No logging settings, source tracker rows or
Apps Script code were changed.

Catalog version:
`sha256:b3f96d7113308d627eeb6c9667ac51a44155210faf515db2ef5a41fb5e9bfae7`.
Benchmark fingerprint:
`298ffdb6199c3a8bdb9ef48063ccfc4e16ca5efda14267a240c93d42d20b6d09`.
A regression check locks unchanged labels and all non-task catalog fields.

## Fresh comparison

- Use the original `catalog-rank-v7` prompt, `gpt-6-luna`, low effort,
  standard mode; three independent ten-profile trials.
- Keep the 4.5-second deadline, 2,000 total output tokens including reasoning,
  disabled caching and no retries. Send synthetic inputs and public metadata;
  never send the labels or supporting label reasons.
- Carry forward $0.261960, including all earlier unknown-cost reservations,
  leaving at least $0.738040. Reserve $0.007 before each of at most 30 calls
  ($0.21 maximum additional commitment), with a cumulative $1 cap.
- Verify all three prior capture hashes and their computed spend. Bind approval
  to this new benchmark fingerprint, one clean source commit, workflow run,
  attempt and expiry; remove the approval and trigger label after completion.
- Save captures, per-profile scores, fallbacks, latency and costs. Compare with
  original Luna low's 4/10, 5/10, 3/10, explicitly identifying the catalog revision.

This is an inspected development benchmark, not a held-out evaluation. Passing
this isolated provider comparison does not certify a deployed Luna endpoint,
wording robustness or production readiness. No deployment is needed for the run.
