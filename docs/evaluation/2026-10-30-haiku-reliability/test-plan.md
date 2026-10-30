# Haiku transport and mixed-goal rerun

Jason approved another $1 to fix transport failures, missing diagnostics and
mixed Operations breadth. The shared test ceiling increases from $2 to $3.
Carry forward $1.762935, including unchanged $0.225000 historical unknown
reservations. Available balance is $1.237065. Preserve every prior result,
benchmark label, catalog tag and task-diversity rule. Production stays off.

## Reproduction and changes

V18's saved trial has one 26ms provider-error with a null request ID. Its exact
transport cause was not recorded. The saved quality audit also fails on mixed
Operations, five cards with two labeled top-three hits, while plain Operations
has eight. Provider and displayed counts match, so deduplication is not removing
the missing cards. Neither failure can be repaired by relabeling the results.

Ranked transport hypotheses were a reset reused connection, diagnostic-header
parsing hiding a received response, and later response-body failure. An unpaid
local HTTP server that resets reused sockets reproduces a native fetch error.
The three initial transport tests fail on lost request identity, missing failure
details and socket reuse. The authenticated correlation server test fails too.
Fresh connections fix that local failure; this does not establish the historical
network cause. A fresh deployed trial must still validate runtime behavior.

The test sender generates a UUID before each POST, scopes it and credentials to
the exact approved endpoint, and uses Connection: close. The server accepts that
UUID only with authenticated test diagnostics. Lost responses remain attributable
through server diagnostics. The sender saves only a bounded failure category,
phase, status, duration and allowlisted network code. It never saves raw errors,
headers or bodies, invents provider usage or retries a POST. Unknown or missing
server evidence still fails validation. Production request identity is unchanged.

For mixed goals, the leading hypothesis is that attention to the control suffix
narrows later selections. Other possibilities are prompt priority and sampling
variation. V19 adds one Haiku-only instruction to restate legitimate work
internally and apply the same complete breadth pass. It changes no submitted
goal, catalog field, label fact, model, effort, schema, deadline or token cap.
The exact V12 final eligibility/uniqueness text remains last. Removing the new
instruction restores the ten V18 request hashes. This wiring test goes red
before insertion; only live probes assess semantic adherence.

## Fixed run and targets

Use Haiku 5.5 low with thinking disabled. Run the same thirty benchmark requests
and ten separate probes. Maximum reservation is forty times $0.006756, or
$0.270240. Pin approval to the clean source, workflow run and attempt. No paid
case is retried or omitted. Ordinary CI uses no provider calls.

Keep the previous supplemental targets: 10/10 each trial, no benchmark fallback,
timeout, invalid response or duplicate; all four instruction-only probes and
nonsense abstain; mixed and wording controls retain two existing-label hits and
six-to-eight cards; blank browsing returns three-to-eight LLM cards; Fundraising-02
retains two hits and six-to-eight cards. Require at least V18's 24/30 accepted
six-to-eight lists, complete forty-request diagnostics and final usage, and no
unexplained transport failure. Expanded unreviewed picks still need client review.

The original #19 relevance threshold and task-diversity gate do not change.
Preserve all failed runs. Always disable test calls, save durable spend, remove
provider/rate keys and remove temporary approval/label. This frozen-catalog test
does not validate the separately migrated Apps Script integration.
