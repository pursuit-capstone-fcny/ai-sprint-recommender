# Full-catalog duplicate-response fix

V54's saved failure audit reproduces three duplicate provider responses before
browser selection: Programs-01 trial one, Leadership-01 trial three and mixed
Operations. Each repeats one position. The adapter rejects the whole response
and retains measured usage. Raw invalid output was not captured, so the exact
repeated positions and generation sequence are unknown and will not be invented.

Unpaid reproduction:

```sh
python3 docs/evaluation/2026-10-30-haiku-breadth/audit-failures.py docs/evaluation/2026-11-01-haiku-full-catalog/runs/41328286303-2
```

It exits one with three duplicate request IDs and no instruction-only failure.
The problem is not a duplicate introduced by the browser or a lost usage record.

Ranked hypotheses, shared before testing:

1. Note-first output makes the model commit to a taught method before recalling
   the already-used numeric positions. Emit a distinct position first, then its
   usefulness note, without changing the selected candidate pool or validation.
2. The accumulated backward check is harder than a forward-only procedure that
   excludes already-used positions. Test this independently if ordering fails.
3. Independent rank slots intrinsically allow repeats. A different selection
   representation may be needed if prompt-level ordering fails; schema tests
   alone cannot establish model adherence.

## V55 candidate

Change only each rank's property order and its matching format instruction:
`position` precedes `use`. Keep the same eight required objects, nullable numeric
position enums, short grounded notes, strict parser and rejection of every
duplicate or invalid position. The real adapter test first fails with the old
`use, position` schema, then passes with `position, use`. It still verifies
one call, trusted-ID mapping and exact wire accounting. This checks the request,
not whether a live model follows it.

All 89 public catalog items, their source order, bounded metadata and original
user intake remain unchanged. No rules-based prefiltering, label access, paid
retry, response repair, padding or second model call. Keep the existing ranking,
breadth, eligibility, mixed-input and final uniqueness instructions intact.
The browser task-diversity gate and benchmark labels stay frozen.

## Validation and allowance

Run the same thirty benchmark cases and ten controls once. Haiku 5.5 low,
thinking disabled, 63,000 conservative input bound, 512 output tokens,
4.5-second server deadline and five-second client deadline. Check all twenty
unique wire bounds before enabling the provider.

The retention target is zero duplicate/invalid responses or provider timeouts,
all existing controls passing, at least nine passes per trial and at least
28/30 accepted six-to-eight lists, with complete diagnostics and accounting.
The unchanged #19 score gate and expanded semantic review remain separate.
Do not turn rejected responses into successes by dropping duplicates or change
labels, catalog tags, the task gate or cases to meet a target. Keep the full
89-item scope even if a candidate is withdrawn.

Carry the existing $4.322792 ceiling, including all $0.379988 unknown
reservations, under the unchanged additive $5 cap. Available balance is
$0.677208. Maximum reservation is $0.006556 per call and $0.262240 for forty
cases. No new allowance, refund, reset or repricing. Bind approval to the exact
source, workflow and attempt. Preserve failed runs and every charge. Disable
test calls afterward, save the durable budget, remove provider/rate keys and
temporary authorization. Production LLM calls and logging stay disabled.
