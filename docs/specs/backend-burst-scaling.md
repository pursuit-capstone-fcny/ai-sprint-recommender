# Spec: Backend scaling for 1,000 simultaneous users

- **Issue:** User request, November 3, 2026
- **PR:** #134
- **Status:** in review

The target is 1,000 simultaneous learner submissions on either engine. Preserve
the $1 daily and $5 monthly AI spending caps. A successful AI result remains
conditional on available budget and provider availability. No goal is persisted
in a queue. Deterministic ranking stays in the browser.

## Acceptance criteria

### AC-SCALE-1: Bounded AI waiting

- **Given** 1,000 concurrent valid submissions and available actual-use budget
- **When** paid-call slots or temporary reservations are occupied
- **Then** queue admission in the existing budget Durable Object, with at most
  1,000 waiting requests and a five-minute overall browser deadline. Queue only
  IDs, short-lived hashed rate keys, amounts and deadlines in memory. Each paid
  call retains its own 6.5-second deadline. One submission dispatches at most
  one paid call. Queue-full, expired, disabled and permanently exhausted states
  return bounded outcomes. Cancellation removes waiting work without refunding
  a dispatched or uncertain call. Durable maximum reservations still protect
  the unchanged daily/monthly caps across restarts and concurrent admissions.

### AC-SCALE-2: Burst limits and shared networks

- **Given** the production scaling configuration
- **When** requests arrive from 1,000 browser pages, including a shared network
- **Then** permit up to 1,000 paid admissions/minute and 32 paid calls in flight,
  with three requests/minute per ephemeral page/network key. The page UUID lives
  only in memory, is never sent to the provider or analytics, and does not replace
  the authoritative global rate, queue and spending limits. Legacy requests keep
  their network key. No spending cap, token ceiling or paid retry increases.

### AC-SCALE-3: Durable usage buffering

- **Given** collection is enabled with a configured matching batch collector
- **When** either engine generates a 1,000-page burst of search/impression/click events
- **Then** accept bounded batches through a same-origin endpoint into sharded
  SQLite Durable Objects. Validate strict event fields and trusted catalog references
  before persistence. Distinguish durable enqueue from accepted Sheet delivery.
  Forward bounded authenticated batches, deduplicate event IDs at the collector,
  back off on temporary failures and erase delivered or expired buffered data.
  Retain no raw goals, explanations, contact data or IPs. Buffer age is at most
  one hour, within existing event expiry. Bounded queue capacity and kill switches
  fail closed. Explicit feedback continues to require an accepted collector receipt.
  Routine deployments preserve pending events; explicit disablement, invalid
  configuration or expiry still erase undelivered buffered data.

### AC-SCALE-4: Collector and reporting capacity

- **Given** an operator opts into the burst collector policy after deploying it
- **When** a validated batch is received
- **Then** validate and append accepted events under one lock with one Sheet write
  and flush per batch, retaining individual event receipts and duplicate semantics.
  Usage and feedback reports share the same retained-event ceiling, including
  mixed logs with more than 10,000 events.
  Raise only technical event/row ceilings for the agreed burst, preserve one-day
  retention and private reporting, and reconcile all 10,000 synthetic events from
  1,000 searches with eight impressions and one click each. Old single-event
  clients remain supported. No endpoint exposes usage reads or setup functions.

### AC-SCALE-5: Catalog burst and verification

- **Given** concurrent cold requests for the same trusted catalog
- **When** the Worker reads it
- **Then** coalesce bounded in-flight reads without coupling one caller's abort to
  other callers or sharing goals/results. Verify 1,000 concurrent synthetic requests,
  cancellation, queue overflow, unknown provider outcomes, budget exhaustion,
  restarts, upstream retries and receipt-to-report totals. Keep paid provider calls
  and production Sheet writes out of load verification. Record native runtime
  evidence separately from in-memory tests and describe rollout prerequisites.
