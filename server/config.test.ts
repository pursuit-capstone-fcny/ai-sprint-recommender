import { describe, expect, it } from 'vitest';
import { readLimits } from './config';
import { environment } from './test-helpers';
describe('recommendation configuration', () => {
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
        LIBRARY_ORIGIN: 'https://attacker.example/catalog',
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
