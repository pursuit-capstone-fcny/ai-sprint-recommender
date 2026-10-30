## #43 Add LLM-driven recommendations to the MVP

Owner:

Status: Approved

Date: Oct 19, 2026

Source: [Spec library](https://fcny-spec-library.jason-zeng94.chatgpt.site/#spec-43)

### Problem

- The rules matcher misses goals whose meaning does not match catalog wording. #43 currently sits in Backlog, while the MVP now includes LLM-driven recommendations.

### Goal

- Move #43 to MVP. Use the existing intake form to request LLM-ranked catalog videos, with #11–#13 providing the rules fallback.
- Depends on #63 and #10–#14. Production enablement also depends on #19.

### Non-goals

- A conversational interface, extra required form inputs or saved personal profiles.
- LLM-written descriptions or explanations. Cards use catalog content and verified matching signals.

### Acceptance criteria

- AC-43.1 Existing form
  - Given a valid function area, optional goal and tools
  - When someone submits Find videos
  - Then one submission starts at most one LLM request and shows an accessible loading state. Blank goals remain valid; "Not sure" with no goal or tools goes straight to #13's Start-here set without a paid call
- AC-43.2 Ranked results
  - Given a valid response from #63
  - When results render
  - Then show up to eight eligible distinct picks under #83, with the original top-three task-diversity ordering retained. Smaller relevant sets stay smaller. Every ID belongs to the same validated catalog version held by the page. Semantic matches need not pass #12's keyword test; fixed #11 comparator tiers apply to the rules path
- AC-43.3 Card content
  - Given LLM picks
  - When cards render
  - Then titles, links and descriptions come from the catalog. Reasons use verified tag matches or the neutral text "Suggested for your goal"; cross-area picks are labeled. Eight is the hard maximum; there is no Show more beyond that limit
- AC-43.4 Reliable fallback
  - Given a disabled flag, provider failure, invalid or mismatched response, fewer than two eligible LLM picks, or no response within five seconds of submission
  - When the page chooses its result set
  - Then it uses the complete #11–#13 result set, marks it as standard matching, and shows the existing unavailable state if the catalog is empty. It does not mix partial model output into fallback results
- AC-43.5 Latest submission wins
  - Given changed inputs, another submission or a completed fallback
  - When an earlier request finishes
  - Then it cannot replace the displayed results or create extra impressions. Editing fields, rerendering make no new provider calls
- AC-43.6 Disclosure and logging
  - Given the approved data policy from #8
  - When someone uses the form
  - Then the notice explains that entered goals and selected options go to the approved provider and asks people to omit personal information. Raw goals stay out of URLs, storage and #16 logs. Usage events record `recommendationEngine` as `llm` or `rules`, a bounded fallback reason and versions, while preserving existing `mode` values and event deduplication

### Open questions

- [ ] Confirm the proposed five-second wait and minimum of two LLM picks. #13 already handles small or empty catalogs.
- [ ] Approve the short AI disclosure and update #20's explainer for semantic ranking, standard matching and cost/failure fallback.

### Evidence required

- Test: success, blank inputs, thin results, catalog mismatch, timeout, rapid resubmission, stale responses, the eight-card cap and event counts.
- Log or metric: LLM versus rules result sets, fallback reasons and submission-to-results latency, without raw goals.
- Manual check: signed-out desktop, mobile and keyboard use on preview; one LLM result and one forced fallback.
- Rollback signal: invalid cards, stuck loading or stale results; disable LLM recommendations and verify the rules path.
