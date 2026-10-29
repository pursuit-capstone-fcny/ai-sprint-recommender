import haikuConfig from '../wrangler.evaluation.json';
import lunaConfig from '../wrangler.luna-test.json';
import { describe, expect, it } from 'vitest';
import { readLimits, budgetKey } from './config';
import { environment } from './test-helpers';
describe('recommendation configuration', () => {
  it('shares the existing comparison allowance across providers and rejects partial or production budgets', () => {
    const haiku = readLimits(haikuConfig.vars)!;
    const luna = readLimits(lunaConfig.vars)!;
    expect(haiku).not.toBeNull();
    expect(budgetKey(haiku)).toBe(budgetKey(luna));
    expect(budgetKey(haiku)).toBe('test:gpt-6-luna');
    for (const change of [
      { LLM_ENVIRONMENT: 'production' },
      { LLM_PRIOR_MICRODOLLARS: undefined },
      { LLM_MODEL: 'unapproved' },
      { LLM_MAX_OUTPUT_TOKENS: '513' },
      { LLM_INPUT_MICRODOLLARS_PER_MILLION: '1' },
    ])
      expect(readLimits({ ...haikuConfig.vars, ...change })).toBeNull();
  });
  it('rejects unsafe intermediate multiplication even when the final cost could fit', () => {
    expect(
      readLimits({
        ...environment,
        LLM_INPUT_MICRODOLLARS_PER_MILLION: Number.MAX_SAFE_INTEGER.toString(),
      }),
    ).toBeNull();
  });
  it('requires trusted Apps Script URL and positive consistent limits', () => {
    expect(
      readLimits({
        ...environment,
        LLM_CATALOG_URL: 'https://attacker.example/catalog',
      }),
    ).toBeNull();
    expect(
      readLimits({ ...environment, LLM_DAILY_MICRODOLLARS: '0' }),
    ).toBeNull();
    expect(
      readLimits({ ...environment, LLM_DAILY_MICRODOLLARS: '10000001' }),
    ).toBeNull();
  });
});
