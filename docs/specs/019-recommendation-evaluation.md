## #19 Evaluate rules and LLM recommendations before MVP enablement

Owner:

Status: Approved

Date: Oct 19, 2026

Source: [Spec library](https://fcny-spec-library.jason-zeng94.chatgpt.site/#spec-19)

### Problem

- The existing golden test checks deterministic rules only. LLM picks can vary, and valid catalog IDs alone do not establish recommendation quality.

### Goal

- Compare both paths against the same approved profiles and gate production LLM enablement on relevance, failure handling and cost.
- Depends on #7, #9, #11–#13, #63 and #43. The live evaluation is separate from ordinary PR CI.

### Non-goals

- Paid model calls on every PR, or exact-string snapshots of nondeterministic live output.
- Changing approved good-pick labels merely to raise the score.

### Acceptance criteria

- AC-19.1 Shared benchmark
  - Given the 10 approved synthetic profiles and their ideal/good IDs from #7
  - When either recommendation path is evaluated
  - Then both use the same frozen catalog/config and score the final three displayed picks after validation and deduplication. Missing slots count as misses; edge cases do not change the 10-profile denominator
- AC-19.2 Relevance target
  - Given a candidate model/prompt configuration
  - When the rules benchmark and three live LLM trials run
  - Then each path achieves two ideal/good picks for at least eight of ten profiles in every run. Each live trial starts fresh without cached responses; fallback results are reported separately and cannot count as evidence that the LLM passed
- AC-19.3 Deterministic CI
  - Given any PR
  - When CI runs
  - Then it reports the rules score and tests the LLM contract, UI and failure cases with frozen or mocked responses and no provider credentials. A low rules relevance score remains a review warning; invalid fixtures, crashes or failed behavioral tests fail CI
- AC-19.4 Live evaluation record
  - Given a proposed prompt, model or candidate-policy change
  - When it is evaluated
  - Then the report records before/after per-profile results, model/prompt/catalog versions, repeat-run variation, fallback count, latency, tokens and cost. Ali or Eliot reviews two semantic-match examples and the weakest profiles; reviewed new wording is kept separate from the tuning examples
- AC-19.5 Failure checks
  - Given synthetic injection attempts, nonsense goals, unknown IDs, empty or retired catalogs, provider failures, rate limits and exhausted budgets
  - When the deployed preview is exercised
  - Then only valid active catalog items appear, #43's five-second fallback works, and no blocked request incurs a paid call. Prompt injection in both goal text and catalog descriptions is covered
- AC-19.6 Enablement gate
  - Given passing evidence and the runtime, privacy and budget decisions in #63
  - When production LLM recommendations are enabled
  - Then the owner records the approved configuration and report, verifies the rules-only switch, and adds LLM success/failure examples to #23's MVP demo. An unapproved configuration stays off; deploying the rules-only app remains possible

### Open questions

- [ ] Who owns the live evaluation and approves enablement with Ali or Eliot? Three trials and the per-run threshold are proposed MVP criteria.
- [ ] Confirm the evaluation allowance and expected monthly request volume so measured call cost can be checked against the approved production cap.

### Evidence required

- Test: CI rules benchmark, mocked LLM checks and the recorded live evaluation.
- Log or metric: per-profile relevance, outcome counts, latency and cost for the exact proposed configuration.
- Manual check: client review, failure demonstration and rules-only switch on the deployed preview.
- Rollback signal: relevance falls below the accepted target, safety checks fail or spend exceeds the agreed allowance; disable the LLM path and investigate.
