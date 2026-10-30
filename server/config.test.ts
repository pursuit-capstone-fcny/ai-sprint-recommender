import { describe, expect, it } from 'vitest';
import { readLimits } from './config';
import { environment } from './test-helpers';
describe('recommendation configuration', () => {
  it('normalizes a trailing slash before returning validated limits', () => {
    expect(
      readLimits({
        ...environment,
        LIBRARY_ORIGIN: environment.LIBRARY_ORIGIN + '/',
      })?.LIBRARY_ORIGIN,
    ).toBe(environment.LIBRARY_ORIGIN);
  });
  it('rejects unsafe intermediate multiplication even when the final cost could fit', () => {
    expect(
      readLimits({
        ...environment,
        LLM_INPUT_MICRODOLLARS_PER_MILLION: Number.MAX_SAFE_INTEGER.toString(),
      }),
    ).toBeNull();
  });
  it('requires a published HTTPS catalog origin and positive consistent limits', () => {
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
