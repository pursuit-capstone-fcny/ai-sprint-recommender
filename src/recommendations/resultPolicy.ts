import type { CatalogItem } from '../contracts/catalogItem';
import type { RankedMatch } from '../contracts/rankedMatch';

export const MAX_RECOMMENDATIONS = 8;
export const MIN_RECOMMENDATIONS = 6;
// Retain the original ranking diversity window for top-three comparisons.
export const RECOMMENDATION_DIVERSITY_WINDOW = 3;

// Duplicate catalog IDs exclude every copy, including active/retired pairs.
export function eligibleCatalog(catalog: CatalogItem[]): CatalogItem[] {
  const counts = new Map<string, number>();
  for (const item of catalog)
    counts.set(item.youtubeId, (counts.get(item.youtubeId) ?? 0) + 1);
  return catalog.filter(
    (item) => item.status === 'active' && counts.get(item.youtubeId) === 1,
  );
}

export function applyResultPolicy(
  matches: RankedMatch[],
  fallbacks: RankedMatch[],
): RankedMatch[] {
  const results = matches.slice(0, MAX_RECOMMENDATIONS);
  const seen = new Set(results.map(({ item }) => item.youtubeId));
  for (const fallback of fallbacks) {
    if (results.length >= MIN_RECOMMENDATIONS) break;
    if (seen.has(fallback.item.youtubeId)) continue;
    seen.add(fallback.item.youtubeId);
    results.push(fallback);
  }
  return results;
}
