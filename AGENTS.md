# AGENTS.md

Single source of truth for humans and coding agents working in this repo.
Decisions behind these rules live in `docs/adr/` (read ADRs 0001-0003 first).

## Stack

React 19 + TypeScript + Vite + Vitest, React Router v8 as a library (SPA,
no SSR). pnpm on Node 24 LTS. Hosted on Cloudflare Workers (static assets).
Data comes from a Google Apps Script web app bound to the FCNY Sheet;
ranking runs in the browser.

## Commands

| Task             | Command          |
| ---------------- | ---------------- |
| Install          | `pnpm install`   |
| Dev server       | `pnpm dev`       |
| Typecheck        | `pnpm typecheck` |
| Lint             | `pnpm lint`      |
| Tests (once)     | `pnpm test`      |
| Production build | `pnpm build`     |

One-time setup: install [pnpm](https://pnpm.io/installation) and
`brew install gitleaks` (the pre-commit secret scan needs the binary).

## Folder map

| Path               | Purpose                                                                 |
| ------------------ | ----------------------------------------------------------------------- |
| `src/engine/`      | Ranking logic. Pure functions, no React, no network                     |
| `src/contracts/`   | Shared TypeScript types: catalog shape, usage event payloads            |
| `apps-script/`     | Apps Script source deployed to the Sheet (`doGet`/`doPost`)             |
| `docs/specs/`      | Per-feature spec files with Given/When/Then acceptance criteria         |
| `docs/adr/`        | Decision records. Change a decision here, not silently                  |
| `docs/glossary.md` | Canonical terms and ID formats. Use these names in code, specs, and PRs |

## Data rules (hard rules, apply to code, fixtures, specs, and PR text)

1. No secrets. No API keys, tokens, passwords, or service account files.
2. No Zoom links, meeting URLs, or calendar links anywhere in the repo.
3. No raw transcripts of meetings or user conversations.
4. Catalog fixtures contain public fields only (see `docs/glossary.md` for
   the field list). If a field is not public, it does not go in a fixture.

## Workflow rules

- Never push to `main`. Work happens on branches and lands via PR.
- Never use `--no-verify` to skip hooks. If a hook blocks you, fix the code.
- Local hooks can be bypassed by anyone; CI and the main-audit workflow are
  the backstop. Expect direct pushes to `main` to fail the audit.
- Every PR gets one approving human review, and the reviewer is not the
  author. Agents may author PRs but never approve them.

## Definition of done (a PR is done when all of this is true)

1. `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build` pass locally
   and in CI.
2. A spec exists under `docs/specs/` with Given/When/Then acceptance criteria, and
   the implementation matches it.
3. The data rules above hold for every file in the diff.
4. UI changes are checked on the Cloudflare preview deployment.
5. One human (not the author) approves.

## For coding agents

- Read `docs/glossary.md` before writing code or specs; use its terms and ID
  formats exactly (catalog items, usage events, and sprints have defined IDs).
- Before implementing an issue, read its `docs/specs/NNN-*.md` spec. For a new
  spec, start from `docs/specs/_template/spec.md` and retain the issue's acceptance-criterion IDs.
- Match existing code style. Do not refactor unrelated code.
- Do not edit `docs/adr/` decisions without an explicit ask.
