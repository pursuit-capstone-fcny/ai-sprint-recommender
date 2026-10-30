import {
  DashboardSnapshotSchema,
  type DashboardFact,
} from '../src/admin/snapshot';
const zero = {
  appearances: 0,
  embedClicks: 0,
  youtubeClicks: 0,
  directViews: 0,
  directEmbedClicks: 0,
  directYoutubeClicks: 0,
  searches: 0,
};
const topics = [
  'Grant reporting',
  'Budget planning',
  'Volunteer scheduling',
  'Board updates',
  'Community outreach',
  'Research summaries',
  'Meeting preparation',
  'Document review',
];
const facts: DashboardFact[] = [];
for (let n = 0; n < 38; n++) {
  const youtubeId = `demo${String(n).padStart(7, '0')}`,
    title = `${topics[n % topics.length]} · Example ${n + 1}`;
  const base = {
    activeInventory: true,
    entity: 'video' as const,
    dateKey: 0,
    source: '' as const,
    mode: '' as const,
    youtubeId,
    title,
    category: '' as const,
    tag: '',
    ...zero,
  };
  facts.push(base);
  if (n % 4 !== 0)
    facts.push({
      ...base,
      dateKey: 20261028,
      source: 'website',
      mode: 'recommendations',
      appearances: 40 - n,
      embedClicks: n % 3 === 0 ? 0 : 7,
      youtubeClicks: n % 3 === 0 ? 0 : 2,
    });
  if (n % 4 !== 0)
    facts.push({
      ...base,
      entity: 'association',
      category: 'tool',
      tag: 'ChatGPT',
      dateKey: 20261028,
      source: 'website',
      mode: 'recommendations',
      appearances: 40 - n,
      embedClicks: n % 3 === 0 ? 0 : 7,
      youtubeClicks: n % 3 === 0 ? 0 : 2,
    });
}
for (const [tag, searches, appearances] of [
  ['ChatGPT', 24, 120],
  ['Claude', 0, 0],
  ['Excel', 8, 32],
  ['Sheets', 3, 18],
] as const) {
  const base = {
    activeInventory: true,
    entity: 'tag' as const,
    dateKey: 0,
    source: '' as const,
    mode: '' as const,
    youtubeId: '',
    title: '',
    category: 'tool' as const,
    tag,
    ...zero,
  };
  facts.push(base);
  if (appearances)
    facts.push({
      ...base,
      dateKey: 20261028,
      source: 'website',
      mode: 'recommendations',
      searches,
      appearances,
      embedClicks: 9,
    });
}
export const dashboardDemo = DashboardSnapshotSchema.parse({
  state: 'ready',
  refreshedAt: '2026-10-29T12:00:00Z',
  staleAt: '2026-10-30T14:00:00Z',
  generationId: 'synthetic-demo',
  startDate: '2026-10-01',
  endDate: '2026-10-29',
  retainedFrom: '2026-10-28T12:00:00Z',
  retainedThrough: '2026-10-28T13:00:00Z',
  environment: 'test',
  unmappedEvents: 0,
  unattributedEvents: 0,
  facts,
});
