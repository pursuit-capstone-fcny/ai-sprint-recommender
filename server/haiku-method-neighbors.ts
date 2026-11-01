import type { PublicCatalog } from '../src/contracts/publicCatalog';
import { expandSynonyms, normalizeText } from '../src/engine/vocabulary';

// Compare public descriptions and task labels, never benchmark labels or IDs.
// Common catalog language contributes little; compatible methods can match even
// when the user's goal does not contain the method's vocabulary.
export function methodNeighbors(
  items: PublicCatalog['items'],
  anchors: { index: number; weight: number }[],
): number[] {
  const words = items.map(
    (item) =>
      new Set(
        normalizeText(
          `${item.title} ${item.description} ${item.tasks.join(' ')}`,
        ).filter(
          (word) => /[a-z]/.test(word) && expandSynonyms(word).length > 0,
        ),
      ),
  );
  const frequencies = new Map<string, number>();
  for (const document of words)
    for (const word of document)
      frequencies.set(word, (frequencies.get(word) ?? 0) + 1);
  const weights = new Map(
    [...frequencies].map(([word, count]) => [
      word,
      Math.log((items.length + 1) / (count + 1)) ** 2,
    ]),
  );
  const norms = words.map((document) =>
    Math.sqrt(
      [...document].reduce((sum, word) => sum + (weights.get(word) ?? 0), 0),
    ),
  );
  return words.map((document, index) =>
    Math.max(
      0,
      ...anchors.map((anchor) => {
        const denominator = norms[index] * norms[anchor.index];
        if (!denominator) return 0;
        const shared = [...document].reduce(
          (sum, word) =>
            sum +
            (words[anchor.index].has(word) ? (weights.get(word) ?? 0) : 0),
          0,
        );
        return (anchor.weight * shared) / denominator;
      }),
    ),
  );
}
