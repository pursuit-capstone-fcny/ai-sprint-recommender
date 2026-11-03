import { describe, expect, it } from 'vitest';
import type { CatalogItem } from '../contracts/catalogItem';
import { fallbackVideos } from './fallbackVideos';

function item(
  youtubeId: string,
  fields: Partial<CatalogItem> = {},
): CatalogItem {
  return {
    youtubeId,
    title: 'Fictional catalog lesson',
    description: 'Public fixture description.',
    functionAreas: [],
    tasks: [],
    tools: [],
    addedAt: null,
    status: 'active',
    isStartHere: false,
    ...fields,
  };
}

describe('general fallback videos', () => {
  it('prefers Start here, newest known dates, then stable IDs, without mutating the catalog', () => {
    const catalog = [
      item('newest00001', { addedAt: '2026-11-02' }),
      item('startOld001', { isStartHere: true, addedAt: '2025-01-01' }),
      item('unknown0002'),
      item('startNew001', { isStartHere: true, addedAt: '2026-01-01' }),
      item('unknown0001'),
      item('older000001', { addedAt: '2026-01-01' }),
      item('newer000002', { addedAt: '2026-11-01' }),
    ];
    const before = structuredClone(catalog);
    const results = fallbackVideos(catalog);
    expect(results.map(({ item }) => item.youtubeId)).toEqual([
      'startNew001',
      'startOld001',
      'newest00001',
      'newer000002',
      'older000001',
      'unknown0001',
      'unknown0002',
    ]);
    expect(catalog).toEqual(before);
    expect(results.every((r) => r.matchType === 'fallback')).toBe(true);
    expect(results[0].reason).toBe('Marked Start here by the library.');
    expect(results[2].reason).toBe(
      'A general suggestion for exploring the library.',
    );
  });

  it('excludes retired videos and every copy of duplicate IDs, even active/retired pairs', () => {
    const results = fallbackVideos([
      item('active00001'),
      item('retired0001', { status: 'retired', isStartHere: true }),
      item('duplicate01'),
      item('duplicate01'),
      item('duplicate02'),
      item('duplicate02', { status: 'retired' }),
    ]);
    expect(results.map(({ item }) => item.youtubeId)).toEqual(['active00001']);
    expect(fallbackVideos([])).toEqual([]);
  });
});
