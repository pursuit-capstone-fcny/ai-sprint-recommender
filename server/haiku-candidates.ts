import type { PublicCatalog } from '../src/contracts/publicCatalog';
import type { RecommendationRequest } from '../src/contracts/recommendation';
import { taskRelevance } from '../src/engine/relevance';
import { normalizeText } from '../src/engine/vocabulary';

const CANDIDATE_LIMIT = 48;

// Test-only retrieval. Preserve source order inside the shortlist; providerBody
// builds the numeric schema and trusted ID map from the same selected items.
export function haikuCandidates(
  items: PublicCatalog['items'],
  input: RecommendationRequest,
): PublicCatalog['items'] {
  if (items.length <= CANDIDATE_LIMIT || !input.goal.trim()) return items;
  const scores = taskRelevance(items, normalizeText(input.goal));
  if (![...scores.values()].some((score) => score > 0)) return items;
  const areaMatch = (index: number) =>
    Number(
      input.functionArea !== null &&
        items[index].functionAreas.includes(input.functionArea),
    );
  const selected = new Set(
    items
      .map((_, index) => index)
      .sort(
        (a, b) =>
          (scores.get(items[b].youtubeId) ?? 0) -
            (scores.get(items[a].youtubeId) ?? 0) ||
          areaMatch(b) - areaMatch(a) ||
          a - b,
      )
      .slice(0, CANDIDATE_LIMIT),
  );
  return items.filter((_, index) => selected.has(index));
}
