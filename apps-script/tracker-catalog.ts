import { buildPublicCatalog, headers, type Workbook } from './catalog';
import { catalogVersion } from './catalog-sheet';
import { canonicalJson, catalogDataJson } from '../src/library/catalog';
import {
  InstructionFormSchema,
  type PublicCatalog,
} from '../src/contracts/publicCatalog';

export const TRACKER_TAB = 'Video Tracker';
export const TRACKER_HEADER_ROW = 4;
export const trackerColumns = [
  'Video Title',
  'Description',
  'YouTube Link',
  'Primary Category (Web)',
  'Category 2',
  'Tool',
  'Status',
  'Task keywords',
  'Metadata status',
  'Instruction format',
] as const;
export type TrackerColumn = (typeof trackerColumns)[number];
export type TrackerProblem = { row: number; field: string; reason: string };
export type TrackerRow = { row: number; cells: Record<TrackerColumn, unknown> };

const areas: Record<string, string[]> = {
  'AI Implementation': ['Leadership'],
  'Custom Tools & Automation': ['Operations'],
  'Program & Client Services': ['Programs & Client Services'],
  'Data, Analysis & Operations': ['Operations'],
  'Writing & Communications': ['Communications'],
  'Fundraising & Philanthropy': ['Fundraising'],
  'Getting Started': [],
  'Leadership & Management': ['Leadership'],
};
const webAreas: Record<string, string> = {
  Leadership: 'AI Implementation',
  Operations: 'Data, Analysis & Operations',
  'Programs & Client Services': 'Program & Client Services',
  Communications: 'Writing & Communications',
  Fundraising: 'Fundraising & Philanthropy',
};
export const publishedTrackerStatus = (value: unknown) =>
  ['Live on Web + YouTube', 'Live on YouTube'].includes(String(value).trim());
const list = (value: unknown) =>
  typeof value === 'string'
    ? [
        ...new Set(
          value
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean),
        ),
      ]
    : [];
export function youtubeId(value: unknown): string | undefined {
  if (typeof value !== 'string') return;
  const link = value.trim();
  return (
    link.match(
      /^https:\/\/youtu\.be\/([A-Za-z0-9_-]{11})(?:[?#][^\s]*)?$/,
    )?.[1] ??
    (/^https:\/\/(?:www\.)?youtube\.com\/watch\?[^\s]+$/.test(link)
      ? link.match(/[?&]v=([A-Za-z0-9_-]{11})(?:[&#]|$)/)?.[1]
      : undefined)
  );
}
export function trackerAreas(primary: unknown, secondary: unknown): string[] {
  return [
    ...new Set(
      [primary, secondary].flatMap((value) => {
        const term = typeof value === 'string' ? value.trim() : '';
        return term ? (areas[term] ?? [term]) : [];
      }),
    ),
  ];
}

// The tracker is the only per-video source. The last published snapshot retains
// vocabulary, mappings, optional metadata and ordering, never stale task tags.
export function buildTrackerCatalog(
  rows: TrackerRow[],
  baseline: PublicCatalog,
) {
  const problems: TrackerProblem[] = [];
  const byId = new Map(baseline.items.map((item) => [item.youtubeId, item]));
  const entries: unknown[][] = [];
  const sourceRows = new Map<unknown[], number>();
  const instructionForms = new Map<
    string,
    NonNullable<PublicCatalog['items'][number]['instructionForm']>
  >();
  const seen = new Set<string>();
  for (const { row, cells } of rows) {
    if (!publishedTrackerStatus(cells.Status)) continue;
    const problem = (field: string, reason: string) =>
      problems.push({ row, field, reason });
    const id = youtubeId(cells['YouTube Link']);
    if (!id) problem('YouTube Link', 'Expected a public YouTube video link');
    else if (seen.has(id)) problem('YouTube Link', 'Duplicate video ID');
    if (id) seen.add(id);
    if (cells['Metadata status'] !== 'Ready')
      problem(
        'Metadata status',
        'Review this published video and mark it Ready',
      );
    for (const name of [
      'Video Title',
      'Description',
      'Task keywords',
    ] as const) {
      if (typeof cells[name] !== 'string' || !cells[name].trim())
        problem(name, 'Expected reviewed nonblank text');
    }
    if (cells.Tool != null && typeof cells.Tool !== 'string')
      problem('Tool', 'Expected comma-separated tool names');
    const previous = id ? byId.get(id) : undefined;
    const tasks = list(cells['Task keywords']);
    const form = cells['Instruction format'];
    if (form) {
      const parsed = InstructionFormSchema.safeParse(form);
      if (!parsed.success)
        problem(
          'Instruction format',
          'Choose demonstrated, walkthrough, explained or mentioned',
        );
      else if (id) instructionForms.set(id, parsed.data);
    } else if (
      !previous ||
      previous.instructionForm ||
      tasks.some((task) => !previous.tasks.includes(task))
    ) {
      problem(
        'Instruction format',
        'Review the instructional evidence for this new or retagged video',
      );
    }
    const entry = [
      id ?? '',
      cells['Video Title'],
      cells.Description,
      trackerAreas(cells['Primary Category (Web)'], cells['Category 2']).join(
        ', ',
      ),
      tasks.join(', '),
      list(cells.Tool).join(', '),
      previous?.addedAt ?? '',
      previous?.lengthSeconds ?? '',
      'active',
      previous?.startHere ?? false,
    ];
    entries.push(entry);
    sourceRows.set(entry, row);
  }
  const order = new Map(
    baseline.items.map((item, index) => [item.youtubeId, index]),
  );
  entries.sort((a, b) => {
    const ai = order.get(String(a[0])),
      bi = order.get(String(b[0]));
    return ai !== undefined || bi !== undefined
      ? (ai ?? Infinity) - (bi ?? Infinity)
      : String(a[0]).localeCompare(String(b[0]), 'en');
  });
  const dictionary: [string, string][] = [];
  for (const [category, key, column] of [
    ['functionArea', 'functionAreas', 3],
    ['tool', 'tools', 5],
    ['task', 'tasks', 4],
  ] as const) {
    const terms = new Set(baseline[key]);
    entries.forEach((entry) =>
      list(entry[column]).forEach((term) => terms.add(term)),
    );
    terms.forEach((term) => dictionary.push([category, term]));
  }
  const workbook: Workbook = {
    Catalog: [[...headers.Catalog], ...entries],
    Dictionary: [[...headers.Dictionary], ...dictionary],
    Synonyms: [
      [...headers.Synonyms],
      ...baseline.synonyms.map((s) => [s.alias, s.category, s.target]),
    ],
    'Adjacent tools': [
      [...headers['Adjacent tools']],
      ...baseline.adjacentTools.map((a) => [a.source, a.related, a.task]),
    ],
  };
  const result = buildPublicCatalog(workbook, catalogVersion);
  problems.push(
    ...result.problems.map((p) => ({
      row:
        p.tab === 'Catalog'
          ? (sourceRows.get(entries[p.row - 2]) ?? TRACKER_HEADER_ROW)
          : TRACKER_HEADER_ROW,
      field:
        p.tab === 'Dictionary' ? 'Task keywords / Tool / Category' : p.field,
      reason: p.reason,
    })),
  );
  const catalog = problems.length ? null : result.catalog;
  if (catalog) {
    for (const item of catalog.items) {
      const form = instructionForms.get(item.youtubeId);
      if (form) item.instructionForm = form;
    }
    catalog.catalogVersion = catalogVersion(catalogDataJson(catalog));
  }
  return { catalog, problems };
}

export function trackerChanges(
  baseline: PublicCatalog,
  candidate: PublicCatalog,
) {
  const before = new Map(baseline.items.map((item) => [item.youtubeId, item]));
  const after = new Map(candidate.items.map((item) => [item.youtubeId, item]));
  const label = (item: PublicCatalog['items'][number]) => ({
    youtubeId: item.youtubeId,
    title: item.title,
  });
  return {
    added: candidate.items
      .filter((item) => !before.has(item.youtubeId))
      .map(label),
    edited: candidate.items
      .filter(
        (item) =>
          before.has(item.youtubeId) &&
          canonicalJson(before.get(item.youtubeId)) !== canonicalJson(item),
      )
      .map(label),
    retired: baseline.items
      .filter((item) => !after.has(item.youtubeId))
      .map(label),
  };
}

// One-time migration, fully validated before any Sheet writes. A unique title
// resolves old rich-link cells and known incorrect links; ambiguity blocks setup.
export function planTrackerMigration(
  rows: TrackerRow[],
  baseline: PublicCatalog,
) {
  if (
    rows.some(
      ({ cells }) =>
        cells['Task keywords'] ||
        cells['Metadata status'] ||
        cells['Instruction format'],
    )
  )
    throw new Error(
      'Tracker metadata already exists. Setup never overwrites it.',
    );
  const used = new Set<string>();
  const updates: { row: number; field: TrackerColumn; value: string }[] = [];
  const migrated = rows.map(({ row, cells }) => {
    if (!publishedTrackerStatus(cells.Status)) return { row, cells };
    const title = String(cells['Video Title'] ?? '').trim();
    const matches = baseline.items.filter((item) => item.title === title);
    const item =
      matches.length === 1
        ? matches[0]
        : baseline.items.find(
            (item) => item.youtubeId === youtubeId(cells['YouTube Link']),
          );
    if (!item || matches.length > 1 || used.has(item.youtubeId))
      throw new Error(
        `Video Tracker row ${row}: cannot identify a unique published video.`,
      );
    used.add(item.youtubeId);
    if (item.functionAreas.length > 2)
      throw new Error(
        `Video Tracker row ${row}: more than two function areas need reconciliation.`,
      );
    const next = { ...cells };
    const set = (field: TrackerColumn, value: string) => {
      if (String(next[field] ?? '') !== value)
        updates.push({ row, field, value });
      next[field] = value;
    };
    set('Video Title', item.title);
    set('Description', item.description);
    set('YouTube Link', `https://youtu.be/${item.youtubeId}`);
    if (
      canonicalJson(
        trackerAreas(cells['Primary Category (Web)'], cells['Category 2']),
      ) !== canonicalJson(item.functionAreas)
    ) {
      set(
        'Primary Category (Web)',
        webAreas[item.functionAreas[0]] ?? item.functionAreas[0] ?? '',
      );
      set(
        'Category 2',
        webAreas[item.functionAreas[1]] ?? item.functionAreas[1] ?? '',
      );
    }
    set('Tool', item.tools.join(', '));
    set('Task keywords', item.tasks.join(', '));
    set('Metadata status', 'Ready');
    set('Instruction format', item.instructionForm ?? '');
    return { row, cells: next };
  });
  const result = buildTrackerCatalog(migrated, baseline);
  if (
    !result.catalog ||
    canonicalJson(result.catalog) !== canonicalJson(baseline)
  )
    throw new Error(
      'Migration does not reproduce the complete published catalog. Nothing was written.',
    );
  return { updates, catalog: result.catalog };
}
