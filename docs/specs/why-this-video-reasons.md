# Change Proposal: Per-video "Why this video" reasons

Owner:

Status: Draft

Date: Nov 3, 2026

## Problem

- Every Haiku result card says "Suggested for your goal". The
  `catalog-pick-evidence-v8` prompt already asks Haiku for a rationale per
  pick, and the server discarded it after checking the quote.
- Shown as written, v8 rationales read like grading notes: 28% of sampled
  cards used terms such as "transferable method" or "substantial component".
- The curated default and fallback collections used two fixed strings, so all
  eight cards in a collection read the same.

## Goal

- Haiku cards show that pick's rationale, written for the visitor.
- Curated cards show a reason built from each video's public task and tool tags.
- This amends [spec 043](043-llm-recommendations.md): it narrows the
  "LLM-written descriptions or explanations" non-goal and changes the reason
  source in AC-43.3.

## Non-goals

- Model, grading or quote-validation changes.
- LLM-written titles or descriptions. Those still come from the catalog.
- Changes to deterministic-engine reasons.
- Filtering picks whose rationale calls them irrelevant.
- Logging reasons. Usage events stay limited to dictionary values.

## Acceptance Criteria

- AC-REASON-1 Haiku rationale on cards
  - Given a valid Haiku response whose picks pass the quote check
  - When result cards render
  - Then each card shows its own pick's rationale, with whitespace trimmed and
    collapsed, and capped at 200 characters by cutting at the last whole word
    and adding "…". Grade 1 picks start with
    "Partial match: ". Reasons stay attached to their video when the
    task-dedupe rule reorders picks.
- AC-REASON-2 Neutral text fallback
  - Given a pick with an empty rationale, a rationale that repeats 8 or more
    consecutive words from the goal (ignoring case and punctuation), or a
    response from the older rank-slot provider
  - When cards render
  - Then that card shows "Suggested for your goal", or "A partial match for
    your goal" for a grade 1 pick. The rest of the result set is unchanged.
- AC-REASON-3 Response contract
  - Given a success response
  - When the server or client validates it
  - Then an optional `reasons` array, if present, has the same length as
    `youtubeIds` and holds non-empty strings of at most 215 characters (200 plus the
    "Partial match: " prefix). A
    mismatched length is an `invalid-response`.
- AC-REASON-4 Curated reasons from tags
  - Given a default or fallback collection video with at least one task or
    tool tag
  - When the collection renders
  - Then default cards read "Beginner pick: shows {tools} for {tasks}." and
    fallback cards read "Another direction: covers {tasks} with {tools}."
    {tasks} is the first two task tags joined with "and", or only the first
    when the sentence would exceed 90 characters. {tools} is up to two tool
    tags joined with "and". A clause whose tags are missing is dropped.
- AC-REASON-5 Curated reasons without tags
  - Given a curated video with no task or tool tags
  - When the collection renders
  - Then it keeps the earlier text: "Marked Start here by the library." or
    "A general suggestion for exploring the library."
- AC-REASON-6 Privacy
  - Given any reason text
  - When usage events are built
  - Then no reason text appears in the event. It is only shown to the visitor
    who submitted the goal.
- AC-REASON-7 Visitor-facing rationale prompt
  - Given a nonblank Haiku submission
  - When the endpoint asks Haiku
  - Then `catalog-pick-evidence-v9` asks for a rationale of at most 15 words
    written as a plain-language note to the visitor: what the video shows
    them how to do and how that helps, which part it covers when partial, in
    its own words, without mentioning grades or the assessment. Everything
    else in the v8 prompt, schema and validation is unchanged.

## Open Questions

- [ ] Haiku still pads task lists with grade 1 picks it sometimes calls
      irrelevant (1 card in 57 calls for v9, 5 for v8). Revisit the padding
      rule or add a filter if this shows up in real use.

## Evidence Required

- Test: rationale shown per card; reason follows its video through dedupe;
  grade 1 prefix, including the neutral text; empty rationale and rank-slot
  fallback; length cap at a whole word; goal echo at 7 words (kept) and 8
  words (replaced); mismatched `reasons` length rejected by server and
  client; curated sentences with zero, one and two tools and with the
  90-character task limit; untagged curated videos; v9 prompt wording.
- Log or metric: none new.
- Manual check: preview deploy, one Haiku submission on desktop and mobile,
  confirming long rationales wrap within the card.
- Rollback signal: off-topic or misleading rationales; stop sending `reasons`
  and the client shows the neutral text.

### Prompt comparison, November 3

Haiku 5.5 on the published 89-video catalog, 19 goals (the ten 2026-10-28
benchmark profiles and nine extra goals), three runs each, 57 calls per prompt.
Cost uses cache pricing.

| Prompt                         | Median / p90 latency | Cost per call | Cards with grading terms | Over 160 characters | Ideal video in top 3 |
| ------------------------------ | -------------------- | ------------- | ------------------------ | ------------------- | -------------------- |
| v8 (current)                   | 3.25 / 4.21 s        | $0.00050      | 96 of 347                | 4                   | 30 of 30             |
| v9 (15-word visitor rationale) | 3.14 / 4.24 s        | $0.00048      | 9 of 332                 | 5                   | 30 of 30             |
| Separate 20-word reason field  | 3.68 / 4.75 s        | $0.00053      | 2 of 257                 | 11                  | 30 of 30             |

Pick overlap with v8 (0.57) was close to v8's run-to-run overlap (0.61). Grade
1 rationales described themselves as partial in only 32% to 48% of cards in
every prompt, so the "Partial match: " prefix stays. No card in 1,239 repeated
more than 7 consecutive goal words.
