# AI inference estimate for finance

Prepared November 3, 2026. No client operating budget is approved.

Jason reports that testing averages **$0.55 per 1,000 AI calls**, equivalent to
**$0.00055 per call**. The estimates below use that measured average as supplied;
this PR did not repeat paid tests. They assume comparable prompts, catalog size,
model and output lengths, with one AI call per submitted AI search.

## Regular use

The following scenarios assume **1,000 active users every day**, with every
listed search using Haiku AI. Deterministic searches make no provider call.

| AI searches per user per day | AI calls per day | Cost per day | 22 active days per month | 30 active days per month |
| ---------------------------- | ---------------: | -----------: | -----------------------: | -----------------------: |
| 1                            |            1,000 |        $0.55 |                   $12.10 |                   $16.50 |
| 3                            |            3,000 |        $1.65 |                   $36.30 |                   $49.50 |
| 5                            |            5,000 |        $2.75 |                   $60.50 |                   $82.50 |
| 10                           |           10,000 |        $5.50 |                  $121.00 |                  $165.00 |

```text
daily inference cost = daily active users × AI searches per user × $0.00055
monthly inference cost = daily inference cost × active days in that month
```

For example, if only 250 users are active daily and each makes three AI searches,
the estimate is $0.4125/day, or $12.38 over 30 active days, rounded to cents.
If half of their searches use AI, multiply the estimate by 0.5.

## Session or event use

For one event with all 1,000 participants:

| AI searches per participant | AI calls per event | Cost per event | Four such events per month |
| --------------------------- | -----------------: | -------------: | -------------------------: |
| 1                           |              1,000 |          $0.55 |                      $2.20 |
| 3                           |              3,000 |          $1.65 |                      $6.60 |
| 5                           |              5,000 |          $2.75 |                     $11.00 |

One thousand simultaneous users is a throughput requirement. It does not establish
how many calls occur across a day or month. Finance can select the event or
regular-use scenario that matches the distribution plan.

## Scope and approval

These figures cover provider inference. Hosting, analytics ingestion/storage,
monitoring, taxes and support are not priced here. The capacity design may add
infrastructure costs; those need a separate estimate before budget approval.
Usage and token lengths can change the average, so reconcile actual billed cost
with successful calls during the pilot and update the forecast.

The current owner-authorized test/production allowance of $1/day and $5/month
is not an approved ongoing client budget. This document changes no spending cap
and authorizes no additional calls. Finance should approve an operating ceiling
and an over-budget policy before the 1,000-user rollout.

The [capacity preflight](capacity.md) separately reports a conservative configured
reservation ceiling of up to $16.192 for 1,000 full-catalog calls. Reservations protect
the spending cap before calls finish; actual usage is reconciled afterward.
The forecast tables use the reported measured average of $0.55 per 1,000 calls.
The existing backend still fails the 1,000-user readiness check.
