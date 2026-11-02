import { describe, expect, it } from 'vitest';
import fixture from '../../fixtures/public-catalog.json';
import { toCatalogItem } from '../contracts/catalogItem';
import { parsePublicCatalog } from '../contracts/publicCatalog';
import { canonicalGoalTasks, usageMatchType } from './usageContext';

const catalog = parsePublicCatalog(fixture);
const item = toCatalogItem(catalog.items[0]);
describe('usage metadata', () => {
  it('maps goal words through the same vocabulary but returns only canonical dictionary task values', () => {
    const dictionary = {
      ...catalog,
      tasks: ['grant writing', 'meeting summaries', 'unrelated task'],
    };
    expect(
      canonicalGoalTasks(
        ['proposal', 'minutes', 'private-fixture-text'],
        dictionary,
      ),
    ).toEqual(['grant writing', 'meeting summaries']);
    expect(canonicalGoalTasks(['private-fixture-text'], dictionary)).toEqual(
      [],
    );
  });
  it('preserves engine strong classifications and distinguishes start-here, cross-area and weak fallbacks', () => {
    const profile = { functionArea: null, goalWords: [], tools: [] };
    expect(
      usageMatchType({ item, reason: 'Fixture', matchType: 'strong' }, profile),
    ).toBe('strong');
    const match = {
      item: { ...item, isStartHere: false },
      reason: 'Fixture',
      matchType: 'fallback' as const,
    };
    expect(usageMatchType(match, profile)).toBe('weak');
    expect(
      usageMatchType(match, { ...profile, functionArea: 'Another area' }),
    ).toBe('cross-area');
    expect(
      usageMatchType(
        { ...match, item: { ...item, isStartHere: true } },
        profile,
      ),
    ).toBe('start-here');
  });
});

it('records original published task names for equivalent engine wording without leaking private input', () => {
  const current = {
    ...catalog,
    tasks: [
      'grant opportunity review',
      'newsletter drafting',
      'unrelated task',
    ],
  };
  expect(canonicalGoalTasks(['RFP', 'private-fixture-words'], current)).toEqual(
    ['grant opportunity review'],
  );
  expect(canonicalGoalTasks(['newsletter', 'newsletter'], current)).toEqual([
    'newsletter drafting',
  ]);
  expect(canonicalGoalTasks(['private-fixture-words'], current)).toEqual([]);
  expect(canonicalGoalTasks(['RFP'], current)).not.toContain('RFP review');
});
it('uses complete published task aliases and caps keyword output without using returned cards', () => {
  const current = {
    ...catalog,
    tasks: ['governance'],
    synonyms: [
      {
        category: 'task' as const,
        alias: 'oversight process',
        target: 'governance',
      },
    ],
  };
  expect(canonicalGoalTasks(['oversight', 'process'], current)).toEqual([
    'governance',
  ]);
  expect(canonicalGoalTasks(['process'], current)).toEqual([]);
  expect(
    canonicalGoalTasks(['tag'], {
      ...catalog,
      tasks: Array.from({ length: 80 }, (_, i) => `tag ${i}`),
    }),
  ).toHaveLength(50);
});
