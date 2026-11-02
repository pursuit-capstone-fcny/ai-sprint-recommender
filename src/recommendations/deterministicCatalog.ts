import type { PublicCatalog } from '../contracts/publicCatalog';
import { normalizeTerm } from '../contracts/publicCatalog';
import { language } from '../engine/promptConfig/language';

// Sheet vocabulary -> #102 vocabulary. Only equivalent task names belong here;
// broad tags such as "content creation" must not imply a specific taught method.
const equivalents: Readonly<Record<string, string>> = {
  'ai basics': 'AI literacy',
  'ai policy drafting': 'AI policy',
  'grant application drafting': 'Grant drafting',
  'grant opportunity review': 'RFP review',
  'grantee assessment': 'Grant due diligence',
  'newsletter drafting': 'Newsletter writing',
  'copy editing': 'Editing proofreading',
  'email summarization': 'Email summary',
  'social media drafting': 'Social media writing',
  'job description drafting': 'Job description writing',
  'career framework design': 'Career frameworks',
  'case note drafting': 'Case notes',
  'client letter drafting': 'Client correspondence',
  'form creation': 'Form generation',
  'video scripting': 'Scriptwriting',
  'image creation': 'Image generation',
  'audio creation': 'Audio generation',
  'song creation': 'Music generation',
  'custom gpt setup': 'Custom assistants',
  'roleplay simulation': 'Role play',
  'interview practice': 'Interview preparation',
  'language practice': 'Language learning',
  'document querying': 'Document Q&A',
  'report drafting': 'Report generation',
  'curriculum development': 'Curriculum design',
};
const vocabulary = language.tasks.map((rule) => rule.task);
const canonical = new Map(
  vocabulary.map((task) => [normalizeTerm(task), task]),
);

// Private matching projection only. Never publish it, send it to Haiku, or use
// its fields on a card. The original catalog version still identifies the source.
export function deterministicCatalog(catalog: PublicCatalog): PublicCatalog {
  const taskName = (task: string) =>
    canonical.get(normalizeTerm(task)) ??
    equivalents[normalizeTerm(task)] ??
    task;
  if (!catalog.tasks.some((task) => taskName(task) !== task)) return catalog;
  const tasks = [...new Set([...catalog.tasks.map(taskName), ...vocabulary])];
  const synonyms = catalog.synonyms
    .map((row) =>
      row.category === 'task' ? { ...row, target: taskName(row.target) } : row,
    )
    .filter(
      (row) =>
        row.category !== 'task' ||
        !tasks.some(
          (task) =>
            normalizeTerm(task) === normalizeTerm(row.alias) &&
            task !== row.target,
        ),
    );
  const aliases = new Set(
    synonyms.map((row) => `${row.category}:${normalizeTerm(row.alias)}`),
  );
  for (const source of catalog.tasks) {
    const target = taskName(source);
    const key = `task:${normalizeTerm(source)}`;
    if (
      normalizeTerm(source) !== normalizeTerm(target) &&
      !aliases.has(key) &&
      !tasks.some((task) => normalizeTerm(task) === normalizeTerm(source))
    ) {
      aliases.add(key);
      synonyms.push({ alias: source, category: 'task', target });
    }
  }
  return {
    ...catalog,
    tasks,
    synonyms,
    adjacentTools: catalog.adjacentTools.map((row) => ({
      ...row,
      task: taskName(row.task),
    })),
    items: catalog.items.map((item) => ({
      ...item,
      tasks: [...new Set(item.tasks.map(taskName))],
    })),
  };
}
