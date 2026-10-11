# ADR 0001: Stack and hosting

- **Status:** Proposed, pending team approval (AC-1.5)
- **Date:** 2026-10-11
- **Decides:** Frontend stack, package manager, Node version, hosting platform, PR preview flow
- **Supersedes:** None

## Context

People and coding agents start building in parallel this week. The app is a
browser-side sprint recommender for FCNY: it reads a catalog, ranks it in the
browser, and logs usage events (see ADR 0002). No SEO requirements, no
server-side rendering requirements, no budget for new spend.

## Decision

1. **React 19 + TypeScript + Vite + Vitest**, with **React Router v8 added as a
   library** for client-side routing. The app ships as a single-page app (SPA);
   there is no server runtime.
2. **pnpm** as the package manager, pinned via the `packageManager` field in
   `package.json`. **Node 24 LTS** pinned by `.nvmrc`, enforced loosely by
   `engines` (`>=24`).
3. **Cloudflare Workers with static assets** for hosting. Every PR gets a
   preview deployment; pushes to `main` deploy production.

## Options weighed

| Option                                                         | Outcome    | Why                                                                                                                                                                                                                              |
| -------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next.js on Vercel                                              | Rejected   | Best-in-class Next.js hosting, but $20/seat/month (the free Hobby tier forbids commercial use) and per-seat billing grows with the team. SSR machinery we would not use                                                          |
| Next.js on Cloudflare via vinext                               | Rejected   | Flat $5/month, but vinext is a beta adapter and Next.js is the least-supported framework on Cloudflare                                                                                                                           |
| React Router v8 (framework mode) on Cloudflare                 | Rejected   | GA-supported, but framework mode implies SSR; our ranking runs in the browser and the backend is Apps Script, so the SSR layer would be dead weight. The Cloudflare Vite plugin also does not support SPA mode in framework mode |
| **React Router v8 (library) + Vite SPA on Cloudflare Workers** | **Chosen** | Free, GA-supported static asset hosting, matches the app shape exactly, React Router v8 is Cloudflare's current default guide                                                                                                    |
| Cloudflare Pages                                               | Rejected   | Works for static sites, but Cloudflare positions Workers static assets as the path for new projects; Pages is in maintenance mode                                                                                                |
| npm                                                            | Rejected   | Works, but slower installs and hoisted `node_modules` that hides phantom dependencies                                                                                                                                            |
| pnpm                                                           | Chosen     | Faster installs, strict dependency resolution (phantom imports fail at build time), one shared on-disk store. Cost: each contributor installs pnpm once, and CI uses `pnpm/action-setup`                                         |

## Cost

$0. Workers static asset requests are free and unlimited on the free tier, and
preview deployments are included. GitHub Free and the Google Sheet are already
covered.

## What FCNY owns after handoff

- The Cloudflare account (must be created under an FCNY-controlled email so it
  is transferable, see issue #35) and the `CF_API_TOKEN` /
  `CLOUDFLARE_ACCOUNT_ID` secrets it issues.
- The GitHub repository and its org settings.
- The Google Sheet and the Apps Script project bound to it (ADR 0002).

## What would make us revisit

- Catalog pages need SSR/SEO (unlikely for an internal tool), or the team wants
  React Router framework mode: reconsider hosting and the SPA choice together.
- The team grows past a few people and the main-audit workflow fires
  repeatedly: consider paid GitHub Team for real branch protection (ADR 0003).
- Apps Script quotas or CORS become a recurring blocker: move serving to a
  Cloudflare Worker (ADR 0002 covers the fallback).
