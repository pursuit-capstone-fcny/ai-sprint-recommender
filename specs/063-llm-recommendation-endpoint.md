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
- Given catalog text or a goal containing instructions, when the Anthropic
  request is assembled, then that text stays in the untrusted data message.
  The full catalog is retained with bounded title/description fields. It falls
  back if its conservative token bound exceeds the limit; no shortlist is made.
- Given an explicit goal, when prompt `catalog-rank-v3` ranks the catalog, then
  it prioritizes help with the requested task and deliverable over broad area
  or tool overlap. It uses area and tools when the goal is blank.
- Given a provider request, when candidates are encoded, then every catalog
  item has a numeric position constrained by a schema enum. The server maps
  valid positions to the same trusted snapshot's IDs. Duplicate, noninteger,
  out-of-range, oversized or malformed selections reject the whole result.
- Given sufficient rate, concurrency and spend allowance, when a call is
  dispatched, then its maximum configured input/output cost has already been
  reserved in one Durable Object storage transaction. Concurrent reservations
  cannot reuse that allowance. Missing limits or exhausted allowances make no
  paid request.
- Given a provider result, when the endpoint validates it, then only a strict
  object of up to ten distinct active IDs is accepted. Unknown IDs, duplicates,
  extra properties, malformed output and truncation reject the whole result.
  Empty lists are valid and let the browser use its insufficient-results policy.
- Given a failure or slow dependency, when five seconds elapse from request
  entry, then the response falls back, aborts network work and never retries a
  paid request. Unknown billed usage retains the maximum reservation; a failed
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
