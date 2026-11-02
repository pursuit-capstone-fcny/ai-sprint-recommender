## #29 "Was this helpful?" feedback

Owner:

Status: Draft

Date: Oct 29, 2026

Source: [Spec library](https://fcny-spec-library.jason-zeng94.chatgpt.site/#spec-29)

### Problem

- The team can't tell which picks miss, so tuning relies on 10 sample profiles only (FR-013).

### Goal

- Collect private video usefulness feedback for authorized Sprint staff, without public vote totals or automatic ranking changes.

### Work order

- **Priority:** P1
- **Track:** Requested feedback flows
- **Next action:** Build private usefulness feedback in parallel with #26 on the existing event foundation.
- **Development dependencies:** #16 logging contract; #8 collection decisions and approved question wording.
- **Release / validation gates:** Final release requires restricted reporting and verified delivery; no public vote totals or automatic reranking.

### Non-goals

- Ratings that change ranking automatically; that's #39.
- Comment boxes.
- Public like/dislike counts or popularity scores. Automatic ranking changes remain separately scoped in #39.

### Acceptance criteria

- AC-29.1 Prompt
  - Given a displayed recommendation and approved feedback policy
  - When a learner submits or changes a usefulness response
  - Then accessible, labeled usefulness controls expose their selected state and announce changes, submission success and recoverable failure.
- AC-29.2 Logged
  - Given a vote
  - When it is submitted
  - Then the versioned `feedback` event carries `youtubeId`, rank, `searchId`, `helpful` and a monotonically increasing `voteRevision`; existing event versions remain readable
- AC-29.3 One effective vote
  - Given a vote for the same session/video
  - When the learner changes it or delivery is reordered
  - Then the event log stays append-only; reporting uses the highest revision as the one effective vote, retries reuse `eventId`, and rank/search context records where the change occurred
- AC-29.4 Private usefulness feedback
  - Given a displayed recommendation and approved feedback policy
  - When a learner submits or changes a usefulness response
  - Then only authorized staff can read feedback reports; no public vote totals, likes/dislikes or popularity scores appear.
- AC-29.5 Private usefulness feedback
  - Given a displayed recommendation and approved feedback policy
  - When a learner submits or changes a usefulness response
  - Then Ali and Eliot approve question wording and decide whether search usefulness needs a separate question.
- AC-29.6 Private usefulness feedback
  - Given a displayed recommendation and approved feedback policy
  - When a learner submits or changes a usefulness response
  - Then feedback collection does not automatically change ranking; #39 remains separately scoped.

### Open questions

- [ ] Show the prompt immediately, or only after a play?
- [ ] Approve question wording and whether search usefulness requires a separate question. #8 confirms collection/reporting details and delivery priority.

### Evidence required

- Test: feedback schema, changed votes, duplicate delivery and reversed arrival order
- Log or metric: helpful rate by video
- Manual check: vote up then down; the event log preserves both changes while the aggregate counts one down vote
- Rollback signal: feedback events fail validation and get dropped
- Review: acceptance evidence names the tested release or document version, unresolved failures and follow-up owners. Updating this specification does not mark the implementation complete.

### Implementation evidence, October 30, 2026

- Implementation and setup: [private-feedback](../private-feedback.md).
- This spec has its own PR branch, based on `8f5e4a6`.
- Final wording, collection/access/retention decisions, operating ownership and
  live Cloudflare/collector delivery remain open. The user confirmed no operating
  approvals are available. This update does not mark acceptance complete.

### Live rollout, November 2, 2026

Jason authorized enabling private video feedback and approved "Was this helpful?".
See [the rollout record](../live-feedback-requests.md) for configuration,
restricted reporting access, regression coverage and deployment verification.
This authorization does not assert separate Ali/Eliot approval.
