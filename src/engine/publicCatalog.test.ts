import { describe, expect, it } from 'vitest';
import fixture from '../../fixtures/public-catalog.json';
import { CatalogItemSchema, toCatalogItem } from '../contracts/catalogItem';
import { parsePublicCatalog } from '../contracts/publicCatalog';
import { rank } from './rank';

const catalog = parsePublicCatalog(fixture).items.map(toCatalogItem);

describe('shared public catalog integration', () => {
  it('ranks the same frozen fixture that validates the Apps Script endpoint', () => {
    for (const item of catalog)
      expect(CatalogItemSchema.safeParse(item).success).toBe(true);
    const result = rank(catalog, {
      functionArea: 'Fundraising',
      goalWords: ['grant'],
      tools: ['ChatGPT'],
    });
    expect(result[0].item.youtubeId).toBe('fx01GrntRpt');
    expect(
      result.every(({ item }) =>
        catalog.some((row) => row.youtubeId === item.youtubeId),
      ),
    ).toBe(true);
  });

  it('puts unknown upload dates last without changing earlier ranking tiers', () => {
    const item = catalog[0];
    const rows = [
      { ...item, youtubeId: 'unknownDate', addedAt: null },
      { ...item, youtubeId: 'olderVideo1', addedAt: '2025-01-01' },
      { ...item, youtubeId: 'newerVideo1', addedAt: '2026-01-01' },
    ];
    const result = rank(rows, { functionArea: null, goalWords: [], tools: [] });
    expect(result.map(({ item: video }) => video.youtubeId)).toEqual([
      'newerVideo1',
      'olderVideo1',
      'unknownDate',
    ]);
    expect(rows[0].addedAt).toBeNull();
  });
});
