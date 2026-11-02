## #82 Make open-ended discovery the primary search experience

Owner:

Status: Implemented locally; client validation pending

Date: Oct 29, 2026

Source: [Spec library](https://fcny-spec-library.jason-zeng94.chatgpt.site/#spec-82)

### Problem

- Category-first input assumes learners know the library’s vocabulary. Ali and Eliot want descriptions of work, roles, organizational missions and learning needs.

### Goal

- Make plain-language discovery the primary input while preserving approved privacy, request and fallback behavior.

### Work order

- **Priority:** P1
- **Track:** Revised core experience
- **Next action:** Implement text-first discovery alongside #83; settle optional selector design through #8.
- **Development dependencies:** Existing #10/#14 foundations, not a requirement to rebuild or close them before design starts.
- **Release / validation gates:** Final acceptance needs client-approved selector behavior and updated explainer.

### Non-goals

- A required multistep interview, login or saved profile.
- Choosing a new ranking architecture or creating job-title tags.

### Acceptance criteria

- AC-82.1 Plain-language input
  - Given the loaded catalog and text-first intake
  - When a learner describes their task, role or organizational mission
  - Then The main input accepts descriptions of tasks, roles, organizational missions or learning needs.
- AC-82.2 Examples
  - Given the loaded catalog and text-first intake
  - When a learner describes their task, role or organizational mission
  - Then Examples demonstrate task, role and mission-based searches.
- AC-82.3 Optional refinements
  - Given the loaded catalog and text-first intake
  - When a learner describes their task, role or organizational mission
  - Then A user can submit without selecting a function area or tool.
- AC-82.4 Selector decision
  - Given the loaded catalog and text-first intake
  - When a learner describes their task, role or organizational mission
  - Then Function and tool selectors follow the agreed design as optional refinements or are removed; record the decision with Ali and Eliot.
- AC-82.5 Single-step discovery
  - Given the loaded catalog and text-first intake
  - When a learner describes their task, role or organizational mission
  - Then Results appear without a required follow-up interview.
- AC-82.6 Documentation
  - Given the loaded catalog and text-first intake
  - When a learner describes their task, role or organizational mission
  - Then Update the matching explainer and affected specs to describe the revised flow.

### Open questions

- [x] Implementation direction from Jason on November 2, 2026: remove function-area and tool selectors. This records the implementation request, not a claim of separate Ali/Eliot sign-off.
- [ ] Approve task, role and mission-based example prompts.

### Evidence required

- Test: submit without selectors, blank inputs, maximum length, Enter/button equivalence and no pre-submit requests.
- Log or metric: one search context per submission and no raw goals in URLs/storage/analytics.
- Manual check: nontechnical users search using tasks, roles and organizational missions with keyboard and mobile access.
- Rollback signal: required categories, dead ends or provider-disclosure regressions; restore the last working intake.

### Implementation and validation notes

The intake starts with one plain-language text field accepting up to 500
characters. Task, role and mission examples fill the field without submitting.
The learner selects Find videos or presses Enter to submit once and move focus
to results. There is no required interview or selector choice. Blank input keeps
the existing Start-here fallback and makes no provider request.

Function area and tool selectors remain in a collapsed optional refinement
section. Selected values stay visible in its summary even when closed. This is
a provisional implementation choice for review, not a recorded agreement with
Ali and Eliot. AC-82.4 and example approval remain release gates through #8.
Do not mark those approvals complete based on this implementation.

The matching explainer describes text-first discovery, optional refinements and
standard matching versus AI suggestions. See
[the discovery flow](../recommendation-runtime.md#text-first-discovery).
No ranking architecture, result-count policy, provider configuration or data
permission changes are included. #83 owns the expanded result-count policy.

`src/pages/Discovery.test.tsx` covers descriptions of tasks, roles, missions and
learning needs; submission without selectors; blank and whitespace input;
500-character bounds; button/native form submission; example selection without
requests; and one search context per completed submission. It also checks that
raw descriptions stay out of usage events, browser storage and URL changes.
Existing page tests cover optional selector changes and clearing the form.

Still required for release: Ali and Eliot's selector and example decisions,
nontechnical learner checks, and desktop/mobile keyboard checks on the
Cloudflare preview. Local automated checks do not supply client approval.

Local verification on Oct 30, 2026: `pnpm typecheck`, `pnpm lint`, `pnpm test`
and `pnpm build` passed, including all 686 tests. Changed files pass Prettier
and `git diff --check`. A fictional-catalog browser check verified Enter
submission and result focus on desktop, example selection, and keyboard
expansion and selection of refinements at a 390-pixel mobile viewport, with no
horizontal overflow. Cloudflare preview validation has not been performed.

### November 2, 2026 brand redesign

The approved design replaces the provisional collapsed refinements with one
freeform textarea and removes the example-fill buttons. The existing engine
switch remains by Jason's explicit instruction. Enter submits the form;
Shift+Enter adds a line. The earlier optional-selector implementation notes above
are historical. See [the redesign criteria](brand-kit-redesign.md) for the current
layout and [the runtime](../recommendation-runtime.md#text-first-discovery) for
current request behavior. Independent matching, cancellation, privacy and result
eligibility policies are unchanged. Client validation gates remain separate.
