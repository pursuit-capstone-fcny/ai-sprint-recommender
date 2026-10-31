import type { PublicCatalog } from '../src/contracts/publicCatalog';
import type { RecommendationRequest } from '../src/contracts/recommendation';
import { taskRelevance } from '../src/engine/relevance';
import { normalizeText } from '../src/engine/vocabulary';
import { haikuTaskScope } from './haiku-task-scope';

const CANDIDATE_LIMIT = 48;

// Test-only retrieval. Keep selected-area coverage for unfamiliar paraphrases,
// then add cross-area matches. Source order and all metadata stay unchanged.
export function haikuCandidates(
  allItems: PublicCatalog['items'],
  input: RecommendationRequest,
): PublicCatalog['items'] {
  const items = haikuTaskScope(allItems, input.goal);
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
  return items.filter((_, index) => selected.has(index));
}
