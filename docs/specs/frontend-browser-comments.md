# Spec: Frontend browser comments

- **Issue:** User annotations on the live app, November 3, 2026
- **Status:** in review

These changes supersede the earlier deterministic-default presentation in #43.
The existing visual design and independent engine behavior remain in place.

## Acceptance criteria

### AC-1: Haiku default and option order

- **Given** the page first loads, **when** the engine options appear, **then**
  Haiku AI is selected and appears before Deterministic. Starter videos remain
  visible, and no provider request runs until a nonblank AI goal is submitted.

### AC-2: Remove the loaded count

- **Given** a loaded remote catalog, **when** its results appear, **then** the
  page omits the catalog's "videos loaded" label. Loading, error, empty and
  fictional demo notices retain their existing behavior.

### AC-3: Name useful search results

- **Given** a nonblank submitted goal, **when** either engine returns useful
  matches, **then** the results heading reads "Recommended Videos". Initial
  browsing keeps "Videos to start with" and fallback-only results keep
  "Fallback videos" with their explanation and card labels.

### AC-4: Remove idle feedback copy

- **Given** a video card with feedback controls, **when** no vote has been
  submitted, **then** omit "Only Sprint staff can see your response." and its
  spacing. Sending, saved and failure announcements remain accessible.

### AC-5: Remove the request paragraph

- **Given** the contribution form, **when** it appears, **then** omit the
  request-notice paragraph and its accessibility reference. Demo consent names
  staff email follow-up and the configured retention period directly, without
  referring to removed copy. Topic requests still need no contact details.

## Verification

- Typecheck, lint, the full test suite and production build pass locally.
- Desktop and mobile preview checked using fictional catalog data, including
  a useful deterministic search, idle feedback controls and demo consent.
- No production deployment is included in this change.
