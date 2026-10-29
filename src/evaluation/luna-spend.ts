import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import {
  LUNA_PRIOR_SPEND,
  LUNA_SPEND_CAPTURES,
  LUNA_DEPLOYED_BUDGETS,
} from './luna-ledger';
import { lunaSpent } from './luna';

const amount = z.number().int().nonnegative().max(1_000_000);
const deployedBudget = z.object({
  kind: z.literal('deployed-luna-budget'),
  allowanceMicrodollars: z.literal(1_000_000),
  priorSpendMicrodollars: amount,
  spentMicrodollars: amount,
  additionalMicrodollars: amount,
  remainingMicrodollars: amount,
});

export function deployedLunaSpend(value: unknown, prior: number): number {
  const budget = deployedBudget.parse(value);
  assert.equal(
    budget.priorSpendMicrodollars,
    prior,
    'Deployed allowance chain changed',
  );
  assert.equal(budget.spentMicrodollars, prior + budget.additionalMicrodollars);
  assert.equal(
    budget.remainingMicrodollars,
    1_000_000 - budget.spentMicrodollars,
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
  let prior = LUNA_SPEND_CAPTURES.reduce(
    (sum, [path, hash]) => sum + lunaSpent(read(path, hash)),
    0,
  );
  for (const [path, hash] of LUNA_DEPLOYED_BUDGETS)
    prior += deployedLunaSpend(read(path, hash), prior);
  assert.equal(
    prior,
    LUNA_PRIOR_SPEND,
    'Prior Luna allowance evidence changed',
  );
  return prior;
}
