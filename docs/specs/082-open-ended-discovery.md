## #82 Make open-ended discovery the primary search experience

Owner:

Status: Draft

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

- [ ] Should function and tool selectors remain as optional refinements, or be removed? Record Ali and Eliot’s decision.
- [ ] Approve task, role and mission-based example prompts.

### Evidence required

- Test: submit without selectors, blank inputs, maximum length, Enter/button equivalence and no pre-submit requests.
- Log or metric: one search context per submission and no raw goals in URLs/storage/analytics.
- Manual check: nontechnical users search using tasks, roles and organizational missions with keyboard and mobile access.
- Rollback signal: required categories, dead ends or provider-disclosure regressions; restore the last working intake.
