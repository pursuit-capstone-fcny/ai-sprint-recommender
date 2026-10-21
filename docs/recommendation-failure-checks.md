# Deployed synthetic failure checks

`wrangler.failure-test.json` builds a separate Worker named
`ai-sprint-recommender-failure-test`. It runs the real recommendation handler
with fixed fictional catalog data and injected provider, budget and cache
implementations. It has no bindings, secrets, real provider calls or Sheet
access. The inert credential strings only satisfy the handler's configuration
validation. Deployment environment values cannot replace its dependencies.

The only public routes are `GET /cases/<name>` for the cases listed in
`fixtures/recommendation-failure-cases.json`. Queries, other routes and other
methods are rejected. Visitors cannot supply intake, URLs or configuration.

After deploying this separate Worker, run:

```sh
node scripts/verify-failure-worker.mjs
```

The verifier calls the fixed test hostname and checks exact result shapes,
fallback reasons, catalog/provider/reservation counts, and the five-second
timeout with provider cancellation. It writes the report to
`build/evaluation/failure-checks/report.json` or a generic `failure.json`.
Delete the fixture Worker after the workflow finishes, including failed runs.

The 15 cases cover success, default-off, kill switch, empty and retired
catalogs, catalog-description injection, unknown and duplicate IDs, provider
error, timeout, budget exhaustion, rate limiting, oversized input/output, and
catalog capacity. The injection case verifies that catalog text remains user
data and fabricated IDs are rejected. These results establish deployed Worker
behavior under mocks; they do not establish live Anthropic resilience or
quality. Atomic budget storage remains covered by its local tests.

- Given a fixed synthetic scenario, when its route runs, then the real handler
  returns the expected bounded response without external dependency access.
- Given arbitrary visitor input, when a request uses another route, query or
  method, then the Worker rejects it before running a scenario.
- Given a mismatched response or call count, when verification runs, then it
  exits unsuccessfully and does not report the checks as passed.
