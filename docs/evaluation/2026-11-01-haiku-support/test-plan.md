# Supporting-method comparison

V46 tests whether a source-to-goal mapping improves the supporting selections
retained in V44. Each existing `use` string describes the taught operation and
its corresponding needed work step before selecting a numeric position. The
schema describes that format; it adds no required fields or parser constraints.
Statements remain private selection aids and are discarded. This changes one
ranking instruction, not candidate metadata or retrieval. No profile-specific
exclusions, padding, second model call or paid retry are introduced.

The unpaid [replay](v44-replay.json) observes 22 appearances of concerns recorded
in the prior V44 review. `observe.py` can reproduce those concerns and compare
future output. It is not a label set, is not sent to the model and does not score
relevance. Full replacement picks must still be reviewed. Local adapter tests
verify serialization, IDs, usage and failure behavior, not model quality.

## Budget and validation

The existing balance is $0.262836 under the unchanged $4 cumulative allowance.
All $0.366876 historical unknown reservations remain charged. Reduce the enforced
test input cap from 65,000 to 63,000. The actual serialized request plus the same
4,096-token framing allowance fits for every benchmark and control, including
all 89 items. [Input bounds](input-bounds.json) retain those measurements. Requests
that exceed this cap stop before the provider; the shared budget object, prices,
output cap, prior spend and total allowance are unchanged.

At 512 output tokens the maximum reservation is $0.006556 per request, or
$0.262240 for forty requests. This fits without resetting or extending the
allowance. An exact-source, exact-attempt approval must still pass all existing
checks. There are thirty benchmark requests and the same ten separate controls.
No replacement cases or paid warmups are allowed. Every charge and failure stays
in the append-only record.

Retain the candidate only if it preserves V44's 10/10 per trial, 30/30 accepted
six-to-eight lists and clean reliability while improving the questioned supports.
Inspect every expanded replacement; a passing top-three score does not approve
it. Keep the frozen benchmark, catalog and task-diversity gate unchanged. The
512-token output cap and 4.5-second server deadline remain fixed. Disable test
calls and remove keys after the run. Production calls and logging remain off.
