## #12 Add flexible keyword matching

Owner:

Status: Draft

Date: Oct 29, 2026

Source: [Spec library](https://fcny-spec-library.jason-zeng94.chatgpt.site/#spec-12)

### Problem

- Exact word matching misses most real searches: people type "deck", misspell "fundraising", or ask about tools the library doesn't cover, like Claude Design (FR-004).

### Goal

- In the rules path used by #43, goal words are widened with the synonym table, small typos still match, and unknown tools fall back to adjacent ones.
- Aligned with GitHub #12 after the midpoint requirements update. #82 covers text-first discovery, #83 covers 6–8 results and #84 covers branding.

### Work order

- **Priority:** P1
- **Track:** Complete matching
- **Next action:** Finish Sheet-driven synonyms, adjacent tools and bounded typo handling.
- **Development dependencies:** #6 mappings, #9 snapshot and #11 engine.
- **Release / validation gates:** Keep the rules path usable independently of LLM enablement.

### Non-goals

- LLM calls in this keyword matcher; #43 owns MVP semantic ranking. Embedding-based search remains out of scope.
- Changing the ranking order from #11.

### Acceptance criteria

- AC-12.1 Synonyms
  - Given the goal "make a deck"
  - When the engine matches
  - Then presentation videos are matched through the synonym table (#6)
- AC-12.2 Normalization and typos
  - Given goal words, canonical tags or aliases
  - When matching runs
  - Then it case-folds, trims and tokenizes punctuation, matches whole words or phrases, and allows one edit only for tokens of at least five characters; "fundrasing" matches fundraising, and exact/alias matches take precedence
- AC-12.3 Uncovered tools
  - Given a dictionary tool without a catalog video, or a tool name in goal text
  - When matching finds its canonical alias or an unambiguous typo match
  - Then only explicit #6 adjacency supplies related tools, marked as related; "Claude Design" needs a mapping. Without one, other input signals and #13 fallbacks still apply
- AC-12.4 Synonyms from the Sheet
  - Given Eliot adds a synonym row
  - When the catalog endpoint (#9) next serves it
  - Then matching uses it with no code change
- AC-12.5 Flexible matching
  - Given validated Sheet vocabulary and synthetic search examples
  - When the rules matcher processes a query
  - Then use the validated #9 mapping snapshot rather than hardcoded vocabulary. Test exact/alias precedence, bounded typos, unfamiliar/adjacent tools and false positives; invalid mappings must not crash ranking.
- AC-12.6 Flexible matching
  - Given validated Sheet vocabulary and synthetic search examples
  - When the rules matcher processes a query
  - Then verify this deterministic matcher remains available when #43 is disabled, times out or fails.

### Deterministic prompt engine

- AC-12.7 Prompt interpretation
  - Given a free-text task and a validated catalog
  - When the deterministic prompt engine runs
  - Then it distinguishes source material, desired output, excluded tasks and tools, and preferred learning format without a network request.
- AC-12.8 Candidate compatibility
  - Given reviewed workflow and instructional metadata
  - When the engine expands and ranks candidates
  - Then it checks task compatibility and instructional evidence and returns at most eight distinct active catalog items with reasons; smaller eligible lists are allowed.
- AC-12.9 Determinism
  - Given the same catalog, request and matching configuration
  - When catalog order changes or the request repeats
  - Then recommendations and reasons remain deterministic and the engine does not mutate its inputs.
- AC-12.10 Compatibility across retrieval routes
  - Given free-text input, reviewed task evidence and any explicit method or tool constraints
  - When either an operation profile or a canonical task produces candidates
  - Then every candidate passes the same instruction, exclusion and capability checks before the result limit; keyword overlap alone cannot admit a candidate, and generic task matches must respect their source/output pair.
- AC-12.11 Natural task and component recognition
  - Given common task paraphrases, supplied documents or a named application
  - When interpreting and ranking free text
  - Then it recognizes source-grounded actions without requiring the canonical task name, treats a lack of reading time as context rather than a tool exclusion, prefers the specifically named application, and admits a cross-task transfer only under its declared component conditions; a direct requested method ranks before generic methods or learning-format preferences.
- AC-12.12 Partial methods for reusable helpers
  - Given a reusable-helper request and instruction for project context or a standalone cited lookup
  - When selecting transferable components
  - Then project context remains a lower-priority partial method, while the standalone lookup requires a declared source/reference or handbook lookup cue; neither component is treated as full helper-configuration instruction.
- AC-12.13 Clause scope and source-based task paraphrases
  - Given a task expressed through its source and requested action, including unread material or a rejected learning format
  - When recognizing operations and excluding tools
  - Then ordinary phrases such as IRS filings, distinct-record counts and reusable writing helpers can select instructional methods, comma-separated exclusions remain scoped to their clause, and word-for-word text does not exclude Microsoft Word; source-summary, review and design transfers require their declared requested component.

- AC-12.14 Action and source coverage
  - Given a supplied document, spreadsheet, curriculum or tracking brief and a requested action
  - When matching recognizes its registered workflow, including ordinary paraphrases
  - Then it keeps the primary task ahead of incidental summary or question wording, prefers document-to-slide instruction over a planning example for generic document conversion, and applies the shared compatibility checks. Cross-document grantee and reusable donor-writing transfers require their declared source or writing-method cues.

- AC-12.15 Task paraphrases and platform requirements
  - Given a task described with ordinary source/action wording, qualified exclusions or a required native platform
  - When free-text interpretation and candidate compatibility run
  - Then the matcher distinguishes a rejected role assumption from rejected rehearsal, preserves declared source/output goals, treats answer sheets and durations as content rather than application/material names, and requires native-platform and offline/bulk-operation teaching evidence before ranking. Named tools remain preferences unless the user requires their own controls or explicitly constrains the environment.

- AC-12.16 Conditional component recovery
  - Given a registered task and instruction for a substantial component such as source drafting, reference-file organization, row-count formulas, learner adaptation or handoff design
  - When selecting partial methods
  - Then every declared cue group must match the positive request, direct instruction ranks above eligible components, and component expansion retains shared compatibility and platform checks. Recurring example-based writing, identifier cleanup and teaching-resource setup may admit their scoped partials; extraction, initial drafting and accessible-course work do not imply unrelated cleanup, proofreading or generic workspace setup.

- AC-12.17 Primary operation selection
  - Given ordinary source/action wording or a complete specific operation alongside a generic task cue
  - When recognizing and selecting the primary operation
  - Then registered source/action paraphrases can recognize the task; approved spreadsheet terminology replacement takes priority over incidental record lookup, document version comparison over general proofreading, and reusable organizational writing helpers over program naming. Suppression requires every positive condition of the specific operation, respects negation and preserves scoped useful components under the shared compatibility checks.

- AC-12.18 Scoped workflow components
  - Given a recognized primary task and a requested component such as source verification, numeric checking, iterative activity planning, reference organization, explicit rehearsal, debugging or distinct counting
  - When expanding recommendations
  - Then require the component's declared positive cue groups and instructional evidence, retain shared compatibility checks, and rank the primary method before components. Printable output alone does not imply activity-helper setup, conversation preparation alone does not imply role-play practice, and generic files alone do not imply a project-organization method. Document comparison, source review and helper setup can retain their eligible partials without admitting unrelated fallback methods.

- AC-12.19 Source/action recognition and primary goals
  - Given ordinary action wording, supplied source material, a secondary requested component or a named application's controls
  - When recognizing operations and parsing the request
  - Then complete visibility audits take priority over incidental leave-policy words, attendance prioritization over data checks, conditional totals over generic formula generation, and reusable writing setup over speech repurposing. Registered grant, handover, rehearsal, review, intake, feedback-question and attachment phrases can select their methods. A statement that staff do not read supplied text preserves the document as a source; story creation can retain visual and translation outputs; quotation components do not imply a complete attributed-transcription method. Detected source material is retained where declared, ordinary numbers do not imply Apple Numbers, and a transfer cannot depend on an explicitly rejected method.

- AC-12.20 Requested partial-method coverage
  - Given a recognized goal and a requested source-checking, handover, rehearsal, facilitation, formula, citation, review or training-planning component
  - When selecting transferable instruction
  - Then admit only the declared component's positive conditions and teaching evidence, keep the primary method first and apply shared compatibility checks. Questions described as unanswered or refused-access test cases do not negate a following referral or citation instruction; explicit method exclusions remain active. Concrete peer-group safety boundaries can use policy instruction without automatically adding a general risk discussion.

- AC-12.21 General newsletter writing
  - Given a catalog video with instructional evidence for newsletter writing
  - When a user asks to draft or write a newsletter, including one for donors
  - Then recognize the writing operation without requiring adult-learner or reading-level context. Keep the more specific adaptation operation when requested, preserve published task labels, and apply the evidence, tool, capability and exclusion checks. Abstain on unverified exclusive-tool or offline requirements. Newsletter mentions in image, summary or signup-form requests do not imply newsletter writing; never fill the result list with unrelated videos.

- AC-12.22 General presentation creation
  - Given catalog instruction for creating presentations
  - When a user asks to create a slide deck, build slides or draft a presentation, including for fundraising
  - Then recognize presentation creation without requiring the canonical task name or a supplied document. Retain more specific source-conversion routes, explicit source compatibility, published task labels and shared instruction, tool, capability and exclusion checks. Tool exclusions also honor affirmative public metadata mentions and declared aliases when tags are missing. Image, summary, logo and review requests do not imply presentation creation; do not fill lists with unrelated videos.

### Open questions

- [ ] Confirm a short, tested stop-word list and phrase precedence with #7; tied fuzzy tool matches should remain unmapped rather than choose arbitrarily.

### Evidence required

- Test: engine tests for each AC on the fixture
- Log or metric: share of searches that hit the no-match fallback
- Manual check: try five synthetic misspellings and one ambiguous tool name
- Rollback signal: typo matching produces wrong picks in the golden test (#19); tighten the tolerance
- Review: acceptance evidence names the tested release or document version, unresolved failures and follow-up owners. Updating this specification does not mark the implementation complete.
