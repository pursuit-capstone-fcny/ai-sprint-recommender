import { describe, expect, it } from 'vitest';
import type { CatalogItem } from '../contracts/catalogItem';
import {
  DEFAULT_VIDEO_IDS,
  FALLBACK_VIDEO_IDS,
  defaultVideos,
  fallbackVideos,
} from './curatedVideos';

function item(
  youtubeId: string,
  fields: Partial<CatalogItem> = {},
): CatalogItem {
  return {
    youtubeId,
    title: 'Fictional collection lesson',
    description: 'Fictional public metadata for collection tests.',
    functionAreas: [],
    tasks: [],
    tools: [],
    addedAt: null,
    status: 'active',
    isStartHere: false,
    ...fields,
  };
}

describe('curated browsing collections', () => {
  const catalog = [...DEFAULT_VIDEO_IDS, ...FALLBACK_VIDEO_IDS].map((id) =>
    item(id),
  );

  it('shows the approved eight beginner introductions in editorial order', () => {
    expect(
      defaultVideos([...catalog].reverse()).map((r) => r.item.youtubeId),
    ).toEqual([
      'rFhgVTsItlU',
      'FMQJH3c5cLc',
      'DP0rtrJVOvM',
      'tIekXJLsm8g',
      'kONzk7f2M5o',
      '33a0qYtCMvc',
      'W-j725bzPJU',
      '_wdiyBIC8uc',
    ]);
  });

  it('shows the approved eight fallback videos with no default overlap', () => {
    const results = fallbackVideos([...catalog].reverse());
    expect(results.map((r) => r.item.youtubeId)).toEqual([
      '6d2bKhdmqqA',
      'rjaMvND2IRU',
      'Xlvo2_eUBLo',
      'cwCVpchJHB4',
      'maR3ZerQIJU',
      'nBAaIIz9QFg',
      'Kv0C743lCUw',
      'C7wclvAF0Mc',
    ]);
    const defaultIds = new Set(
      defaultVideos(catalog).map((r) => r.item.youtubeId),
    );
    expect(results.every((r) => !defaultIds.has(r.item.youtubeId))).toBe(true);
    expect(results.every((r) => r.matchType === 'fallback')).toBe(true);
  });

  it.each([
    [defaultVideos, DEFAULT_VIDEO_IDS, FALLBACK_VIDEO_IDS],
    [fallbackVideos, FALLBACK_VIDEO_IDS, DEFAULT_VIDEO_IDS],
  ])(
    'replaces unavailable selections before borrowing from the other collection',
    (select, ids, reserved) => {
      const missing = ids[0];
      const duplicate = ids[1];
      const retired = ids[2];
      const changed = catalog
        .filter((row) => row.youtubeId !== missing)
        .map((row) =>
          row.youtubeId === retired
            ? { ...row, status: 'retired' as const }
            : row,
        );
      changed.push(item(duplicate, { status: 'retired' }));
      changed.push(item('spareVideo1', { isStartHere: true }));
      changed.push(item('spareVideo2', { addedAt: '2026-11-02' }));
      changed.push(item('spareVideo3'));
      const before = structuredClone(changed);
      const results = select(changed);
      expect(results.map((r) => r.item.youtubeId)).toEqual([
        ...ids.slice(3),
        'spareVideo1',
        'spareVideo2',
        'spareVideo3',
      ]);
      expect(
        results.every((r) => !reserved.some((id) => id === r.item.youtubeId)),
      ).toBe(true);
      expect(changed).toEqual(before);
    },
  );

  it('keeps replacement videos distinct when both collections lose a selection', () => {
    const changed = catalog.filter(
      (row) =>
        row.youtubeId !== DEFAULT_VIDEO_IDS[0] &&
        row.youtubeId !== FALLBACK_VIDEO_IDS[0],
    );
    changed.push(item('spareVideo1', { isStartHere: true }));
    changed.push(item('spareVideo2'));
    const defaults = defaultVideos(changed);
    const fallbacks = fallbackVideos(changed);
    expect(defaults).toHaveLength(8);
    expect(fallbacks).toHaveLength(8);
    expect(
      new Set([...defaults, ...fallbacks].map((row) => row.item.youtubeId))
        .size,
    ).toBe(16);
    expect(defaults[7].item.youtubeId).toBe('spareVideo1');
    expect(fallbacks[7].item.youtubeId).toBe('spareVideo2');
  });

  it('borrows only when needed in a small catalog, without inventing metadata', () => {
    const shared = item(DEFAULT_VIDEO_IDS[0], {
      title: 'Updated public title',
      durationSeconds: 476,
    });
    expect(fallbackVideos([shared])).toEqual([
      {
        item: shared,
        matchType: 'fallback',
        reason: 'A general suggestion for exploring the library.',
      },
    ]);
    expect(defaultVideos([])).toEqual([]);
    expect(fallbackVideos([])).toEqual([]);
  });
});
