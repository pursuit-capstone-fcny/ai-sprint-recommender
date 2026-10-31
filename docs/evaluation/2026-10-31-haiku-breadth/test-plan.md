# Haiku breadth follow-up

Jason authorized another rerun within the existing allowance on October 31.
The shared cap stays $3, with $2.003059 carried forward and $0.996941 remaining.
The $0.225000 historical unknown reservations remain charged. No new grant,
refund, reset or repricing. Production LLM calls and usage logging stay off.

## Reproduction

An unpaid copy of V21's artifacts fails the existing audit:

```sh
python3 docs/evaluation/2026-10-30-haiku-reliability/audit.py /tmp/fcny-haiku-v21-repro
```

It exits 1 with breadth 23/30 versus the fixed 24/30 target; every other check
passes. Programs-02 and Communications-02 return fewer than six videos in all
three trials; Operations-02 does so once. Provider and displayed counts agree,
so the shortfall occurs during selection, before the unchanged diversity gate.

Ranked hypotheses: selection overweights the final artifact instead of useful
supporting steps; final instruction priority narrows earlier breadth; sampling
variation. The first predicts that reviewing preparation, execution, checking
and follow-through before leaving ranks empty will increase useful breadth.

## V22 change and checks

Add one Haiku-only paragraph after the existing breadth pass. Require a concrete
connection from each supporting video's described method to a work step. Retain
direct matches first. Shared department or generic AI advice is insufficient.
Short lists remain valid when the catalog lacks useful methods. All exact V21
mixed-goal, eligibility and uniqueness instructions remain in place, and blank
browsing receives no new paragraph. No examples, video IDs, profile IDs, catalog
tags, labels, goal text, schema, provider limits or transport settings change.

The request wiring test fails before insertion. Removing only the new paragraph
must restore all ten V21 request hashes and the existing historical invariants.
This checks the request construction, not semantic adherence. The saved replay
and fresh forty-request run are the breadth regression check.

Run the same thirty benchmark requests and ten probes with Haiku 5.5 low,
thinking disabled. Maximum reservation is 40 × $0.006756 = $0.270240. Pin
approval to the clean source, run and attempt. Do not retry individual paid
cases, omit failures or rewrite historical evidence. Use the unchanged audit at
`docs/evaluation/2026-10-30-haiku-reliability/audit.py`.

Targets remain 10/10 each trial; at least 24/30 accepted six-to-eight lists;
Fundraising-02, mixed and wording controls retain two labeled hits and six to
eight cards; all injection and nonsense probes abstain; blank browsing returns
three to eight LLM cards. Require forty final diagnostics and reconciled usage,
no transport failure, timeout, invalid response or duplicate. Expanded picks
remain unreviewed, not new labels or evidence of production readiness.

After evaluation, disable test calls, save cumulative spend, remove test keys
and temporary approval/trigger. Keep the production configuration unchanged.

## V22 result and V23 placement check

V22 run 41215956221 attempt 2 retains 10/10 each, forty final diagnostics,
complete accounting, clean transport and all injection/deduplication controls.
It still fails breadth at 23/30, with 202 cards and 118 unreviewed appearances.
Operations-02 improves, but Programs-02 remains thin twice, Communications-02
three times and Leadership-02 twice. Cost $0.080968 raises the carried ceiling
to $2.084027, leaving $0.915973. Shutdown, key removal and independent disabled
verification pass. Attempt 1 was cancelled with zero jobs and no paid work.

The next hypothesis is instruction order: the supporting-step check precedes
targeted ranking, which may narrow the set again. V23 moves the exact paragraph
after targeted ranking, immediately before the unchanged final eligibility and
uniqueness checks. No new text or input facts are added. The placement test fails
before this change; removing that paragraph still restores all V21 requests.
Repeat the same forty requests and all fixed targets, reserving at most $0.270240.

## V23 result and V24 selection check

V23 run 41216398502 attempt 2 retains 10/10 and clean reliability, but breadth
falls to 22/30 and mixed Operations returns five cards. Fundraising-02 is thin
in one trial. Both quality and breadth audits fail. Preserve the result and its
$0.080968 cost. Two runs cost $0.161936; cumulative ceiling $2.164995 leaves
$0.835005. All forty diagnostics and measured usage reconcile. Calls are off and
keys removed. Attempt 1 was cancelled before any job or paid work.

V24 returns to V21's instruction order and changes only its breadth paragraph.
Identify the useful set across the catalog before assigning ranks, then order
direct matches first and retain the selected supporting methods. Choose each
position once, with the same no-padding and eligibility rules. Remove the extra
V22 paragraph. This tests whether sequential rank filling stops after the
closest matches. The earlier V16 tried set-first selection before V21's mixed-goal
fix existed; that historical failure remains recorded. This test uses the fixed
current baseline and all forty probes, not a rerun of an unchanged candidate.

Restoring the saved V21 breadth paragraph reconstructs every V21 request hash.
No new unit assertion can establish semantic adherence; the already-red live
artifact audit is the regression check. Keep the same targets and reserve at
most $0.270240 from $0.835005. Do not change model settings or inputs.
