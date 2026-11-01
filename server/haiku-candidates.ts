import { methodNeighbors } from './haiku-method-neighbors';
import type { PublicCatalog } from '../src/contracts/publicCatalog';
import type { RecommendationRequest } from '../src/contracts/recommendation';
import { taskRelevance } from '../src/engine/relevance';
import { normalizeText } from '../src/engine/vocabulary';

const CANDIDATE_LIMIT = 48;

// Test-only retrieval. Keep selected-area coverage for unfamiliar paraphrases,
// then add related methods without removing any original candidate.
// Source order and all metadata stay unchanged.
export function haikuCandidates(
  items: PublicCatalog['items'],
  input: RecommendationRequest,
): PublicCatalog['items'] {
  if (items.length <= CANDIDATE_LIMIT || !input.goal.trim()) return items;
  const scores = taskRelevance(items, normalizeText(input.goal));
  if (![...scores.values()].some((score) => score > 0)) return items;
  const selected = new Set(
    items.flatMap((item, index) =>
      input.functionArea !== null &&
      item.functionAreas.includes(input.functionArea)
        ? [index]
        : [],
    ),
  );
  // Do not turn a large function area into an exclusive filter.
  if (selected.size >= CANDIDATE_LIMIT) return items;
  const ranked = items
    .map((_, index) => index)
    .sort(
      (a, b) =>
        (scores.get(items[b].youtubeId) ?? 0) -
          (scores.get(items[a].youtubeId) ?? 0) || a - b,
    );
  for (const index of ranked) {
    if (selected.size >= CANDIDATE_LIMIT) break;
    selected.add(index);
  }
  const strongest = scores.get(items[ranked[0]].youtubeId)!;
  const anchors = ranked
    .slice(0, 8)
    .filter((index) => (scores.get(items[index].youtubeId) ?? 0) > 0)
    .map((index) => ({
      index,
      weight: scores.get(items[index].youtubeId)! / strongest,
    }));
  const related = methodNeighbors(items, anchors);
  const supportOrder = [...ranked].sort(
    (a, b) => related[b] - related[a] || ranked.indexOf(a) - ranked.indexOf(b),
  );
  for (const index of supportOrder) {
    if (selected.size >= CANDIDATE_LIMIT + 12) break;
    if (related[index] >= 0.1) selected.add(index);
  }
  return items.filter((_, index) => selected.has(index));
}
