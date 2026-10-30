# ADR 0004: Publish a versioned static library catalog

- **Status:** Requested implementation; production ownership/enablement pending
- **Date:** 2026-10-29
- **Supersedes:** ADR 0002's live catalog serving path. Private usage collection remains.

The user requested Sheet-based nontechnical maintenance with an explicit Publish
library button. Deploy approved public metadata as immutable catalog JSON on
Cloudflare. A revalidated current manifest selects one snapshot for deterministic
recommendations, LLM recommendations, usage validation and analytics inventory.
Draft Sheet edits do not alter deployed behavior. Retain versioned public
snapshots for historical usage joins.

Publish from a Sheet sidebar through an authorized GitHub workflow to a separate
static catalog Worker. Store content on a dedicated data branch; never bypass
application PR review or deploy application code from that content branch. No
catalog database service is required. GitHub/Cloudflare quotas still apply and
LLM inference/budget enforcement remains a separate concern.

Keep Google usage Sheets private. The dashboard still requires Google sign-in
and actual file permission, but reads its catalog inventory from the published
snapshot rather than independently interpreting editable Sheet cells. Keep
production collection and paid LLM calls disabled until their existing gates pass.

The technical owner configures source Sheet identity, publisher credential,
repository, deployment environment and static catalog origin once. Staff edit
approved fields and publish. Validation/deployment failure retains the last
working version and displays actionable status. See
[publication contract](../analytics/library-publishing.md) and AC-24.13–17.
