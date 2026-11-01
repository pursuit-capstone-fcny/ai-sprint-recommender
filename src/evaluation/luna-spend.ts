import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import {
  LUNA_PRIOR_SPEND,
  LUNA_SPEND_CAPTURES,
  LUNA_DEPLOYED_BUDGETS,
  LUNA_ALLOWANCE_GRANT,
  HAIKU_ALLOWANCE_SCOPE,
  HAIKU_RELIABILITY_ALLOWANCE_GRANT,
  HAIKU_QUALITY_ALLOWANCE_GRANT,
  HAIKU_PLANNING_ALLOWANCE_GRANT,
} from './luna-ledger';
import { lunaSpent } from './luna';
import { LUNA_TOTAL_ALLOWANCE } from '../../server/luna-policy';

const amount = z.number().int().nonnegative().max(LUNA_TOTAL_ALLOWANCE);
const deployedBudget = z.object({
  kind: z.enum(['deployed-luna-budget', 'deployed-model-budget']),
  allowanceMicrodollars: z.union([
    z.literal(1_000_000),
    z.literal(2_000_000),
    z.literal(3_000_000),
    z.literal(4_000_000),
    z.literal(LUNA_TOTAL_ALLOWANCE),
  ]),
  priorSpendMicrodollars: amount,
  spentMicrodollars: amount,
  additionalMicrodollars: amount,
  remainingMicrodollars: amount,
});

export function deployedLunaSpend(
  value: unknown,
  prior: number,
  allowance = 1_000_000,
): number {
  const budget = deployedBudget.parse(value);
  assert.equal(
    budget.allowanceMicrodollars,
    allowance,
    'Deployed allowance changed',
  );
  assert.equal(
    budget.priorSpendMicrodollars,
    prior,
    'Deployed allowance chain changed',
  );
  assert.equal(budget.spentMicrodollars, prior + budget.additionalMicrodollars);
  assert.equal(
    budget.remainingMicrodollars,
    allowance - budget.spentMicrodollars,
  );
  return budget.additionalMicrodollars;
}

export function readLunaPriorSpend(): number {
  const read = (path: string, hash: string) => {
    const bytes = readFileSync(path);
    assert.equal(
      createHash('sha256').update(bytes).digest('hex'),
      hash,
      'Prior Luna evidence changed',
    );
    return JSON.parse(bytes.toString('utf8'));
  };
  const grant = z
    .strictObject({
      kind: z.literal('evaluation-allowance-increase'),
      approvedBy: z.literal('Jason'),
      approvedAt: z.literal('2026-10-30'),
      previousAllowanceMicrodollars: z.literal(1_000_000),
      additionalAllowanceMicrodollars: z.literal(1_000_000),
      totalAllowanceMicrodollars: z.literal(2_000_000),
      priorCeilingMicrodollars: z.literal(861_150),
      unresolvedReservationsMicrodollars: z.literal(225_000),
      scope: z.string().min(1),
    })
    .parse(read(...LUNA_ALLOWANCE_GRANT));
  assert.equal(
    grant.previousAllowanceMicrodollars + grant.additionalAllowanceMicrodollars,
    2_000_000,
  );
  const scope = z
    .strictObject({
      kind: z.literal('evaluation-allowance-scope'),
      approvedBy: z.literal('Jason'),
      approvedAt: z.literal('2026-10-30'),
      models: z.tuple([z.literal('gpt-6-luna'), z.literal('claude-haiku-5-5')]),
      totalAllowanceMicrodollars: z.literal(2_000_000),
      additionalAllowanceMicrodollars: z.literal(0),
      priorCeilingMicrodollars: z.literal(1_133_483),
      remainingMicrodollars: z.literal(866_517),
      unresolvedReservationsMicrodollars: z.literal(225_000),
      scope: z.string().min(1),
    })
    .parse(read(...HAIKU_ALLOWANCE_SCOPE));
  assert.equal(
    scope.priorCeilingMicrodollars + scope.remainingMicrodollars,
    2_000_000,
  );
  const reliabilityGrant = z
    .strictObject({
      kind: z.literal('evaluation-allowance-increase'),
      approvedBy: z.literal('Jason'),
      approvedAt: z.literal('2026-10-30'),
      previousAllowanceMicrodollars: z.literal(2_000_000),
      additionalAllowanceMicrodollars: z.literal(1_000_000),
      totalAllowanceMicrodollars: z.literal(3_000_000),
      priorCeilingMicrodollars: z.literal(1_762_935),
      unresolvedReservationsMicrodollars: z.literal(225_000),
      scope: z.string().min(1),
    })
    .parse(read(...HAIKU_RELIABILITY_ALLOWANCE_GRANT));
  assert.equal(
    reliabilityGrant.previousAllowanceMicrodollars +
      reliabilityGrant.additionalAllowanceMicrodollars,
    3_000_000,
  );
  const qualityGrant = z
    .strictObject({
      kind: z.literal('evaluation-allowance-increase'),
      approvedBy: z.literal('Jason'),
      approvedAt: z.literal('2026-10-31'),
      previousAllowanceMicrodollars: z.literal(3_000_000),
      additionalAllowanceMicrodollars: z.literal(1_000_000),
      totalAllowanceMicrodollars: z.literal(4_000_000),
      priorCeilingMicrodollars: z.literal(2_810_692),
      unresolvedReservationsMicrodollars: z.literal(292_560),
      scope: z.string().min(1),
    })
    .parse(read(...HAIKU_QUALITY_ALLOWANCE_GRANT));
  assert.equal(
    qualityGrant.previousAllowanceMicrodollars +
      qualityGrant.additionalAllowanceMicrodollars,
    4_000_000,
  );
  const planningGrant = z
    .strictObject({
      kind: z.literal('evaluation-allowance-increase'),
      approvedBy: z.literal('Jason'),
      approvedAt: z.literal('2026-10-31'),
      previousAllowanceMicrodollars: z.literal(4_000_000),
      additionalAllowanceMicrodollars: z.literal(1_000_000),
      totalAllowanceMicrodollars: z.literal(LUNA_TOTAL_ALLOWANCE),
      priorCeilingMicrodollars: z.literal(3_798_745),
      unresolvedReservationsMicrodollars: z.literal(366_876),
      scope: z.string().min(1),
    })
    .parse(read(...HAIKU_PLANNING_ALLOWANCE_GRANT));
  assert.equal(
    planningGrant.previousAllowanceMicrodollars +
      planningGrant.additionalAllowanceMicrodollars,
    LUNA_TOTAL_ALLOWANCE,
  );
  let prior = LUNA_SPEND_CAPTURES.reduce(
    (sum, [path, hash]) => sum + lunaSpent(read(path, hash)),
    0,
  );
  for (const [path, hash, allowance = 1_000_000] of LUNA_DEPLOYED_BUDGETS) {
    assert(allowance <= LUNA_TOTAL_ALLOWANCE);
    if (allowance > 1_000_000) assert(prior >= grant.priorCeilingMicrodollars);
    if (allowance > 2_000_000)
      assert(prior >= reliabilityGrant.priorCeilingMicrodollars);
    if (allowance > 3_000_000)
      assert(prior >= qualityGrant.priorCeilingMicrodollars);
    if (allowance > 4_000_000)
      assert(prior >= planningGrant.priorCeilingMicrodollars);
    prior += deployedLunaSpend(read(path, hash), prior, allowance);
  }
  assert(prior >= scope.priorCeilingMicrodollars);
  assert(prior >= reliabilityGrant.priorCeilingMicrodollars);
  assert(prior >= qualityGrant.priorCeilingMicrodollars);
  assert(prior >= planningGrant.priorCeilingMicrodollars);
  assert.equal(
    prior,
    LUNA_PRIOR_SPEND,
    'Prior Luna allowance evidence changed',
  );
  return prior;
}
