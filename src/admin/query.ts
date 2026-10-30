import { z } from 'zod';
import type { DashboardFact } from './snapshot';
export const DashboardFiltersSchema = z
  .strictObject({
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    source: z.enum([
      'all',
      'website',
      'email',
      'session',
      'pilot',
      'team',
      'other',
    ]),
    mode: z.enum(['all', 'recommendations', 'topic', 'direct']),
    includeTeam: z.boolean(),
    includeHistorical: z.boolean(),
    query: z.string().max(200),
    category: z.enum(['all', 'functionArea', 'tool', 'task']),
    tag: z.string().max(50_000),
    activity: z.enum(['all', 'zero-appearances', 'no-clicks', 'zero-searches']),
  })
  .refine((f) => f.startDate <= f.endDate, {
    message: 'Start date must be on or before end date.',
  });
export type DashboardFilters = z.infer<typeof DashboardFiltersSchema>;
export type DashboardRow = {
  key: string;
  youtubeId: string;
  title: string;
  category: string;
  tag: string;
  active: boolean;
  appearances: number;
  embedClicks: number;
  youtubeClicks: number;
  directViews: number;
  directEmbedClicks: number;
  directYoutubeClicks: number;
  searches: number;
};
export type DashboardView = 'video' | 'tag' | 'association';
export const categoryName = (value: string) =>
  ({ functionArea: 'Function area', tool: 'Tool', task: 'Task' })[value] ??
  value;
export function queryDashboard(
  facts: DashboardFact[],
  view: DashboardView,
  input: DashboardFilters,
): DashboardRow[] {
  const f = DashboardFiltersSchema.parse(input),
    start = Number(f.startDate.replaceAll('-', '')),
    end = Number(f.endDate.replaceAll('-', ''));
  const rows = new Map<string, DashboardRow>();
  for (const fact of facts) {
    if (fact.entity !== view || (!f.includeHistorical && !fact.activeInventory))
      continue;
    if (
      view !== 'video' &&
      ((f.category !== 'all' && fact.category !== f.category) ||
        (f.tag && fact.tag !== f.tag))
    )
      continue;
    if (
      f.query &&
      !`${fact.title} ${fact.youtubeId} ${fact.tag}`
        .toLocaleLowerCase()
        .includes(f.query.trim().toLocaleLowerCase())
    )
      continue;
    const key = JSON.stringify([fact.youtubeId, fact.category, fact.tag]);
    if (!rows.has(key))
      rows.set(key, {
        key,
        youtubeId: fact.youtubeId,
        title: fact.title,
        category: fact.category,
        tag: fact.tag,
        active: fact.activeInventory,
        appearances: 0,
        embedClicks: 0,
        youtubeClicks: 0,
        directViews: 0,
        directEmbedClicks: 0,
        directYoutubeClicks: 0,
        searches: 0,
      });
    if (
      fact.dateKey < start ||
      fact.dateKey > end ||
      (!f.includeTeam && fact.source === 'team') ||
      (f.source !== 'all' && fact.source !== f.source) ||
      (f.mode !== 'all' && fact.mode !== f.mode)
    )
      continue;
    const row = rows.get(key)!;
    for (const metric of [
      'appearances',
      'embedClicks',
      'youtubeClicks',
      'directViews',
      'directEmbedClicks',
      'directYoutubeClicks',
      'searches',
    ] as const)
      row[metric] += fact[metric];
  }
  return [...rows.values()].filter(
    (row) =>
      f.activity === 'all' ||
      (f.activity === 'zero-appearances' && row.appearances === 0) ||
      (f.activity === 'no-clicks' &&
        row.appearances > 0 &&
        row.embedClicks + row.youtubeClicks === 0) ||
      (f.activity === 'zero-searches' && view === 'tag' && row.searches === 0),
  );
}
