# #43 LLM recommendations in the browser

Implements the [approved spec](../docs/specs/043-llm-recommendations.md).
Live calls remain disabled pending #8 provider, privacy and budget approval and
#19 evaluation. The selected provider is Anthropic. No keys belong in `VITE_*`.
This follow-up changes browser outcome handling only. Frozen candidates,
historical selectors and recorded evaluation results remain unchanged.

## Acceptance criteria

- Given the default `VITE_LLM_ENABLED=false` or a fixture catalog, when Find
  videos is submitted, then standard matching runs without an API call.
- Given enabled recommendations and a remote catalog, when a visitor submits,
  then one same-origin POST contains only the function area, optional goal,
  selected tools and catalog version. Blank inputs skip the call. A blank goal
  with an area or tool remains valid. Loading is announced and focus moves to
  the results heading.
- Given a nonempty success response, when the page selects cards, then all IDs are
  active in the same catalog version, with at most eight displayed. The first three preserve model order while
  reserving slots for two primary tasks; two same-task videos may remain.
  Demoted videos follow within the eight-card cap; there is no further expansion. Fewer than two distinct primary task tags causes
  an unavailable state with no cards; untagged picks and secondary tags do not count toward
  that minimum. Unknown, duplicate or retired IDs reject the whole response.
- Given semantic picks, when cards render, then their content and links come
  from the catalog. Reasons cite matched tags or say "Suggested for your goal".
  Cross-area picks are labeled. Smaller valid sets are not padded.
- Given a valid success with no selected IDs and the same catalog version, when
  selection completes, then announce "No confident matches found for this
  request" and show no cards. Do not invoke automatic rules replacement or
  claim the library definitively lacks coverage.
- Given an enabled request whose endpoint is disabled, response is invalid,
  catalog version differs, nonempty set fails diversity, provider fails or
  five-second deadline expires, when selection completes, then announce that
  AI suggestions are unavailable and remove earlier cards. Do not retry or
  substitute cards automatically. Empty catalogs retain the existing state.
- Given abstention or unavailable suggestions, when the visitor explicitly
  chooses Use standard matching, then run rules on the current inputs, label
  the result Standard matching, and make no further API call.
- Given a pending request, when fields change, Clear is pressed or another
  request starts, then the earlier result cannot replace cards or log events.
  A late success cannot replace a completed timeout state. Editing alone
  preserves the last completed result set.
- Given a completed ready or abstained submission, when usage logging is enabled for the test
  environment, then one search and each displayed card once carry the engine,
  bounded fallback reason and available versions. Goals never enter usage
  events, URLs or storage. Abstention records zero results and no impressions.
  Unavailable attempts emit no recommendation usage events: the existing wire
  contract cannot identify an error with no selected engine, and must not
  falsely attribute it to rules. Production usage logging remains disabled.
- Given enabled AI suggestions, when the form is shown, then it names Anthropic
  as the recipient of the goal and selected options and asks visitors to omit
  personal information. The explainer describes abstention, unavailable states
  and the visitor's explicit standard-matching choice.

## Validation

Automated canned-response tests cover semantic ordering, catalog and task
validation, abstention, unavailable states, explicit standard matching,
a stalled response body, cancellation, rapid resubmission, the eight-card cap,
StrictMode event counts and default-disabled behavior. CI makes no paid calls.
The browser uses `selectRecommendationState`; historical evaluation continues
to use the unchanged `selectRecommendations` selector. These tests use fictional
catalog fixtures, not frozen comparison prompts or labels.

Before enablement: approve the disclosure under #8, pass #19, then set both the
browser flag and the separate server gates. A browser flag alone cannot enable
paid calls. Turn the browser flag off and rebuild to restore rules-only mode.
Cloudflare preview checks must cover desktop, mobile and keyboard operation.
