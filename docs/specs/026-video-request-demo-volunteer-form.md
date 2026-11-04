## #26 Video request and demo volunteer form

Owner:

Status: Draft

Date: Oct 29, 2026

Source: [Spec library](https://fcny-spec-library.jason-zeng94.chatgpt.site/#spec-26)

### Problem

- Ali and Eliot requested missing-topic suggestions paired with invitations to contribute demos. Requests must be reviewed without publishing unvetted material or exposing contact details.

### Goal

- Provide Eliot’s approved missing-topic prompt and demo-volunteer invitation, with restricted staff review and clear success/failure states.

### Work order

- **Priority:** P1
- **Track:** Requested feedback flows
- **Next action:** Build the request/volunteer form in parallel with #29 once wording and fields are approved.
- **Development dependencies:** #8 collection/access/retention decisions; Eliot's wording and a restricted staff review destination.
- **Release / validation gates:** #17 is a production-release dependency only. Development and preview testing can start before production deployment.
- Dependency correction: #8 approves collection and review details; #17 gates production release only. Preview development/testing can proceed before production deployment.

### Non-goals

- Publishing anything automatically.
- Accepting videos the Sprint didn't make.

### Acceptance criteria

- AC-26.1 Form
  - Given a peer learner
  - When they use the FCNY-owned form
  - Then topic requests work without contact details; demo offers collect only approved contact fields with self-contained consent stating staff follow-up and retention
- AC-26.2 Review sheet
  - Given a submission
  - When it arrives
  - Then it lands in a `Requests` tab in the same Restricted workbook as `Video Tracker` and `Usage`, separate from those tabs. Check Restricted sharing before initialization, each submission and retention cleanup. Contact details and free text never pass through `doGet`, published catalog snapshots or usage events. Existing explicitly configured separate review workbooks remain supported during migration.
- AC-26.3 Linked from thin results
  - Given a search that ends in a fallback
  - When results show
  - Then the page links to the form
- AC-26.4 Triage owner
  - Given new entries
  - When the named Sprint owner checks the queue weekly
  - Then each entry gets a review status; duplicate/spam entries can be dismissed, and contact details expire under the approved retention policy
- AC-26.5 Reviewed contribution requests
  - Given Eliot’s approved wording and a learner request or demo offer
  - When the form submits to staff review
  - Then use Eliot's approved missing-topic prompt and demo-volunteer invitation; record any required wording still outstanding.
- AC-26.6 Reviewed contribution requests
  - Given Eliot’s approved wording and a learner request or demo offer
  - When the form submits to staff review
  - Then confirm successful submission and show accessible, recoverable failure states without losing entered data.
- AC-26.7 Reviewed contribution requests
  - Given Eliot’s approved wording and a learner request or demo offer
  - When the form submits to staff review
  - Then no request or offered contribution publishes automatically; staff must review it before any catalog inclusion.

### Open questions

- [ ] Demo offers need contact details. Does Ali approve collecting them, given the privacy rule (#8)?
- [ ] Eliot supplies final wording. #8 confirms delivery priority, collection fields, retention and the FCNY review owner; the feature is requested, not merely an unconfirmed idea.

### Evidence required

- Test: none if it's a Google Form
- Log or metric: submissions per week
- Manual check: submit a test entry and see it in the review sheet
- Rollback signal: entries go unanswered for two weeks; unlink the form
- Review: acceptance evidence names the tested release or document version, unresolved failures and follow-up owners. Updating this specification does not mark the implementation complete.

### Implementation evidence, October 30, 2026

- Implementation and setup: [contribution-requests](../contribution-requests.md).
- This spec has its own PR branch, based on `8f5e4a6`.
- Final wording, collection/access/retention decisions, operating ownership and
  live Cloudflare/collector delivery remain open. The user confirmed no operating
  approvals are available. This update does not mark acceptance complete.

### Live rollout, November 2, 2026

Jason authorized topic suggestions and consented demo offers, approved both
prompts, and accepted private review, 30-day retention and weekly ownership.
See [the rollout record](../live-feedback-requests.md) for configuration,
restricted review access and delivery verification. This does not assert separate
Ali/Eliot approval or completion of every original acceptance criterion.

### Request location correction, November 3, 2026

Jason requested the same-workbook `Requests` tab to match Eliot's stated
preference. This changes storage location only; approved prompts, consent,
weekly review, status values and 30-day request retention stay in effect.
Feedback events remain in `Usage`, with their existing separate aggregate report.
Native deployment and browser-to-Sheet verification are recorded in
[contribution requests](../contribution-requests.md).
