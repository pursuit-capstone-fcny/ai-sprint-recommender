import type { PublicCatalog } from '../contracts/publicCatalog';
import { normalizeTerm } from '../contracts/publicCatalog';
import { language } from '../engine/promptConfig/language';
import { canonicalTaskName } from '../contracts/taskVocabulary';

const vocabulary = language.tasks.map((rule) => rule.task);

// Private matching projection only. Never publish it, send it to Haiku, or use
// its fields on a card. The original catalog version still identifies the source.
export function deterministicCatalog(catalog: PublicCatalog): PublicCatalog {
  const taskName = canonicalTaskName;
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
