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
- Given an explicit goal, when prompt `catalog-rank-v5` ranks the catalog, then
  it prioritizes the requested activity, output and audience or counterparty
  over general AI guidance. It keeps v4's slots, full catalog, model and effort
  unchanged, and uses area and tools when the goal is blank.
- Given a provider request, when candidates are encoded, then every catalog
  item has a numeric position constrained by a schema enum. Ten required
  nullable slots, `rank1` through `rank10`, bound the output. The server maps
  non-null positions in rank order to the same trusted snapshot's IDs.
  Missing or extra slots, duplicates, nonintegers, out-of-range and malformed
  selections reject the whole result without truncation.
- Given sufficient rate, concurrency and spend allowance, when a call is
  dispatched, then its maximum configured input/output cost has already been
  reserved in one Durable Object storage transaction. Concurrent reservations
  cannot reuse that allowance. Missing limits or exhausted allowances make no
  paid request.
- Given a provider result, when the endpoint validates it, then only a strict
  object of up to ten distinct active IDs is accepted. Unknown IDs, duplicates,
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
