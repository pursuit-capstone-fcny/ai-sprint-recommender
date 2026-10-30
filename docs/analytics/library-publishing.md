# Sheet-to-static library publishing

The requested architecture replaces live catalog reads with an explicit Publish
library action. This document defines the implementation boundaries and handoff.

```text
Private source Sheet
  Library menu → sidebar → Publish library
    validate approved public metadata
    freeze catalogVersion + immutable snapshot
    commit public snapshot on dedicated library-data[-test] branch
    dispatch catalog-only GitHub workflow
      validate snapshot and all retained versions
      deploy static catalog service on Cloudflare
      verify the current manifest before reporting success

Published manifest → immutable catalog snapshot
  deterministic browser engine
  LLM service and response validation
  usage validation
  private analytics inventory and historical joins
```

The catalog service is separate from the application Worker so a content publish
cannot replace application code or conflict with application deployments. It is
static JSON only, with no KV, D1 or R2 requirement. A `current.json` manifest names
the content-hashed JSON asset. Every consumer validates the complete contract and
hash. Unpublished edits remain private drafts. Immutable historical snapshots
remain available for retained events. The latest manifest is revalidated while
hash-named assets are cacheable. Failed publishing leaves the previous Cloudflare
deployment active.

One-time technical configuration binds the Sheet reference, repository,
credential, content branch, workflow ref, environment and public catalog origin.
The source Sheet may be identified by its link in environment/project
configuration; a Sheet-bound publisher also checks its active workbook identity.
The GitHub credential needs repository Contents and Actions write permission. It
is held only in Apps Script properties, never frontend assets or repository
files. Staff need only the Sheet menu/sidebar after setup. Google consent and
file permissions still govern the private dashboard.

The publisher writes only a fixed public snapshot and current manifest to a
separate content branch using an atomic Git tree/commit and non-force ref update.
It never changes main. Workflow inputs contain only bounded identifiers and an
immutable content commit, not a catalog body or secret. The publication workflow
checks out its own reviewed code independently of the content commit, copies
only validated catalog files to the asset directory, and serializes deployments
per environment. Production publication uses reviewed main code; test publication
may use a reviewed feature ref and a separate test catalog target.

A status RPC checks the recorded workflow run and expected live manifest. An
upload or queued run is not success. Pending jobs suppress repeated clicks;
failures are recoverable without destroying the current deployment. GitHub or
Cloudflare failures return fixed messages and never echo tokens or response
bodies. No live credentials are provisioned by source code or fixtures.

The analytics app continues to authenticate each Google user and check access to
the configured private source/usage Sheet. It no longer treats arbitrary Sheet
catalog cells as inventory. It aggregates retained private events against the
same current and event-time published snapshots. Missing usage is unavailable;
missing historical metadata is unmapped. Current catalog publication does not
reset historical event tags or publish usage data.

Production usage and paid LLM calls remain separate enablement decisions. The
existing LLM tests and relevance gate must remain intact. No paid LLM call or
production logging is enabled just to change catalog transport.

## PR breakpoints

1. Specification and architecture record, stacked on the existing dashboard PR.
2. Sheet menu/sidebar publisher, immutable data commit, static asset builder and
   catalog-only deployment workflow.
3. Shared manifest/snapshot reader and deterministic/LLM integration. This joins
   the existing LLM PR branch, preserving its work and explicit dependency.
4. Published inventory for private analytics and usage validation, failure tests,
   deployment/handoff instructions and preview verification.
