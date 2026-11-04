import { z } from 'zod';
import { PublicCatalogSchema } from '../contracts/publicCatalog';

export const TopicUsageConfigSchema = z.strictObject({
  url: z
    .string()
    .regex(/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/),
  retentionDays: z.number().int().min(1).max(365),
});
export type TopicUsageConfig = z.infer<typeof TopicUsageConfigSchema>;
const count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const factFields = [
  'activeInventory',
  'entity',
  'dateKey',
  'source',
  'mode',
  'youtubeId',
  'title',
  'category',
  'tag',
  'appearances',
  'embedClicks',
  'youtubeClicks',
  'directViews',
  'directEmbedClicks',
  'directYoutubeClicks',
  'searches',
] as const;
export const DashboardFactSchema = z
  .strictObject({
    activeInventory: z.boolean(),
    entity: z.enum(['video', 'tag', 'association']),
    dateKey: z.number().int(),
    source: z.enum([
      '',
      'website',
      'email',
      'session',
      'pilot',
      'team',
      'other',
    ]),
    mode: z.enum(['', 'recommendations', 'topic', 'direct']),
    youtubeId: z.string().max(11),
    title: z.string().max(50_000),
    category: z.enum(['', 'functionArea', 'tool', 'task']),
    tag: z.string().max(50_000),
    appearances: count,
    embedClicks: count,
    youtubeClicks: count,
    directViews: count,
    directEmbedClicks: count,
    directYoutubeClicks: count,
    searches: count,
  })
  .superRefine((f, ctx) => {
    const invalid = () =>
      ctx.addIssue({ code: 'custom', message: 'Invalid aggregate row' });
    if (
      f.entity === 'tag'
        ? f.youtubeId !== '' || f.title !== '' || !f.category || !f.tag
        : !/^[A-Za-z0-9_-]{11}$/.test(f.youtubeId) || !f.title
    )
      invalid();
    if (
      f.entity === 'video'
        ? Boolean(f.category || f.tag)
        : !f.category || !f.tag
    )
      invalid();
    if (f.dateKey === 0) {
      if (
        f.source ||
        f.mode ||
        f.entity === 'association' ||
        [
          f.appearances,
          f.embedClicks,
          f.youtubeClicks,
          f.directViews,
          f.directEmbedClicks,
          f.directYoutubeClicks,
          f.searches,
        ].some(Boolean)
      )
        invalid();
    } else {
      const d = String(f.dateKey);
      if (
        !/^\d{8}$/.test(d) ||
        !z.iso
          .date()
          .safeParse(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`)
          .success ||
        !f.source ||
        !f.mode
      )
        invalid();
    }
  });
export type DashboardFact = z.infer<typeof DashboardFactSchema>;
export const DashboardSnapshotSchema = z
  .strictObject({
    catalog: PublicCatalogSchema.optional(),
    topicUsage: TopicUsageConfigSchema.optional(),
    collectionAvailable: z.boolean().default(true),
    pendingTagReviews: z.number().int().min(0).default(0),
    conservativeWindow: z.boolean().default(false),
    state: z.enum([
      'ready',
      'empty',
      'refreshing',
      'error',
      'cleared',
      'stale',
    ]),
    refreshedAt: z.iso.datetime().nullable(),
    staleAt: z.iso.datetime().nullable(),
    generationId: z.string().min(1).max(100).nullable(),
    startDate: z.iso.date().nullable(),
    endDate: z.iso.date().nullable(),
    retainedFrom: z.iso.datetime().nullable(),
    retainedThrough: z.iso.datetime().nullable(),
    environment: z.enum(['test', 'production', 'connected']).nullable(),
    unmappedEvents: count,
    unattributedEvents: count,
    facts: z.array(DashboardFactSchema).max(100_000),
  })
  .superRefine((s, ctx) => {
    if (
      ['ready', 'empty'].includes(s.state) &&
      (!s.refreshedAt ||
        !s.staleAt ||
        !s.generationId ||
        !s.startDate ||
        !s.endDate ||
        !s.environment)
    )
      ctx.addIssue({ code: 'custom', message: 'Missing reporting health' });
    if (!['ready', 'empty'].includes(s.state) && s.facts.length)
      ctx.addIssue({
        code: 'custom',
        message: 'Unavailable reports cannot expose facts',
      });
    const seen = new Set<string>();
    for (const f of s.facts) {
      const key = JSON.stringify([
        f.entity,
        f.dateKey,
        f.source,
        f.mode,
        f.youtubeId,
        f.category,
        f.tag,
      ]);
      if (seen.has(key))
        ctx.addIssue({ code: 'custom', message: 'Duplicate aggregate row' });
      seen.add(key);
    }
  });
export type DashboardSnapshot = z.infer<typeof DashboardSnapshotSchema>;
export type SheetConnection = {
  title: string;
  url: string;
  kind: 'report' | 'library';
};
export type DashboardResponse =
  | { ok: true; snapshot: DashboardSnapshot; connection?: SheetConnection }
  | {
      ok: false;
      error:
        | 'ACCESS_DENIED'
        | 'REPORT_UNAVAILABLE'
        | 'SOURCE_NOT_CONFIGURED'
        | 'SHARING_TOO_BROAD';
    };
