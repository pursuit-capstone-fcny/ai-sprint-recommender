# Spec: Evaluate recommendations

- **Issue:** #19
- **Status:** Numeric relevance gate passed; client review and production approval pending
- **Depends on:** #7, #43, #63 and #8 approvals
- **Source:** [Approved scope](../docs/specs/019-recommendation-evaluation.md)

## Acceptance criteria

### AC-19.1: Frozen benchmark

- **Given** ten synthetic profiles, reviewed ideal/good IDs and one frozen
  public catalog, **when** evaluation starts, **then** hashes, canonical inputs,
  active IDs, unique profile IDs and label reasons are validated. Both paths
  score the same first three cards selected by the browser. Missing slots miss.

### AC-19.2: Independent trial scores

- **Given** three fresh LLM trials, **when** scored, **then** every trial needs
  two good picks for at least eight of ten profiles. Rules fallbacks appear
  separately and never count as LLM passes. Edge cases stay outside that total.

### AC-19.3: CI without provider calls

- **Given** a PR, **when** CI runs, **then** the rules score and frozen mock
  trial report appear in the summary. Low rules relevance warns; invalid
  fixtures, crashes and failed behavior tests fail. Draft labels and mock
  trials are visibly ineligible as live quality evidence.

### AC-19.4: Comparison evidence

- **Given** reports using the same frozen benchmark, **when** compared,
  **then** per-profile before/after results, displayed IDs, versions, variation,
  fallbacks, latency, tokens and measured cost are preserved. Missing metrics
  remain missing. Review of semantic examples, weak profiles and held-out
  wording is recorded separately by the owner.

### AC-19.5: Failure handling

- **Given** injection-like text, invalid output, timeouts or server fallback,
  **when** evaluated, **then** selection still uses validated active catalog
  IDs and reports rules fallback. Paid trials use the dedicated test endpoint,
  one request per profile, no retry and a five-second deadline. Partial
  evidence is saved before stopping on candidate mismatch.

### AC-19.6: Enablement stays manual

- **Given** missing profile, runtime, privacy or budget approval, **when** a
  live command is attempted, **then** it dispatches zero requests. An explicit
  paid opt-in and allowance for thirty requests are required. Neither passing
  mocks nor a complete report changes production flags.

## Remaining evidence

Jason's initial labels remain unchanged. The [V4 evaluation](../docs/evaluation/2026-10-21/quality-rerun.md)
scores rules 8/10 and LLM 8/10, 10/10 and 9/10, with measured cost for all 30
benchmark calls. A separate wording probe timed out without attributable cost;
the broader workflow evidence check failed. Production remains disabled.

- Ali/Eliot's final label/catalog, semantic and weak-profile review.
- Wording robustness and cold-request follow-up; preserve failed probes.
- Production runtime/privacy/budget approval and #23 live AI demo evidence.

Commands and report formats: [Evaluation guide](../docs/recommendation-evaluation.md).
