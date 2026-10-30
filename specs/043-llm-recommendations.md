# #43 LLM recommendations in the browser

Implements the [approved spec](../docs/specs/043-llm-recommendations.md).
Live calls remain disabled pending #8 provider, privacy and budget approval and
#19 evaluation. The selected provider is Anthropic. No keys belong in `VITE_*`.

## Acceptance criteria

- Given the default `VITE_LLM_ENABLED=false` or a fixture catalog, when Find
  videos is submitted, then standard matching runs without an API call.
- Given enabled recommendations and a remote catalog, when a visitor submits,
  then one same-origin POST contains only the function area, optional goal,
  selected tools and catalog version. Blank inputs skip the call. A blank goal
  with an area or tool remains valid. Loading is announced and focus moves to
  the results heading.
- Given a success response, when the page selects cards, then all IDs are
  active in the same catalog version. The first three follow model order with
  task duplicates demoted. Fewer than two distinct primary task tags causes
  complete rules fallback; untagged picks and secondary tags do not count toward
  that minimum. Unknown, duplicate or retired IDs reject the whole response.
- Given semantic picks, when cards render, then their content and links come
  from the catalog. Reasons cite matched tags or say "Suggested for your goal".
  Cross-area picks are labeled. Show more uses the same validated response.
- Given a disabled endpoint, invalid response, version mismatch, thin result
  set, provider failure or five-second deadline, when selection completes,
  then standard matching replaces the entire result set. Empty catalogs retain
  the existing unavailable state.
- Given a pending request, when fields change, Clear is pressed or another
  request starts, then the earlier result cannot replace cards or log events.
  A late success cannot replace a completed timeout fallback. Editing alone
  preserves the last completed result set.
- Given a completed submission, when usage logging is enabled for the test
  environment, then one search and each displayed card once carry the engine,
  bounded fallback reason and available versions. Goals never enter usage
  events, URLs or storage. Production usage logging remains disabled.
- Given enabled AI suggestions, when the form is shown, then it names Anthropic
  as the recipient of the goal and selected options and asks visitors to omit
  personal information. The explainer describes semantic and standard matching.

## Validation

Automated tests cover semantic ordering, catalog and task validation, complete
fallback, a stalled response body, cancellation, rapid resubmission, expansion,
StrictMode event counts and default-disabled behavior. CI makes no paid calls.

Before enablement: approve the disclosure under #8, pass #19, then set both the
browser flag and the separate server gates. A browser flag alone cannot enable
paid calls. Turn the browser flag off and rebuild to restore rules-only mode.
Cloudflare preview checks must cover desktop, mobile and keyboard operation.
