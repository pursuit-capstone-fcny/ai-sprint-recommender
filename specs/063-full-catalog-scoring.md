# #63: Full-catalog scoring with evidence

Status: Offline experiment. Not connected to the Worker or browser.

## Acceptance criteria

- Given a nonblank intake request and its matching public catalog version, when
  preparing a request, then send all 89 complete active catalog items in source
  order. Do not prefilter, truncate metadata, or add rules rankings, synonyms,
  historical labels or evaluation results. Reject invalid catalogs or an
  oversized complete request instead of shrinking the context.
- Given the model's structured assessment, when validating it, then require
  exactly one grade and rationale per catalog item. Reject unknown, missing or
  duplicate IDs and extra properties. Grades are provisional model judgments,
  not benchmark labels: 3 is direct instruction, 2 is a substantial useful
  component, 1 is weak/contextual, and 0 is unrelated or contradictory.
- Given a useful grade of 2 or 3, when checking evidence, then require a quoted
  requested step and an exact passage from that video's description. The
  rationale must explain the taught method's connection to the step. Lower
  grades retain a mismatch rationale without invented usefulness evidence.
- Given explicit hard constraints, when assessing a useful item, then check
  every applicable constraint once. Scope each constraint to its requested step
  or the whole request. Satisfied/violated checks cite that item's public field;
  unknown checks cite nothing. Unknown or violated constraints exclude the item.
- Given the complete assessment, when ranking, then require a full ordering of
  every eligible item. Sort direct instruction before supporting methods, retain
  the model's order within each grade, apply the existing top-three task
  diversity ordering across the entire pool, then select at most eight.
  Return no weak filler and impose no minimum count.
- Given no eligible items, when selecting, then preserve an empty abstention.
  Given invalid output or failure of the unchanged two-primary-task gate, then
  return unavailable. Never display rules results as a substitute.
- Given the offline command, when preparing a request or checking canned JSON,
  then make no network requests, read no API keys, and write only a new output
  directory. Preserve frozen candidates, labels, results and production settings.

## Interface and request format

`prepareCatalogScoring(input, catalog)` returns the complete Anthropic Messages
request and `complete(decodedAssessment)`. Completion exposes the validated
89-row assessment, eligible IDs, recommendation response, UI state and a bounded
validation-failure code. Invalid responses are rejected as a whole.

The request uses `claude-haiku-5-5`, low effort, thinking disabled, and prompt
`catalog-score-evidence-v2`. Its JSON schema requires `catalogVersion`,
`goalStatus`, `workSteps`, `hardConstraints`, `assessments` and `priorityOrder`.
The request file records the exact system prompt and schema. Local validation
adds cardinality, reference, quote-provenance and ordering checks beyond the
provider's structural schema.

V2 compares taught input/operation/output across both accepted and rejected
items, rather than using example topics to judge transfer. It requests shorter
rationales and explicit per-step constraint bookkeeping. Response schema,
evidence validation, ranking, task-diversity gate and fallback policy are
unchanged. V1 source and results remain preserved in the separate sample study.

Every item includes the public title, description, tags, date, duration, status
and start-here field. Canonical dictionaries validate input tags but are not
additional ranking context. No metadata is truncated. Nonblank requests only;
the existing browsing behavior is untouched.

## Offline use

From the checkout, with Node 24 and dependencies installed:

```sh
pnpm score:offline --catalog /tmp/catalog.json --input /tmp/intake.json \
  --output /tmp/new-scoring-request
pnpm score:offline --catalog /tmp/catalog.json --input /tmp/intake.json \
  --assessment /tmp/canned-assessment.json --output /tmp/new-scoring-decision
```

The first command prepares JSON only. The second checks a decoded canned
assessment. Both record the exact request, catalog-wire hash and request hash.
The manifest records zero provider calls and zero measured cost for this offline
execution. The second also writes the decision and full validated assessment.
Existing output directories are rejected. Exit code 2 means an unavailable
decision; exit code 1 means command/input failure. Neither means a passing run.

## Limits and validation

Offline tests use fictional 89-item catalogs and canned responses, including
forged evidence, incomplete coverage, scoped constraints, instruction-only
input, omitted eligible items, late useful items, abstention and diversity-gate
failure. They do not measure recommendation quality or prove semantic relevance,
complete constraint extraction, or resistance to every injection. Exact quotes
establish provenance, not that the model's interpretation is correct.

This experimental request permits 16,384 output tokens and rejects a complete
wire request whose conservative input bound, UTF-8 bytes plus 4,096, exceeds
63,000. These are offline protocol limits, not changes to live configuration or
spending authorization. No transport, retry, usage settlement or new deadline is
introduced. Provider compatibility, output size, latency within the existing
4.5-second server deadline, cost reservation and quality require separately
authorized validation before live integration. Production LLM calls and usage
logging remain disabled. Frozen candidates and recorded results are unchanged.
