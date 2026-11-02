# Spec: AI Sprint brand kit redesign

- **Issue:** Design implementation requested by Jason, November 2, 2026
- **PR:** Pending
- **Status:** in review

The approved HTML design and supplied AI Sprint brand kit define the visual
direction. This implements the design in the learner application, not the mock's
illustrative catalog or annotation controls. Jason confirmed keeping the existing
Deterministic / Haiku AI engine switch.

## Acceptance criteria

### AC-BRAND-1: Branded discovery section

- **Given** the learner page
- **When** the catalog loads, fails, is empty or is ready
- **Then** the page uses the supplied Sprint logo, self-hosted Bebas Neue and
  Montserrat fonts, and the cyan-to-lime gradient opening section. The supporting
  panel retains its headline and explanatory text, with no sample video.

### AC-BRAND-2: Freeform input

- **Given** a loaded catalog
- **When** a learner describes their work
- **Then** one freeform textarea accepts up to 500 characters; function-area and
  tool selectors and example-fill buttons are absent. The existing engine switch
  and its Deterministic default remain. Enter submits once, Shift+Enter adds a
  line, and composition input does not submit prematurely.

### AC-BRAND-3: Real recommendations

- **Given** a recommendation result set
- **When** it is displayed
- **Then** cards appear in two desktop columns below the opening section and one
  column on narrow phones. Real titles, descriptions, matching explanations,
  thumbnails, playback, copy links, feedback and request behavior are preserved.
  The engine controls result eligibility and count; the UI does not pad to eight.

### AC-BRAND-4: Footer

- **Given** any learner-page state
- **When** the footer is displayed
- **Then** its #003481 background spans the viewport, its text is #EFF7FB, and its
  vertical padding is 20px. It retains the Sprint attribution and staff analytics
  link. It has no mock or placeholder disclaimer.

### AC-BRAND-5: Existing safeguards

- **Given** either recommendation engine
- **When** the learner submits, clears, switches engines or plays a result
- **Then** existing cancellation, accessible result focus/count announcements,
  independent-engine behavior and privacy disclosures remain. AI requests send
  the freeform goal with `functionArea: null` and `tools: []`; raw goals stay out
  of browser storage, URLs and usage events. Provider and collection enablement
  are unchanged.

## Validation

Run typecheck, lint, tests and production build. Check the Cloudflare preview on
desktop and phone widths, including search, engine switching, empty/error states
and playback. Human review remains required before merging.
