# ADR 0003: Repo guardrails

- **Status:** Proposed, pending team approval (AC-1.5)
- **Date:** 2026-10-11
- **Decides:** How `main` stays protected on a private repo with GitHub Free
- **Supersedes:** None

## Context

The repo is private on GitHub **Free**, which has no branch protection, no
rulesets, and no CODEOWNERS. Humans and coding agents both push to this repo,
starting this week. Something must stop direct pushes to `main`, secret leaks,
and unreviewed code. Budget for enforcement spend: none.

## Decision

Defense in depth, all free, three layers:

1. **Local hooks (husky + lint-staged).** Pre-commit runs ESLint, Prettier,
   and a gitleaks staged scan. Pre-push refuses any push that targets
   `refs/heads/main`.
2. **Agent-level settings (`.claude/settings.json`).** Permission deny rules
   and a PreToolUse hook block `git push` to `main`, force pushes, and
   `--no-verify` when the commands come from a coding agent.
3. **CI as the backstop.** Every PR runs typecheck, lint, tests, build, and a
   gitleaks scan (the CLI, not the Action, which needs a license key for org
   repos). A separate **main-audit workflow** runs on every push to `main` and
   flags any commit that did not arrive through a merged PR. Commits made
   before the audit workflow existed are recorded as its baseline.

Honest limits: anyone with repo access can skip local hooks (`--no-verify`) or
edit agent settings. CI and the main audit are what actually hold.

## Options weighed

| Option | Outcome | Why |
| --- | --- | --- |
| **Hooks + agent settings + CI + main audit** | **Chosen** | $0, works today, layers fail independently |
| Pay for GitHub Team ($4/user/month) for branch protection and rulesets | Rejected for now | Violates the no-new-spend constraint. Revisit trigger below |
| No guardrails; trust convention | Rejected | Agents will push to `main` the first week without a hard block |
| CODEOWNERS + required reviews | Not available | Requires paid GitHub features on private repos |

## Open questions from the team thread (proposed answers, pending approval)

- **Who reviews what:** every PR needs one approving human review, and the
  reviewer must not be the PR author. Agents may author PRs but never approve
  them.
- **Who owns the test deployment:** the PR author owns their Cloudflare
  preview URL. Production (`main`) deploys are owned by [OWNER, pending team
  decision].
- **Paying for enforcement:** nothing is paid today. If the team later buys
  GitHub Team, this ADR's local-hook layer retires in favor of real rulesets.

## Cost

$0. The only cost is setup time (issue #2) and each contributor installing
pnpm and gitleaks locally (one-time, documented in `AGENTS.md`).

## What FCNY owns after handoff

- Org and repo settings, including whether to upgrade to GitHub Team.
- The Cloudflare account and deploy secrets (ADR 0001).
- The decision to keep or relax the main-audit workflow.

## What would make us revisit

- The main-audit workflow fires more than rarely: buy GitHub Team and replace
  the audit with rulesets.
- A secret reaches `main` despite the scans: add rotation procedures and
  reconsider paid secret scanning.
- The team grows past roughly five people or multiple agents run in parallel
  daily: the single-reviewer rule gets too weak.
