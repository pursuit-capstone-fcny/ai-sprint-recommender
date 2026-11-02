import type { CatalogItem } from '../contracts/catalogItem';
import type { RankedMatch } from '../contracts/rankedMatch';
import { eligibleCatalog } from './resultPolicy';

const MAX_FALLBACK_VIDEOS = 6;

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// General library browsing, independent of either engine's matching signals.
export function fallbackVideos(catalog: CatalogItem[]): RankedMatch[] {
  return eligibleCatalog(catalog)
    .sort(
      (a, b) =>
        Number(b.isStartHere) - Number(a.isStartHere) ||
        compareText(b.addedAt ?? '', a.addedAt ?? '') ||
        compareText(a.youtubeId, b.youtubeId),
    )
    .slice(0, MAX_FALLBACK_VIDEOS)
    .map((item) => ({
      item,
      matchType: 'fallback',
      reason: item.isStartHere
        ? 'Marked Start here by the library.'
        : 'A general suggestion for exploring the library.',
    }));
}
