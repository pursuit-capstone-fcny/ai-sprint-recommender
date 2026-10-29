# FCNY AI Sprint recommender

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Learners find relevant videos in FCNY's AI Sprint library. Authorized FCNY staff
use the private analytics dashboard to identify unused videos/tags, review keyword
frequency and inspect video-keyword associations.

## Product purpose

Make the video library useful to learners and give staff basic evidence for
maintaining its content. The analytics scope is issue #24, not learner profiling.

## Capabilities and constraints

The user confirmed a private app dashboard replacing the spec's Looker-specific
requirement on Oct 29, 2026. Preserve the existing app's visual system. Reporting
uses only restricted aggregates and public catalog metadata. Exclude team traffic
by default. Counts describe recorded appearances and clicks, never completed
watches. Percentage watched is unavailable pending a separate feasibility and
collection decision. Production collection, ownership and staff access remain
release gates. Review previews contain fictional data only.

## Operating context

The learner app is a React SPA. Apps Script serves the catalog and receives usage
events. A separate reporting workbook holds aggregates. The private dashboard
requires Google sign-in and server-side staff authorization.

## Evidence on hand

The repository contains public fictional fixtures and tests. They are not live
FCNY analytics or evidence of production approval. See docs/specs/024-usage-dashboard.md.
