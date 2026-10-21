# #16 Log searches and clicks through Apps Script

The approved spec and acceptance criteria are in
[docs/specs/016-usage-logging.md](../docs/specs/016-usage-logging.md).

The backend implements validation, locked deduplication, write caps and retention.
The browser follow-up adds test-preview delivery and an explicit Find videos
submission using the UI from #72. Production logging stays off pending #8.

- Given draft fields change, when Find videos is submitted, then results update
  and one search is logged. Each submission gets a new search ID, including an
  identical repeat. Typing alone does not change the displayed results or logs.
- Given a result context, when cards render, expand or rerender, then each card
  gets one impression in that context. Play and Watch on YouTube record their
  target and displayed rank without waiting for delivery. Copy link is not a click.
- Given initial picks or Clear, when default cards display, then a recommendation
  context logs impressions without inventing a search submission.
- Given logging is enabled for the test preview, when a page visit starts, then
  its session ID stays in memory through rerenders and resets on reload. The
  form discloses collection and the test retention policy.
- Given invalid fields, unknown tags, a stalled request or a full queue, when
  delivery runs, then it fails without blocking the page. The queue is bounded,
  only explicit lock contention gets one retry, and retries keep the event ID.
- Given a production build or fixture catalog, when users search or click, then
  no usage POST is sent, even if a test URL is present.

Topic and direct-video routes do not exist yet. Their event contexts must be
wired when those pages are added; this change does not add either route.

See [backend setup and remaining checks](../apps-script/usage-README.md).
