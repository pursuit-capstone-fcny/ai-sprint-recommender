import type { CatalogItem } from '../contracts/catalogItem';
import { expandSynonyms, normalizeText } from './vocabulary';

// Count each goal concept once, including aliases. A term shared by most of
// the catalog contributes less than a term that distinguishes a few videos.
// A title or canonical task adds one extra vote: it identifies the video's
// subject, while a description can mention a task only in passing. Repetition
// within a field never adds votes. No benchmark or profile IDs are consulted.
export function taskRelevance(
  catalog: CatalogItem[],
  goalWords: string[],
): Map<string, number> {
  const concepts = new Map<string, string[]>();
  for (const word of goalWords) {
    const aliases = expandSynonyms(word);
    if (aliases.length) concepts.set([...aliases].sort().join('|'), aliases);
  }
  const documents = catalog.map((item) => ({
    id: item.youtubeId,
    labels: new Set(normalizeText(`${item.title} ${item.tasks.join(' ')}`)),
    words: new Set(
      normalizeText(
        `${item.title} ${item.description} ${item.tasks.join(' ')}`,
      ),
    ),
  }));
  const scores = new Map(documents.map(({ id }) => [id, 0]));
  for (const aliases of concepts.values()) {
    const matched = documents.filter(({ words }) =>
      aliases.some((word) => words.has(word)),
    );
    const weight = 1 + Math.log((documents.length + 1) / (matched.length + 1));
    for (const { id, labels } of matched)
      scores.set(
        id,
        (scores.get(id) ?? 0) +
          weight * (aliases.some((word) => labels.has(word)) ? 2 : 1),
      );
  }
  return new Map(
    [...scores].map(([id, score]) => [
      id,
      Math.round(score * 1_000_000) / 1_000_000,
    ]),
  );
}
