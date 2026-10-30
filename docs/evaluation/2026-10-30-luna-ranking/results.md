# Fundraising ranking corrected with breadth retained

V14 Fast scores **10/10 in all three trials**. Fundraising-02 puts both
existing labeled matches in its first two positions in every trial, with
7, 6 and 6 videos. Accepted six-to-eight lists increase from V12 Fast's
27/30 to **28/30**, with no benchmark timeouts, invalid responses or fallbacks.
These results pass the fixed ranking and breadth targets. Expanded-set,
unseen-wording and client review remain pending. Production LLM calls and
usage logging remain disabled.

| Measure                       | V12 Fast  | V13 Fast, rejected | V14 Fast   |
| ----------------------------- | --------- | ------------------ | ---------- |
| Top-three scores              | 10, 9, 9  | 10, 9, 9           | 10, 10, 10 |
| Fundraising-02 passing trials | 1/3       | 2/3                | 3/3        |
| Fundraising-02 video counts   | 6, 6, 4   | 8, 6, 6            | 7, 6, 6    |
| Accepted six-to-eight lists   | 27/30     | 23/30              | 28/30      |
| Benchmark fallbacks           | 0         | 1                  | 0          |
| Timeouts                      | 0         | 0                  | 0          |
| Invalid responses             | 0         | 1 duplicate        | 0          |
| Measured requests             | 34/34     | 34/34              | 34/34      |
| Measured cost                 | $0.064224 | $0.065372          | $0.065693  |

## Ranking change

Fundraising-02 asks for both anticipating a funder's questions and rehearsing
answers. V12 sometimes omits Grantmaker Review Grantee or places it fourth.
Its description directly demonstrates taking a major donor's perspective and
producing probing questions. Raw and browser orders agree, so browser trimming
does not explain those misses.

V14 separates selecting the useful expanded set from ordering it. It makes
the direction of questions explicit and keeps missing tool tags from overriding
direct content evidence. Supporting workflows remain later in the list. A final
repeat check retains the strict duplicate validator. The instruction contains
no benchmark IDs, titles or labels. This is tuning against an inspected
benchmark; unseen wording remains a separate requirement.

Fundraising-02's first three are identical in all three V14 trials:

1. Grantmaker Review Grantee, existing good label.
2. Grantmaker-Donor Role Play, existing ideal label.
3. Build a Custom AI Assistant for Staff Training, unreviewed for this profile.

The [ranking audit](runs/41102285741-2/state/ranking-audit.json) records all
three full raw and displayed orders. The [trial plan](test-plan.md) fixes the
controls and supplemental success targets. Ten request-hash tests verify that
removing the appended instruction and normalizing the processing tier reproduces
the original V12 requests. All 89 items, low effort, Fast processing, schema,
token bounds and deadlines are retained. The benchmark fingerprint is unchanged:
`298ffdb6199c3a8bdb9ef48063ccfc4e16ca5efda14267a240c93d42d20b6d09`.
Labels, tags and the two-real-primary-task gate did not change.

## Validation evidence and limits

[Run 41102285741 attempt 2](https://github.com/pursuit-capstone-fcny/ai-sprint-recommender/actions/runs/41102285741/attempts/2)
tested source `ba504fd32b3cb8f43472d0bbb7d47870d77891b6`. The
[fresh report](runs/41102285741-2/comparison/report.md),
[comparison](runs/41102285741-2/comparison/comparison.json) and
[accounting audit](runs/41102285741-2/state/accounting-audit.json) preserve
all outcomes.

- All 34 calls have final measured usage, Fast tier and complete diagnostics.
  All four cache-check diagnostics are present. Fresh top-three relevance
  evidence is complete. Median client latency is 1.4995s, p95 2.916s and
  maximum 3.197s. No cooldown, recovery or per-case paid retry was needed.
- Rules remains 8/10. Leadership-02 has four videos in trials one and three;
  every other accepted list contains six to eight. No list exceeds eight.
- Expanded cards include 84 existing-label hits and 112 unreviewed appearances.
  The sparse top-three labels cannot certify the additional picks' relevance.
- Both reused wording probes have two top-three label hits and six videos.
  Nonsense falls back. The injection probe rejects the requested nonexistent
  ID but returns seven valid catalog videos instead of abstaining. Catalog-ID
  containment holds; this behavior still needs semantic review and is not
  evidence of complete injection resistance.
- All 15 deployed synthetic failure checks pass. The exact evaluated source
  passes 615 tests and its ordinary CI/preview checks. Final ledger and
  Haiku-cap checks pass all 617 tests, typecheck, lint and build. The preview
  smoke check returns HTTP 200; this revision changes no UI.

The shared Apps Script catalog was migrating during the first attempt. Its
published snapshot contains identical public data with a different version
hash. These trials therefore use a test-only Worker entry point serving the
original frozen snapshot through the existing parser, cache and recommendation
handler. They do not validate the migrated Apps Script integration or measure
its catalog latency. The [migration comparison](catalog-migration.json) records
the identical content. Production configuration and the shared script are untouched.

## Preserved unsuccessful attempts

V13, [run 41099659709 attempt 2](runs/41099659709-2/comparison/report.md),
scored 10/9/9, but only 23/30 lists retained six-to-eight breadth. One
Operations-01 response repeated a position and correctly fell back.
Fundraising-02's good match ranked second, fourth and second. The run cost
$0.065372; its failure and complete evidence are retained.

Run 41097724599 attempt 2 stopped on the catalog migration before paid calls.
The first attempts of runs 41101235270 and 41102285741 stopped before live
validation. Run 41101235270 attempt 2 passed enablement but stopped on an unpaid
cache-check transport failure without an HTTP response. Its durable budget
confirms $0 added. Each attempt's saved evidence remains under `runs/`.
GitHub delayed final status updates and rejected rerun/cancel requests during
setup; no paid case was repeated to work around that delay.

## Allowance and shutdown

The two paid revisions add **$0.131065** to the prior $0.925374 ceiling.
V14 alone costs **$0.065693**, about $0.001932 per call. The cumulative ceiling
is **$1.056439**, including the unchanged $0.225000 historical unknown
reservations. At least **$0.943561 remains** under the approved combined $2 Luna
cap. There are no new unknown charges, refunds or repricing. Haiku's original
$1 cap is unchanged; the carried shared floor exceeds it, so that disabled
configuration now fails closed. Unit fixtures use explicit historical balances.

V14 test calls were disabled at 18:07:25 UTC on October 30; both provider keys
and the rate key were absent by 18:07:28. An independent unpaid check confirms
shutdown. The temporary approval and trigger label were removed. V14 remains
the disabled candidate; there was no production enablement.

The latest production [deployment 41092025394](https://github.com/pursuit-capstone-fcny/ai-sprint-recommender/actions/runs/41092025394)
remains source `8f5e4a6662e653f041a52ea399433d38d152daae`. Its logs confirm
`LLM_ENABLED=false` and `VITE_USAGE_ENABLED=false`.

Unpaid reproduction from the repository root:

```sh
python3 docs/evaluation/2026-10-30-luna-fast/audit-accounting.py docs/evaluation/2026-10-30-luna-ranking/runs/41102285741-2
python3 docs/evaluation/2026-10-30-luna-ranking/audit-ranking.py docs/evaluation/2026-10-30-luna-ranking/runs/41102285741-2
```
