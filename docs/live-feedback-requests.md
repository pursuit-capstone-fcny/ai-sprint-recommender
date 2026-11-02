# Live feedback and requests, November 2, 2026

Jason requested live usefulness feedback, topic suggestions and demo offers,
including backend collection. He approved the following wording and policy:

- Video question: "Was this helpful?"
- Topic prompt: "What topic would you like us to cover?"
- Demo invitation: "Would you like to share a demo?"
- Private review by Jason Zeng, with Jason owning weekly triage.
- Requests and demo-offer email addresses expire after 30 days.
- Email is collected only for demo offers, after explicit consent.

This records Jason's rollout authorization, not separate approval from Ali or
Eliot. The existing public catalog and video recommendation logic are unchanged.

## Configuration

Production and preview workflows now pass the feedback and request settings to
Vite. Repository variables `FEEDBACK_PRODUCTION_ENABLED` and
`REQUESTS_PRODUCTION_ENABLED` enable production; the corresponding
`FEEDBACK_PREVIEW_ENABLED` and `REQUESTS_PREVIEW_ENABLED` control previews.
`FEEDBACK_QUESTION` contains the question, and `REQUESTS_CONFIG` contains the
existing collector endpoint and the approved public policy. Private workbook
IDs and credentials are never included in browser configuration.

Feedback can create an ephemeral usage session independently of automatic usage
logging. With `USAGE_PRODUCTION_ENABLED=false`, searches, impressions and clicks
remain suppressed. Only an explicit, validated feedback vote can be delivered.
Changed votes increment the revision; retries preserve their original event.
The existing collector keeps its one-day usage/feedback retention and hourly
cleanup. Topic and demo requests have their separate 30-day retention.

The existing collector project receives the current Apps Script test bundle,
preserving its test setup entry point, existing deployment URL, anonymous POST
access and existing OAuth scopes. The editor-only setup source is
[`feedback-rollout.gs`](../scripts/feedback-rollout.gs). Its two scheduled
operations are installed in the editor, avoiding an additional OAuth scope for
programmatic trigger management.

- [Private feedback report](https://docs.google.com/spreadsheets/d/18CppHjw7Ve5cd2oju8DMCbKdI0N6lDnP64vkaBGtzvo/edit).
- [Private request review queue](https://docs.google.com/spreadsheets/d/1AVYhKdGJFSRUoKNyUHTPb4UmD6DJrCA8luuCSeWiO7c/edit).

Both owner-account interfaces showed "Private to only me". Signed-out HTTP
reads returned 401 for each workbook. The connected Drive account also lacked
access, returning 404. No sharing or ownership changes were made.

## Verification

Before the fix, the live page had no usefulness controls or request form. The
deployed collector had no request/feedback handlers or settings. The browser
regression test reproduced the missing Helpful button when automatic logging
was disabled. It now saves a helpful vote and a changed response while asserting
that searches, impressions and clicks send no usage requests.

Typecheck, lint, 1,051 tests across 73 files, all production builds, formatting
of changed files and `git diff --check` pass.

## Rollback

Disable both production feature variables and rebuild to hide the controls.
Disable collector `FEEDBACK_ENABLED` and `REQUESTS_ENABLED` to stop writes.
Leave retention and report cleanup running while retained data remains. Preserve
support for schema-version-2 feedback in any collector rollback.
