# Simplified full-catalog Haiku V57

V56 passes the existing benchmark, but its system prompt has grown to 9,279
characters through about fifty revisions against the same ten profiles. Some
clauses name a single profile's work: written comments versus survey
statistics (Operations-01), counterparty questions (Fundraising-02), and a
list of supporting operations that mirrors Fundraising-01 and Programs-02. A
target of six to eight cards appears at least five times beside an equal number
of instructions not to pad. Expanded reviews since V25 record weak supporting
picks in ranks four to eight; V54 produced three repeated positions.

## Change

V57 replaces the accumulated system prompt with one generic statement of 1,357
characters. It asks for the videos that most directly help with the
submitted work, strongest first, and adds a supporting video only when it
teaches a step the person would carry out. It states that a shorter list is
better than a weak pick and sets no target count. It keeps the existing
blank-browsing, instruction-only abstention, mixed-goal and untrusted-data
rules in plain form.

The request keeps all 89 frozen catalog rows in source order with V56's row
layout, the original eight nullable numeric rank slots, Haiku 5.5 at low
effort with thinking disabled, 512 output tokens, the 63,000 input bound and
both deadlines. It requests no usefulness notes. The largest input bound across
the ten profiles and six injection probes falls from 61,622 to 52,682.

The server now keeps the first occurrence of a repeated position and drops
later repeats. Test diagnostics record the dropped count. An out-of-range or
malformed response still falls back to rules, with measured usage retained.
This applies to every Anthropic response. Labels, catalog tags, the browser
task-diversity gate and production flags are unchanged.

## Hypotheses

1. The profile-specific clauses and repeated count pressure do not cause V56's
   top-three results. A generic prompt keeps at least eight of ten passes per
   trial.
2. Removing the count target shortens some lists and removes some weak
   supporting picks. Card counts are reported, not gated.
3. With no notes and no count pressure, repeats become rarer. Any repeats that
   remain no longer cause a rules fallback.

## Validation and allowance

Run the same thirty benchmark cases and ten controls once, under a fresh
exact-source, workflow and attempt approval. No paid retry, replacement case or
second model call.

Required to retain V57:

- At least 8/10 in each of three trials (AC-19.2).
- All ten controls pass: four instruction-only probes and nonsense abstain,
  blank browsing succeeds, both mixed goals and both wording checks keep two
  existing top-three label hits.
- No provider timeout, transport failure or invalid response, with complete
  diagnostics and accounting.

Reported without a threshold: card counts per list, dropped repeats per case,
latency, cost and an expanded review beside V56. This benchmark is the set
that V56 was tuned on, so a V57 result cannot show that either prompt
generalizes. A held-out evaluation remains to be decided.

Carry the existing $4.503394 ceiling, including all $0.386544 unknown
reservations, under the unchanged additive $5 cap. Available balance is
$0.496606. Maximum reservation is $0.006556 per call and $0.262240 for forty
cases. No new allowance, refund, reset or repricing. Disable test calls
afterward, save the durable budget and remove provider/rate keys and the
temporary approval. Production LLM calls and logging stay disabled.

Production still cannot select this candidate. The bounded Haiku request is
chosen only when an allowance is configured, and `readLimits` rejects an
allowance outside the test environment. Production enablement needs a
separate change.
