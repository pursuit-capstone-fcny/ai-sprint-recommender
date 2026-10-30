# #63: Bounded recommendation endpoint

Status: Implemented with live enablement pending #1, #8 and #19.

- Given the normal preview or production configuration, when a request reaches
  `POST /api/recommendations`, then it returns `disabled` and makes no catalog or
  provider request. Production usage logging stays disabled.
- Given recorded runtime/privacy/budget approvals and every required limit, when
  an enabled request contains canonical intake fields and a matching catalog
  version, then the server fetches and validates the public catalog itself.
  Extra fields, noncanonical tags and goals over 500 characters are rejected.
- Given a validated catalog snapshot cached under its trusted source and
  version, when the same version is requested within 60 seconds, then the
  server revalidates and reuses it. New versions, invalid cache entries and
  expired snapshots fetch the source again. Mismatches make no paid call;
  cache failures do not prevent a fresh fetch. No intake or provider result is
  cached. Source changes can take up to 60 seconds to affect an old version.
- Given a test deployment with a trusted catalog URL, when the browser loads
  `GET /api/catalog`, then it receives the validated public envelope and warms
  the version cache before submission, even with LLM calls disabled. The
  unpaid load ends within nine seconds; no parameters, writes or production
  access are accepted. Expired snapshots fetch the source again.
- Given a recommendation with a valid fresh source response, when cache writes
  stall or fail, then `waitUntil` keeps them off the response path. Cold or
  expired caches can still cause fallback within the recommendation deadline.
- Given catalog text or a goal containing instructions, when the Anthropic
  request is assembled, then that text stays in the untrusted data message.
  The full catalog is retained with bounded title/description fields. It falls
  back if its conservative token bound exceeds the limit; no shortlist is made.
- Given an explicit goal, when candidate `catalog-rank-v7` ranks the catalog, then
  it prioritizes the requested activity, output and audience or counterparty
  over general AI guidance. It keeps v5's prompt, full catalog and output schema,
  and v6's medium effort with thinking disabled. The JSON user message puts
  every catalog candidate before the intact intake fields. Existing caps still
  apply; it uses area and tools when the goal is blank.
- Given candidate `catalog-rank-v10`, when the model ranks a goal, then it covers
  each requested activity and deliverable, distinguishes qualitative feedback
  from numerical analysis, and aims for six to eight useful picks without padding.
  Haiku low and Luna low use the same instructions; production remains disabled.
- Given a rank-slot provider request, when candidates are encoded, then every catalog
  item has a numeric position constrained by a schema enum. Eight required
  nullable slots, `rank1` through `rank8`, bound the output. The server maps
  non-null positions in rank order to the same trusted snapshot's IDs.
  Missing or extra slots, duplicates, nonintegers, out-of-range and malformed
  selections reject the whole result without truncation.
- Given Luna candidate `catalog-rank-luna-v11`, when preparing its request, then
  encode the same ranking fields as rows with explicit field names and request
  a strict `positions` array of at most eight distinct catalog positions.
  Preserve V10's ranking instructions, low effort and the 2,000-token output
  cap. Reject input exceeding a 50,000-token byte bound before reserving $0.006;
  retain all older charges at their original amounts. Partial, duplicate or
  invalid output still rejects the whole result. Production remains disabled.
- Given sufficient rate, concurrency and spend allowance, when a call is
  dispatched, then its maximum configured input/output cost has already been
  reserved in one Durable Object storage transaction. Concurrent reservations
  cannot reuse that allowance. Missing limits or exhausted allowances make no
  paid request.
- Given a provider result, when the endpoint validates it, then only a strict
  object of up to eight distinct active IDs is accepted. Unknown IDs, duplicates,
  extra properties, malformed output and truncation reject the whole result.
  Empty lists are valid and let the browser use its insufficient-results policy.
- Given a failure or slow dependency, when 4.5 seconds elapse from request
  entry, then the response falls back, aborts network work and never retries a
  paid request, leaving 500ms before the browser's five-second limit. Unknown
  billed usage retains the maximum reservation; a failed
  reservation never reaches the provider.
- Given measured usage, when settlement succeeds, then spend is reconciled once
  against the reservation's original UTC day and month. Expired reservations
  release concurrency without refunding unknown spend.
- Given enabled diagnostics, when a response is recorded, then it contains only
  the generated request ID, environment, bounded outcome, latency, token/cost
  totals and versions. No goals, prompts, response bodies, IPs, app session IDs
  or source tags are recorded. Rate hashes expire on the minute alarm.
- Given an invalid provider selection in the test environment, when diagnostics
  run, then a fixed validation category and counts capped at 100 identify the
  failing stage. Raw output stays private; public and production responses and
  production diagnostics omit this metadata.

Validation: mocked Anthropic requests, endpoint and storage tests; all CI checks;
Wrangler dry runs for the default and isolated runtime configurations. Live
provider accuracy, approved pricing/token overhead, runtime provisioning and
manual signed-out enabled/failure checks remain prerequisites for enablement.

### Luna test candidate

- Given a streamed Luna response, when a terminal event includes validated
  output and usage, then finish without waiting for transport close. Partial
  text never counts as completion; aborts, malformed streams and missing usage
  retain fallback and conservative accounting within the existing deadline.
- Given an authenticated test runner, when diagnostics are enabled, then return
  the bounded diagnostic in a response header as well as the console. Public
  requests and production never receive that header. Late accounting can update
  captured diagnostics but cannot replace the displayed result.
- Given Jason's remaining original $1 allowance, when the test worker uses
  GPT-6 Luna low with standard reasoning and V7, then it uses the same public
  catalog, schema and 4.5-second deadline as the comparison. OpenAI production
  configuration is rejected before any provider call.
- Given prior spend and unknown reservations, when a request reserves cost,
  then a persistent cumulative limit carries them across day/month changes.
  Known usage settles once, including reasoning tokens within output tokens;
  unknown usage keeps the full $0.007 reservation.
- Given the approved validation has finished, when cleanup runs, then calls
  are disabled, cumulative spend is read through a runner-only test route,
  and test provider secrets are removed. Production settings stay unchanged.

## Candidate evaluation

- Given the Haiku V13 test, when an eligible goal has fewer than six direct
  matches, then review unused catalog items for concrete supporting methods.
  Keep direct matches first and preserve V12's exact eligibility/uniqueness
  instruction, strict validation and diversity gate. Never pad unrelated picks.
  See the [breadth plan](../docs/evaluation/2026-10-30-haiku-breadth/test-plan.md).
- Given the V14 revision, when adding breadth guidance, then place it before
  existing targeted-ranking priorities and omit it for blank browsing. Preserve
  the exact V12 eligibility/uniqueness instruction and all fixed evaluation gates.

- Given the Haiku V12 test, when selecting ranks, then check work eligibility
  before breadth and select each integer position only once. Instruction-only
  nonblank goals abstain; real mixed goals and blank browsing retain their
  behavior. Preserve strict validation, labels and the diversity gate. See the
  [fix plan](../docs/evaluation/2026-10-30-haiku-guardrails/test-plan.md).

The [Haiku V11 transfer](../docs/evaluation/2026-10-30-haiku-optimized/results.md)
scores 9/10, 10/10 and 10/10, with 22/30 six-to-eight lists. It fails two
instruction-only controls and correctly rejects one duplicate response.
Forty measured calls cost $0.076318, leaving $0.790199 of the shared cap.
The candidate stays disabled; production LLM calls and logging remain off.

- Given the approved Haiku V11 test, when ranking, then use Luna V15's compact
  catalog and ranking/breadth/eligibility instructions with Haiku's eight nullable
  output slots. Preserve low effort, disabled thinking, deadlines, labels and
  the diversity gate. Spend only the existing shared balance and disable calls
  after validation. See the [transfer plan](../docs/evaluation/2026-10-30-haiku-optimized/test-plan.md).

The [V15 injection trial](../docs/evaluation/2026-10-30-luna-injection/results.md)
scores 10/10 in all three trials, with 29/30 six-to-eight lists. All four
instruction-only attacks abstain; mixed goals and blank browsing still work.
V15 is the disabled candidate. All 40 calls have measured usage; the cumulative
ceiling is $1.133483, leaving $0.866517. Expanded-set and unseen-input review
remain pending; production LLM calls and logging stay off.

The [V14 ranking trial](../docs/evaluation/2026-10-30-luna-ranking/results.md)
scores 10/10 in all three trials, fixes Fundraising-02's two ranking misses,
and retains breadth at 28/30 six-to-eight lists. No benchmark timeout, invalid
response or fallback occurs. V14 was the prior disabled candidate. The cumulative
ceiling is $1.056439, leaving $0.943561; production LLM calls and logging stay
off. Expanded-set and client review remain pending.

The [V12 Fast trial](../docs/evaluation/2026-10-30-luna-fast/results.md) scores
10/10, 9/10 and 9/10 with no timeouts or invalid responses. Six-to-eight lists
increase from V12 Standard's 20/30 to 27/30. V12 Fast was the prior disabled test
candidate. Historical charges retain their original reservations; production
LLM calls and usage logging remain disabled. Expanded-set and client review
remain pending.

- Given the approved V12 Fast trial, when calling Luna, then change only V12's
  processing tier to Fast, keep low effort and deadlines, and reserve $0.011.
  Record the actual tier, reject Standard responses as Fast evidence, and
  retain the full reservation when the tier or usage is unknown.
- Given Jason's additional $1, when reserving test calls, then preserve the
  existing ledger and charges under the $2 cumulative Luna limit. Production
  stays disabled. See the [trial plan](../docs/evaluation/2026-10-30-luna-fast/test-plan.md).

- Given V14 Fast and a multi-part goal, when ranking the first three videos,
  then prioritize distinct requested activities and the intended counterparty
  before general research or repeated practice for other audiences. Preserve
  useful supporting videos in later ranks, V12 breadth instructions, low effort,
  caps and deadlines. No benchmark labels or diversity checks change. See the
  [ranking trial plan](../docs/evaluation/2026-10-30-luna-ranking/test-plan.md).

- Given the isolated evaluation entry point, when loading its pinned public
  catalog, then serve the exact frozen snapshot through the existing validation
  and cache paths. Reject this source in production or Haiku configuration;
  ordinary bundles do not serve it. Preserve benchmark labels and report that
  this run does not validate the concurrently migrated Apps Script source.

- Given V15 and a nonblank goal containing only instructions about the model,
  rules, catalog or output, when selecting videos, then return an empty LLM
  selection. Function area and tools must not invent a missing work task.
  Mixed goals retain their real work; blank goals retain browsing. Preserve V14
  ranking instructions and the existing rules fallback. See the
  [injection trial plan](../docs/evaluation/2026-10-30-luna-injection/test-plan.md).
