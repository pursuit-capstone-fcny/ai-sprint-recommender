import { describe, expect, it } from 'vitest';
import { RankedMatchSchema } from './rankedMatch';

const item = {
  youtubeId: 'fx99ValidRw',
  title: '[Fixture] Valid Row',
  description: 'A fictional row used to test the happy path.',
  functionAreas: ['Operations'],
  tasks: ['testing'],
  tools: ['Vitest'],
  addedAt: '2026-10-01',
  status: 'active',
  isStartHere: false,
};

describe('RankedMatchSchema', () => {
  it('wraps a valid CatalogItem with a reason string', () => {
    expect(() =>
      RankedMatchSchema.parse({
        item,
        reason: 'In Operations, about testing',
        matchType: 'strong',
      }),
    ).not.toThrow();
  });

  it('rejects an empty reason', () => {
    expect(() =>
      RankedMatchSchema.parse({ item, reason: '', matchType: 'strong' }),
    ).toThrow();
  });

  it('matchType accepts both strong and fallback', () => {
    expect(() =>
      RankedMatchSchema.parse({
        item,
        reason: 'In Operations, about testing',
        matchType: 'strong',
      }),
    ).not.toThrow();
    expect(() =>
      RankedMatchSchema.parse({
        item,
        reason: 'A good place to start.',
        matchType: 'fallback',
      }),
    ).not.toThrow();
  });

  it('matchType rejects an unknown value', () => {
    expect(() =>
      RankedMatchSchema.parse({
        item,
        reason: 'In Operations, about testing',
        matchType: 'weak',
      }),
    ).toThrow();
  });
});
