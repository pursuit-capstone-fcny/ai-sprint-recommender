# Haiku transport and mixed-goal results

V21 fixes the observed transport/diagnostic failures and mixed Operations
breadth. All three trials score **10/10**, all forty requests have final
diagnostics and reconciled usage, and mixed Operations returns six videos
with two labeled top-three hits. No transport failure, timeout, invalid response
or duplicate occurs. All four instruction-only probes abstain.

The additional breadth-retention target remains failed: **23/30** accepted
lists contain six to eight videos, versus V18's 24/30. Overall validation is
therefore still marked incomplete. Production LLM calls and logging remain off.

## Changes and evidence

The test sender uses a fresh connection for each POST and generates a UUID
before sending it. The server accepts that correlation ID only for authenticated
test diagnostics. A lost response can therefore be matched to a server record.
Network and diagnostic-header failures retain a bounded category, phase, status,
duration and allowlisted error code. No raw error, credential or body is saved,
no usage is invented and no paid POST is retried. Production ignores supplied
correlation IDs.

An unpaid local HTTP server that resets reused sockets reproduces the old
failure. Three transport tests and the server correlation test fail before the
fix and pass after it. A lost-response integration test verifies correlation
without fabricating usage. V18's exact historical transport cause remains unknown;
the original run did not save it. All 120 calls in the three new runs have final
usage and no observed transport failure.

The final prompt restates legitimate work before candidate selection, then
applies the existing breadth and ranking procedures. Every original eligibility
and uniqueness sentence remains intact and last. Removing the added paragraph
restores all ten V18 request hashes. Submitted goals, catalog fields, model/effort,
output schema, token caps, deadlines, benchmark labels and diversity logic do
not change. Prompt wiring tests do not establish semantic quality; the live
responses below provide that evidence.

## Preserved trials

Each run uses Haiku 5.5 low, thinking disabled, thirty benchmark cases and ten
separate probes. All three have no observed injection or duplicate regression.
Counts measure breadth, not approval of every expanded pick.

| Candidate                                       | Trial scores | Six-to-eight lists | Cards | Mean cards | Mixed Operations cards | Operations wording cards | Final diagnostics | Cost      |
| ----------------------------------------------- | ------------ | ------------------ | ----- | ---------- | ---------------------- | ------------------------ | ----------------- | --------- |
| [V19](runs/41128821457-2/state/validation.json) | 10, 10, 10   | 21/30              | 198   | 6.600      | 6                      | 6                        | 40/40             | $0.080040 |
| [V20](runs/41129845902-2/state/validation.json) | 10, 10, 10   | 22/30              | 201   | 6.700      | 5                      | 5                        | 40/40             | $0.080044 |
| [V21](runs/41130921904-2/state/validation.json) | 10, 10, 10   | 23/30              | 205   | 6.833      | 6                      | 7                        | 40/40             | $0.080040 |

V19 fixes the requested failures but drops to 21/30 broad lists. V20 changes
only instruction placement and regresses both Operations controls to five
cards. Both failed audits are retained. V21 moves the same instruction before
selection and passes the earlier quality audit, including both Operations
controls. It still misses the new, unchanged 24/30 retention target by one list.
No audit is weakened or failed case replaced.

V18's comparison had 24/30 accepted broad lists, but one unmeasured transport
failure and only five mixed Operations cards. Its 217 displayed cards included
eight rules cards; its accepted LLM mean was 7.207. V21 has 205 LLM cards, mean
6.833, with no benchmark fallback. These are different breadth/reliability
outcomes, not evidence that the remaining unreviewed picks are better.

## Final V21 controls and limits

Tested source `6378a94f807560c5758ec6c8676f539383f5d00d`,
[run 41130921904 attempt 2](https://github.com/pursuit-capstone-fcny/ai-sprint-recommender/actions/runs/41130921904/attempts/2).

- Mixed Operations has two labeled hits and six cards. Mixed Fundraising has
  two hits and eight cards.
- Operations and Fundraising wording controls retain two hits with seven and
  eight cards. Blank browsing returns three LLM cards, within its fixed three-to-eight range.
- All four instruction-only controls and nonsense abstain.
- Fundraising-02 retains two hits with 7/8/8 cards across the trials.
- Seven accepted lists remain below six: Operations-02 once, Programs-02 three
  times and Communications-02 three times. Expanded lists contain **122
  unreviewed appearances**. These need client review, not automatic relabeling.

`relevanceEvidenceComplete` is true for V21 and the fresh comparison is saved.
The combined [validation](runs/41130921904-2/state/validation.json) is false only
on breadth retention. That is still an unresolved target. The requested failure
fixes are retained, paid trials stop here, and V21 stays an inactive test
candidate. No production readiness or general injection-resistance claim follows
from these small, reused synthetic probes.

The frozen benchmark fingerprint remains
`298ffdb6199c3a8bdb9ef48063ccfc4e16ca5efda14267a240c93d42d20b6d09`; catalog version
remains `sha256:b3f96d7113308d627eeb6c9667ac51a44155210faf515db2ef5a41fb5e9bfae7`.
The separately migrated Apps Script integration and its latency are not tested
by this frozen-catalog evaluation. Human review and enablement remain manual.

## Spend, runtime and shutdown

The new $1 grant raises the cap from $2 to $3. Prior ceiling $1.762935 plus
**$0.240124** across these three runs gives **$2.003059**, leaving **$0.996941**.
The historical $0.225000 unknown reservations remain charged. All 120 new
requests reconcile; no new unknown reservation occurs. Costs use recorded
tokens and approved rates, not an invoice. No budget reset or refund occurs.

V21 costs $0.080040 for forty calls. Its thirty benchmark calls cost $0.060054,
mean $0.0020018, or $2.0018 per thousand at these inputs. All forty have median
client latency 1.4225s, p95 2.132s and maximum 2.365s.

V19's initial attempt was cancelled before any job. V20/V21 first attempts
failed the approval gate before network work. All zero-spend records are saved.
Approvals pin source, workflow and attempt; no paid case is rerun to replace
an outcome. Each attempt retains its own budget and shutdown evidence.

[Test shutdown](runs/41130921904-2/state/independent-disabled.json) is independently
verified. Provider/rate keys were removed, and the temporary Actions approval
and trigger label deleted. Production deployment `639fe465dff12ea6c925b0dad1c38d1792918547`,
run 41127387660, reports `LLM_ENABLED=false` and `VITE_USAGE_ENABLED=false`.

All 629 tests, typecheck, lint and build pass for the tested candidate. Candidate
CI and preview deployment pass. Final archival changes also pass those local
checks. Benchmark labels, task-diversity files and production flags are unchanged.
