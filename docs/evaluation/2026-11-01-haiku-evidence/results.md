# Haiku selection evidence results

Retain **V44**. It scores 10/10 in all three trials and returns six to eight
videos for all 30 benchmark lists, up from V36's 29/30. All forty requests have
measured accounting with no timeout, transport failure, invalid response or
duplicate. The original podcast-for-board-deck flags are absent. Fundraising-01
now has 8, 8 and 7 videos; the grant-flier pick is also absent.

This is a partial quality improvement. Some expanded picks remain questionable;
the passing frozen-label score does not approve every supporting recommendation.
Production calls and logging remain disabled. Test calls are off and keys removed.

## Approach and results

Each rank contains a short statement of the taught method and its usefulness,
followed by the selected catalog position. The statement encourages a practical
connection before selection. The adapter validates the complete shape and IDs,
then discards the statements. Retrieval, catalog metadata, benchmark labels,
numeric position mapping and the browser task-diversity gate are unchanged.
There is one provider call, no automatic padding, no paid retry and no second
ranking pass. All candidates use Haiku 5.5 low with thinking disabled and the
existing 4.5-second deadline, 65,000 input bound and 512 output-token cap.

| Candidate                | Top-three scores           | Accepted six-to-eight lists | Reliability                                                | Recorded charge       |
| ------------------------ | -------------------------- | --------------------------- | ---------------------------------------------------------- | --------------------- |
| V36, historical baseline | 10/10 each                 | 29/30                       | Forty measured requests; clean                             | Historical, unchanged |
| V43                      | 0/10 each, rules fallbacks | 0/30                        | One timeout and 34 schema rejections across forty requests | $0.067283             |
| V44, retained            | 10/10 each                 | 30/30                       | Forty measured requests; clean                             | $0.060518             |
| V45, withdrawn           | 8/10 each                  | 24/30                       | Six duplicate responses rejected; forty measured requests  | $0.061416             |

V44 source `1604045b5220f7f87a724503a697b61a35cc9887`,
[run 41260187479 attempt two](https://github.com/pursuit-capstone-fcny/ai-sprint-recommender/actions/runs/41260187479),
passes the unchanged [full audit](runs/41260187479-2/state/validation.json).
Wording and mixed-goal controls pass. All four instruction-only probes and the
nonsense goal abstain; blank browsing works. Median client latency is 2,046ms,
p95 2,463ms and maximum 2,949ms. The thirty benchmark calls cost $0.044621,
averaging $0.00148737. All forty calls cost $0.060518.

The [expanded review](v44-expanded-review.md) contains 235 displayed cards and
151 unreviewed appearances. Fundraising-02 puts its two labeled matches in the
first two positions in every trial. The original podcast flags, grant flier for
application preparation and AI-concerns video for a staff conversation disappear.
Remaining concerns include an HR policy bot and equipment negotiation for grant
preparation, a song for written updates, meeting minutes for a board deck, and
job-application drafting for a funder conversation. Equipment negotiation also
remains in two staff-conversation lists. These are review observations, not new
benchmark labels or approved relevance judgments. All existing labels stay intact.

## Failures and corrections

V43 source `fe137f9f7545159f6947af247219385b157fa634`, run `41258981865`
attempt two, completes all forty cases. One request times out and retains its
full $0.006756 reservation. Thirty-four nonempty responses fail schema validation;
five all-null abstentions parse successfully. All 39 completed requests have
measured usage. The [expanded output](v43-expanded-review.md) is rules fallback
output, not evidence of the candidate's ranking quality.

A local regression reproduces a valid selection being rejected because its
auxiliary statement exceeds 80 characters. V43's diagnostics do not identify
the failed statement constraint, so this is a confirmed parser defect, not
proof of the precise cause of every live rejection. V44 removes that prose
length limit and requests five-word statements. The existing whole-response
bound remains 2,048 characters; selected statements must still be nonempty,
unused statements empty, and all numeric IDs valid and unique. Sanitized issue
counts distinguish statement failures from invalid positions. No statement text
is returned to the browser or recorded in diagnostics. Live validity is restored.

V45 source `f00d53d630c69bc5cb95a9db1724cf7144d23757`, run `41260777156`
attempt two, adds a stricter supporting-method instruction. It regresses to
8/10 each with six duplicate-response fallbacks and two returning podcast flags.
All forty requests have measured accounting; there are no timeouts, transport
failures or new unknown charges. Median latency is 1,940ms and maximum 2,896ms.
The workflow passes its original threshold but the unchanged stricter audit
[fails](runs/41260777156-2/state/validation.json). V45 is withdrawn; its complete
[expanded review](v45-expanded-review.md) and failed results are preserved.

The first V43 run, `41258570330` attempt two, stopped before any paid request
because an unpaid blank readiness response lacked a diagnostic header. Its
durable charge is zero. The corrected loop waits within the existing deadline
only for this response to the fixed all-blank intake. It saves startup failures
in readiness.json. Other transport/diagnostic errors still fail. Paid cases
never retry. A saved structural schema rejection now stops further paid cases;
unsubmitted cases stay missing and cannot pass validation.

## Budget and retained state

This task records **$0.189217**, comprising $0.182461 measured charges and one
$0.006756 unknown reservation. Cumulative spend is **$3.737164** under the
unchanged $4 cap, leaving **$0.262836**. All **$0.366876** cumulative unknown
reservations remain charged. Nothing is reset, refunded or repriced. The four
preliminary attempts made no paid calls; the additional startup failure also
spent zero. The three paid variants submitted 120 cases, all retained.

The remaining allowance is below the unchanged $0.270240 maximum reservation
for another complete forty-case run. No further paid calls were made.

Branch selection code and prompt are restored exactly to tested V44. This is
not a claim of a fresh paid run on the final documentation/budget commit. The
deployed artifact is disabled V45. Provider/rate keys, temporary approval and
the evaluation trigger are removed. An independent unpaid probe confirms the
endpoint is disabled. The latest production deployment still records LLM calls
and usage logging as false. No merge, approval, reviewer request or automation
was created. Expanded-set human review and production enablement remain pending.

Final local verification passes: 661 tests, typecheck, lint, build and an unpaid
Cloudflare runtime test with zero external requests. The retained server and
evaluation code matches V44's tested source. Frozen benchmark/catalog files,
candidate retrieval, task-diversity gate and production deployment configuration
match the task's starting revision. Only new evidence and cumulative budget
records are added after the paid test.
