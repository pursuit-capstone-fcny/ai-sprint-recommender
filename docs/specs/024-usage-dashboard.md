## #24 Usage dashboard for the Sprint team

Owner:

Status: Draft

Date: Oct 28, 2026

Source: [Spec library](https://fcny-spec-library.jason-zeng94.chatgpt.site/#spec-24)

### Problem

- Eliot wants to know who uses the library, when and where from, and the proposal asks which topics are under-watched (FR-014). The usage log alone is rows, not answers.

### Goal

- After Ali and Eliot confirm next-release scope at #8, deliver the agreed restricted shared view of searches, impressions, clicks, traffic sources and available private feedback.

### Non-goals

- YouTube Analytics data.
- Identifying people or claiming clicks prove watching; the proposed MVP log contains only approved fields.

### Acceptance criteria

- AC-24.1 Owned by FCNY
  - Given the Looker Studio dashboard
  - When ownership and access are checked
  - Then FCNY owns it, only named Sprint staff can view it, and it reads a restricted aggregate of #16 events joined to a public-field catalog snapshot for topic totals
- AC-24.2 Trends
  - Given a week of events
  - When Eliot opens the dashboard
  - Then it counts distinct event/search IDs by received date in America/New_York, excludes `src=team` by default, separates modes and click actions, and labels counts as clicks rather than watches; refresh time and zero-data states are visible
- AC-24.3 Gaps
  - Given search outcomes and catalog task tags
  - When the dashboard loads
  - Then weak searches have zero strong matches or use fallbacks; it lists their canonical tags and counts. Under-watched means active topics with impressions but no clicks in the selected period; zero-impression topics are shown separately
- AC-24.4 Access
  - Given a Sprint staff member without YouTube channel access
  - When they open the link
  - Then they can view the dashboard
- AC-24.5 Approved staff reporting
  - Given FCNY’s dashboard scope and reporting decisions from #8
  - When the team commits and verifies the reporting implementation
  - Then record Ali and Eliot's decision on next-release inclusion, metrics, authorized viewers, retention and refresh/reporting responsibilities before committing dashboard delivery.
- AC-24.6 Approved staff reporting
  - Given FCNY’s dashboard scope and reporting decisions from #8
  - When the team commits and verifies the reporting implementation
  - Then include available private feedback from #29 only through approved restricted reporting. Define team/test exclusions and do not expose raw logs.
- AC-24.7 Approved staff reporting
  - Given FCNY’s dashboard scope and reporting decisions from #8
  - When the team commits and verifies the reporting implementation
  - Then keep clicks distinct from watch completion. Completion/drop-off tracking requires separate feasibility and scope agreement.
- AC-24.8 Approved staff reporting
  - Given FCNY’s dashboard scope and reporting decisions from #8
  - When the team commits and verifies the reporting implementation
  - Then record the Airtable purpose/integration decision from #8. Retain the proposed Looker Studio approach unless confirmed requirements justify a change.

### Open questions

- [ ] Confirm these metric definitions at #8. Unmatched wording is unavailable under Option A; the dashboard must not promise to list those original queries.
- [ ] Who owns the aggregate refresh, and is a daily refresh sufficient?
- [ ] Is the dashboard required in the next release, and what metrics, viewers, retention and refresh cadence are approved?
- [ ] What does FCNY currently use Airtable for, and is integration required? Completion/drop-off tracking needs a separate feasibility and scope decision.

### Evidence required

- Test: none
- Log or metric: dashboard totals match a manual count of the usage-log tab for one day
- Manual check: Eliot answers "what was searched most last week" from it
- Rollback signal: numbers disagree with the log
- Review: acceptance evidence names the tested release or document version, unresolved failures and follow-up owners. Updating this specification does not mark the implementation complete.
