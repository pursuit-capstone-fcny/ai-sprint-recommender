import {
  categoryKeys,
  normalizeTerm,
  parsePublicCatalog,
  PublicCatalogItemSchema,
  TagCategorySchema,
  type PublicCatalog,
  type PublicCatalogData,
  type TagCategory,
} from '../src/contracts/publicCatalog';

export const headers = {
  Catalog: [
    'youtubeId',
    'title',
    'description',
    'functionAreas',
    'tasks',
    'tools',
    'addedAt',
    'lengthSeconds',
    'status',
    'startHere',
  ],
  Dictionary: ['category', 'value'],
  Synonyms: ['alias', 'category', 'target'],
  'Adjacent tools': ['source', 'related', 'task'],
} as const;

export type Tab = keyof typeof headers;
export type Workbook = Record<Tab, unknown[][]>;
export type Problem = { tab: Tab; row: number; field: string; reason: string };
type Row = { number: number; cells: Record<string, unknown> };
type Dictionary = Pick<PublicCatalogData, 'functionAreas' | 'tools' | 'tasks'>;
const trimmed = (value: unknown) =>
  typeof value === 'string' ? value.trim() : value;
const blank = (value: unknown) => value === '' || value == null;

function readRows(tab: Tab, grid: unknown[][], problems: Problem[]): Row[] {
  const headings = (grid[0] ?? []).map(trimmed);
  const missing = headers[tab].filter(
    (header) => headings.filter((value) => value === header).length !== 1,
  );
  for (const field of missing) {
    problems.push({
      tab,
      row: 1,
      field,
      reason: 'Required header missing or duplicated',
    });
  }
  if (missing.length) return [];
  return grid.slice(1).flatMap((values, index) => {
    // Ignore all private columns, including their names, before validation.
    const cells = Object.fromEntries(
      headers[tab].map((header) => [
        header,
        trimmed(values[headings.indexOf(header)]),
      ]),
    );
    return Object.values(cells).every(blank)
      ? []
      : [{ number: index + 2, cells }];
  });
}

function readDictionary(rows: Row[], problems: Problem[]): Dictionary {
  const result: Dictionary = { functionAreas: [], tools: [], tasks: [] };
  const candidates: { category: TagCategory; value: string; row: number }[] =
    [];
  for (const { cells, number } of rows) {
    const category = TagCategorySchema.safeParse(cells.category);
    if (!category.success) {
      problems.push({
        tab: 'Dictionary',
        row: number,
        field: 'category',
        reason: 'Unknown category',
      });
    } else if (
      typeof cells.value !== 'string' ||
      !normalizeTerm(cells.value) ||
      cells.value.includes(',')
    ) {
      problems.push({
        tab: 'Dictionary',
        row: number,
        field: 'value',
        reason: 'Expected a canonical tag without commas',
      });
    } else {
      candidates.push({
        category: category.data,
        value: cells.value,
        row: number,
      });
    }
  }
  for (const entry of candidates) {
    const same = candidates.filter(
      (other) =>
        other.category === entry.category &&
        normalizeTerm(other.value) === normalizeTerm(entry.value),
    );
    if (new Set(same.map((other) => other.value)).size > 1) {
      problems.push({
        tab: 'Dictionary',
        row: entry.row,
        field: 'value',
        reason: 'Conflicting canonical spelling',
      });
      continue;
    }
    const values = result[categoryKeys[entry.category]];
    if (!values.includes(entry.value)) values.push(entry.value);
  }
  return result;
}

function canonical(value: unknown, values: string[]): string | undefined {
  if (typeof value !== 'string') return undefined;
  return values.find(
    (candidate) => normalizeTerm(candidate) === normalizeTerm(value),
  );
}

function readSynonyms(
  rows: Row[],
  dictionary: Dictionary,
  problems: Problem[],
): PublicCatalogData['synonyms'] {
  const candidates: (PublicCatalogData['synonyms'][number] & {
    row: number;
  })[] = [];
  for (const { cells, number } of rows) {
    const category = TagCategorySchema.safeParse(cells.category);
    const target = category.success
      ? canonical(cells.target, dictionary[categoryKeys[category.data]])
      : undefined;
    if (
      !category.success ||
      !target ||
      typeof cells.alias !== 'string' ||
      !normalizeTerm(cells.alias)
    ) {
      problems.push({
        tab: 'Synonyms',
        row: number,
        field: 'mapping',
        reason: 'Expected an alias, category and canonical target',
      });
      continue;
    }
    candidates.push({
      alias: normalizeTerm(cells.alias),
      category: category.data,
      target,
      row: number,
    });
  }
  const output: PublicCatalogData['synonyms'] = [];
  for (const entry of candidates) {
    const peers = candidates.filter(
      (other) =>
        other.category === entry.category && other.alias === entry.alias,
    );
    const existing = canonical(
      entry.alias,
      dictionary[categoryKeys[entry.category]],
    );
    if (
      new Set(peers.map((other) => other.target)).size > 1 ||
      (existing && existing !== entry.target)
    ) {
      problems.push({
        tab: 'Synonyms',
        row: entry.row,
        field: 'alias',
        reason: 'Conflicting alias target',
      });
      continue;
    }
    if (
      !output.some(
        (other) =>
          other.category === entry.category && other.alias === entry.alias,
      )
    ) {
      output.push({
        alias: entry.alias,
        category: entry.category,
        target: entry.target,
      });
    }
  }
  return output;
}

function readAdjacent(
  rows: Row[],
  dictionary: Dictionary,
  problems: Problem[],
): PublicCatalogData['adjacentTools'] {
  const output: PublicCatalogData['adjacentTools'] = [];
  for (const { cells, number } of rows) {
    const source = canonical(cells.source, dictionary.tools);
    const related = canonical(cells.related, dictionary.tools);
    const task = canonical(cells.task, dictionary.tasks);
    if (!source || !related || !task || source === related) {
      problems.push({
        tab: 'Adjacent tools',
        row: number,
        field: 'mapping',
        reason: 'Expected two distinct canonical tools and a canonical task',
      });
      continue;
    }
    if (
      !output.some(
        (entry) =>
          entry.source === source &&
          entry.related === related &&
          entry.task === task,
      )
    ) {
      output.push({ source, related, task });
    }
  }
  return output;
}

function readItems(rows: Row[], dictionary: Dictionary, problems: Problem[]) {
  const counts = new Map<unknown, number>();
  rows.forEach(({ cells }) => {
    if (!blank(cells.youtubeId))
      counts.set(cells.youtubeId, (counts.get(cells.youtubeId) ?? 0) + 1);
  });
  return rows.flatMap(({ cells, number }) => {
    const candidate = { ...cells };
    for (const key of Object.values(categoryKeys)) {
      const value = cells[key];
      candidate[key] = blank(value)
        ? []
        : typeof value === 'string'
          ? [
              ...new Set(
                value
                  .split(',')
                  .map(
                    (tag) =>
                      canonical(tag.trim(), dictionary[key]) ?? tag.trim(),
                  ),
              ),
            ]
          : value;
    }
    candidate.addedAt = blank(cells.addedAt) ? null : cells.addedAt;
    candidate.lengthSeconds = blank(cells.lengthSeconds)
      ? null
      : cells.lengthSeconds;
    const parsed = PublicCatalogItemSchema.safeParse(candidate);
    const duplicate = (counts.get(cells.youtubeId) ?? 0) > 1;
    if (duplicate)
      problems.push({
        tab: 'Catalog',
        row: number,
        field: 'youtubeId',
        reason: 'Duplicate video ID; all copies excluded',
      });
    if (!parsed.success) {
      const fields = new Set(
        parsed.error.issues.map((issue) => String(issue.path[0])),
      );
      fields.forEach((field) =>
        problems.push({
          tab: 'Catalog',
          row: number,
          field,
          reason: 'Invalid field type or value',
        }),
      );
      return [];
    }
    let unknownTag = false;
    for (const key of Object.values(categoryKeys)) {
      if (parsed.data[key].some((tag) => !dictionary[key].includes(tag))) {
        unknownTag = true;
        problems.push({
          tab: 'Catalog',
          row: number,
          field: key,
          reason: 'Tag is not in the dictionary',
        });
      }
    }
    // Validate retired rows too so staff can repair them before reactivation.
    return duplicate || unknownTag || parsed.data.status !== 'active'
      ? []
      : [parsed.data];
  });
}

export function buildPublicCatalog(
  workbook: Workbook,
  version: (publicJson: string) => string,
): { catalog: PublicCatalog | null; problems: Problem[] } {
  const problems: Problem[] = [];
  const dictionary = readDictionary(
    readRows('Dictionary', workbook.Dictionary, problems),
    problems,
  );
  const items = readItems(
    readRows('Catalog', workbook.Catalog, problems),
    dictionary,
    problems,
  );
  const synonyms = readSynonyms(
    readRows('Synonyms', workbook.Synonyms, problems),
    dictionary,
    problems,
  );
  const adjacentTools = readAdjacent(
    readRows('Adjacent tools', workbook['Adjacent tools'], problems),
    dictionary,
    problems,
  );
  if (problems.some((problem) => problem.row === 1))
    return { catalog: null, problems };
  const data: PublicCatalogData = {
    schemaVersion: 1,
    items,
    ...dictionary,
    synonyms,
    adjacentTools,
  };
  const catalog = parsePublicCatalog({
    ...data,
    catalogVersion: version(JSON.stringify(data)),
  });
  return { catalog, problems };
}
