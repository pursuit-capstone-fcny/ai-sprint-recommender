import { expect, it } from 'vitest';
import { reviewedIds } from './haiku-review-output';

it('excludes weak judgments, orders direct methods before support and preserves draft priority within each group', () => {
  expect(
    reviewedIds(
      { candidate0: 0, candidate1: 1, candidate2: 2, candidate3: 1 },
      ['weak', 'support', 'direct', 'alternative'],
      [0, 1, 2, 3],
    ),
  ).toEqual(['direct', 'support', 'alternative']);
});
it.each([
  { candidate0: 3 },
  { candidate0: 1, candidate1: 0 },
  { candidate0: '2' },
  {},
])('rejects an invalid or incomplete review', (value) => {
  expect(reviewedIds(value, ['one'], [0])).toBeNull();
});
it('allows abstention and never returns more than eight candidates', () => {
  expect(reviewedIds({ candidate0: 0 }, ['one'], [0])).toEqual([]);
  const ids = Array.from({ length: 18 }, (_, i) => String(i));
  expect(
    reviewedIds(
      Object.fromEntries(ids.map((i) => ['candidate' + i, 1])),
      ids,
      ids.map(Number),
    ),
  ).toEqual(ids.slice(0, 8));
});
