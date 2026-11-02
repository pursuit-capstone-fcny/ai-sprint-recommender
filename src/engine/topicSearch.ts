import { toCatalogItem } from '../contracts/catalogItem';
import {
  categoryKeys,
  normalizeTerm,
  type PublicCatalog,
  type PublicCatalogItem,
  type TagCategory,
} from '../contracts/publicCatalog';
import type { RankedMatch } from '../contracts/rankedMatch';
import { languageTokens } from './promptLanguage';

export interface TopicQuery {
  topic: string;
  functionAreas: string[];
  tools: string[];
}
interface Concept {
  words: string[];
  category?: TagCategory;
  target?: string;
}
const ordinal = (a: string, b: string) => (a === b ? 0 : a < b ? -1 : 1);
const contains = (words: string[], phrase: string[]) =>
  phrase.length > 0 &&
  words.some((_, i) => phrase.every((word, j) => words[i + j] === word));

// Exactly one insertion, deletion or substitution, for long words only.
function oneEdit(a: string, b: string) {
  if (Math.min(a.length, b.length) < 5 || Math.abs(a.length - b.length) > 1)
    return false;
  let i = 0,
    j = 0,
    edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length >= b.length) i++;
    if (b.length >= a.length) j++;
  }
  return edits + Number(i < a.length || j < b.length) === 1;
}
function concepts(catalog: PublicCatalog, topic: string): Concept[] {
  const words = languageTokens(topic);
  const aliases = catalog.synonyms
    .filter((row) => catalog[categoryKeys[row.category]].includes(row.target))
    .map((row) => ({ ...row, words: languageTokens(row.alias) }))
    .filter((row) => row.words.length)
    .sort(
      (a, b) => b.words.length - a.words.length || ordinal(a.alias, b.alias),
    );
  const result: Concept[] = [];
  for (let i = 0; i < words.length;) {
    const alias = aliases.find((row) =>
      row.words.every((word, j) => words[i + j] === word),
    );
    if (alias) {
      result.push(alias);
      i += alias.words.length;
    } else {
      result.push({ words: [words[i]] });
      i++;
    }
  }
  return result;
}
function score(item: PublicCatalogItem, concept: Concept): number {
  const fields = [
    item.title,
    ...item.tasks,
    ...item.tools,
    ...item.functionAreas,
    item.description,
  ].map(languageTokens);
  const exact = fields.findIndex((field) => contains(field, concept.words));
  if (exact >= 0)
    return exact === 0 ? 12 : exact === fields.length - 1 ? 6 : 10;
  if (
    concept.category &&
    concept.target &&
    item[categoryKeys[concept.category]].includes(concept.target)
  )
    return 5;
  if (
    concept.words.length === 1 &&
    fields.some((field) =>
      field.some((word) => oneEdit(concept.words[0], word)),
    )
  )
    return 1;
  return 0;
}
/** Topic browsing deliberately bypasses task interpretation, dedupe and recommendation filling. */
export function searchTopics(
  catalog: PublicCatalog,
  query: TopicQuery,
): RankedMatch[] {
  const terms = concepts(catalog, query.topic);
  // A nonblank punctuation-only query is a miss, not a browse-all request.
  if (query.topic.trim() && !terms.length) return [];
  const counts = new Map<string, number>();
  for (const item of catalog.items)
    counts.set(item.youtubeId, (counts.get(item.youtubeId) ?? 0) + 1);
  return catalog.items
    .filter(
      (item) =>
        item.status === 'active' &&
        counts.get(item.youtubeId) === 1 &&
        (!query.functionAreas.length ||
          query.functionAreas.some((area) =>
            item.functionAreas.includes(area),
          )) &&
        (!query.tools.length ||
          query.tools.some((tool) => item.tools.includes(tool))),
    )
    .flatMap((item) => {
      const scores = terms.map((term) => score(item, term));
      if (scores.some((value) => !value)) return [];
      const phrase = normalizeTerm(query.topic);
      const exactTitle =
        phrase && normalizeTerm(item.title) === phrase ? 100 : 0;
      return [
        {
          item,
          score: scores.reduce((sum, value) => sum + value, 0) + exactTitle,
        },
      ];
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        ordinal(normalizeTerm(a.item.title), normalizeTerm(b.item.title)) ||
        ordinal(a.item.youtubeId, b.item.youtubeId),
    )
    .map(({ item }) => ({
      item: toCatalogItem(item),
      matchType: 'strong',
      reason: query.topic.trim()
        ? 'Matches the topic in its title, description or catalog tags.'
        : 'In the active library.',
    }));
}

/** Return dictionary values only. Original topic wording never enters usage events. */
export function topicKeywords(
  catalog: PublicCatalog,
  topic: string,
  category: TagCategory,
) {
  const words = languageTokens(topic);
  const aliases = concepts(catalog, topic)
    .filter((term) => term.category === category)
    .map((term) => term.target);
  return catalog[categoryKeys[category]]
    .filter(
      (tag) => aliases.includes(tag) || contains(words, languageTokens(tag)),
    )
    .slice(0, 50);
}
