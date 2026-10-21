import { describe, expect, it } from 'vitest';
import { CatalogItemSchema } from './catalogItem';
import catalogFixture from '../../fixtures/catalog.json';

const validRow = {
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

describe('CatalogItemSchema', () => {
  it('AC-9.6: the frozen fixture parses against the catalog contract', () => {
    expect(catalogFixture.length).toBeGreaterThanOrEqual(12);
    expect(catalogFixture.length).toBeLessThanOrEqual(15);
    for (const row of catalogFixture) {
      expect(() => CatalogItemSchema.parse(row)).not.toThrow();
    }
  });

  it('AC-9.1: a well-formed row produces a CatalogItem with exactly the whitelisted fields', () => {
    const result = CatalogItemSchema.parse(validRow);
    expect(Object.keys(result).sort()).toEqual(Object.keys(validRow).sort());
  });

  it('AC-9.1: a row missing a required field fails parsing', () => {
    const withoutTitle: Record<string, unknown> = { ...validRow };
    delete withoutTitle.title;
    expect(() => CatalogItemSchema.parse(withoutTitle)).toThrow();
  });

  it('AC-9.1: a row with a malformed addedAt fails parsing', () => {
    expect(() =>
      CatalogItemSchema.parse({ ...validRow, addedAt: '10/01/2026' }),
    ).toThrow();
  });

  it('AC-9.1: a row with an unknown status value fails parsing', () => {
    expect(() =>
      CatalogItemSchema.parse({ ...validRow, status: 'archived' }),
    ).toThrow();
  });

  it('AC-9.1: a non-whitelisted field is stripped from the parsed output', () => {
    const result = CatalogItemSchema.parse({
      ...validRow,
      internalCostNotes: 'should not survive parsing',
    });
    expect(result).not.toHaveProperty('internalCostNotes');
  });

  it('AC-9.1: a malformed youtubeId fails parsing', () => {
    expect(() =>
      CatalogItemSchema.parse({ ...validRow, youtubeId: 'tooShort' }),
    ).toThrow();
    expect(() =>
      CatalogItemSchema.parse({ ...validRow, youtubeId: 'has a space' }),
    ).toThrow();
  });

  it('AC-9.1: durationSeconds may be omitted', () => {
    expect(() => CatalogItemSchema.parse(validRow)).not.toThrow();
  });
});
