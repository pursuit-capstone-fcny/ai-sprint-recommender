## #43 Add LLM-driven recommendations to the MVP

Owner:

Status: Approved

Date: Oct 19, 2026

Source: [Spec library](https://fcny-spec-library.jason-zeng94.chatgpt.site/#spec-43)

### Problem

- The rules matcher misses goals whose meaning does not match catalog wording. #43 currently sits in Backlog, while the MVP now includes LLM-driven recommendations.

### Goal

- Move #43 to MVP. Use an engine toggle on the existing intake form. Deterministic runs #102 locally; Haiku V1 independently assesses the complete catalog. Neither is a prefilter or automatic fallback for the other.
- Depends on #63 and #10–#14. Production enablement also depends on #19.

### Non-goals

- A conversational interface, extra required form inputs or saved personal profiles.
- LLM-written descriptions or explanations. Cards use catalog content and verified matching signals.

### Acceptance criteria

- AC-43.1 Existing form
  - Given #82's plain-language description and optional function area and tool refinements
  - When someone submits Find videos
  - Then Deterministic is selected initially. Changing the toggle makes no request. A deterministic task submission runs #102 locally; a Haiku submission makes at most one server request with an accessible loading state. Haiku requires a nonblank description. Blank deterministic input retains catalog browsing
- AC-43.2 Ranked results
  - Given a valid response from #63
  - When results render
  - Then the first three eligible distinct picks follow the model's order, with #11's task-duplicate rule applied. Every ID belongs to the same validated catalog version held by the page. Semantic matches need not pass #12's keyword test; fixed #11 comparator tiers apply to the rules path
- AC-43.3 Card content
  - Given LLM picks
  - When cards render
  - Then titles, links and descriptions come from the catalog. Reasons use verified tag matches or the neutral text "Suggested for your goal"; cross-area picks are labeled. Display at most eight validated picks with no Show more and no minimum count; do not fill nonempty match lists. Zero-match fallbacks follow the November 2 update below
- AC-43.4 Independent outcomes
  - Given the selected engine returns no matches or fails
  - When the page chooses its result set
  - Then preserve the no-confident-matches or unavailable outcome and show up to six clearly labeled general fallback videos, per [the no-match fallback spec](no-match-fallbacks.md). This does not run the other engine, retry the provider or turn fallback suggestions into matches
- AC-43.5 Latest submission wins
  - Given changed inputs, another submission or an engine switch
  - When an earlier request finishes
  - Then it cannot replace the displayed results or create extra impressions. Editing fields, rerendering and expanding results make no new provider calls
- AC-43.6 Disclosure and logging
  - Given the approved data policy from #8
  - When someone uses the form
  - Then the notice explains that entered goals and selected options go to the approved provider and asks people to omit personal information. Raw goals stay out of URLs, storage and #16 logs. Usage events record `recommendationEngine` as `llm` or `rules`, a bounded outcome reason and versions, while preserving existing `mode` values and event deduplication. Actual fallback cards use local `rules` origin metadata and the bounded AI outcome reason; unavailable attempts without displayed cards create no phantom events

### Open questions

- [ ] Production AI enablement remains subject to #19 and #63. This integration keeps paid calls and production usage logging disabled.
- [ ] Approve the short AI disclosure and update #20's explainer for semantic ranking, standard matching and cost/failure fallback.

### Evidence required

- Test: success, blank inputs, thin results, catalog mismatch, timeout, rapid resubmission, stale responses, Show more and event counts.
- Log or metric: LLM versus rules result sets, fallback reasons and submission-to-results latency, without raw goals.
- Manual check: signed-out desktop, mobile and keyboard use on preview; one LLM result and one forced fallback.
- Rollback signal: invalid cards, stuck loading or stale results; disable LLM recommendations and verify the rules path.

### Text-first intake integration from #82

The description is the first input. Examples populate it without requesting
recommendations. Function area and tool selectors are optional refinements,
provisionally retained pending Ali and Eliot's decision through #8. One Find
videos or Enter submission uses the same request and fallback behavior above.
The matching explainer describes this flow; provider disclosure and existing
privacy protections continue to apply. This does not enable LLM calls or change
the separate #83 result-count policy.

### Demo engine selection

The user-requested engine toggle supersedes automatic fallback and result
padding in the earlier #43/#83 text. Task requests display zero to eight
compatible picks. V1 retains its existing two-primary-task gate and all 89
complete public catalog rows, with no deterministic annotations, rankings or
prefiltering sent to Haiku. Model/prompt settings and validation are unchanged.
A private deterministic adapter maps equivalent Sheet task names to #102's
vocabulary; cards retain their original public metadata and this projection
never enters Haiku's context. Broad or unknown tags do not imply specific
methods. The AI browser window is 35 seconds, with a 34.5-second V1 server deadline.
Deterministic matching has no provider wait. Historical candidates and recorded
results remain on their archived branches; this integration makes no new
quality claim and performs no paid evaluation.

### November 2 no-match fallback update

The user's subsequent request supersedes the empty/no-replacement presentation
above: completed nonblank submissions with zero matches now show up to six
general catalog suggestions. Every card is labeled "Fallback video", and the
original no-match or unavailable message remains visible. Nonempty lists are
not filled, engine validation remains independent, and no extra provider call
is made. See [acceptance criteria](no-match-fallbacks.md).

### November 2 fast pick update

This supersedes the V1 two-primary-task gate, prompt and 35-second timing
sentences above. The no-match fallback update is unchanged.

- AC-43.7 Fast catalog picks
  - Given a nonblank Haiku submission
  - When the endpoint asks Haiku
  - Then `catalog-pick-evidence-v5` returns at most eight quoted picks within a
    6.5-second server deadline inside a 7-second browser window, and the
    notice says results can take up to 7 seconds. A timeout shows the
    unavailable outcome with fallback videos; there is no paid retry
- AC-43.8 Task tags reorder only
  - Given valid Haiku picks
  - When the page selects cards
  - Then task tags may move a different-task pick into the first three but
    never reject the answer. One pick or picks sharing one task still show as
    AI results; zero picks or noWork follow the no-match fallback update
