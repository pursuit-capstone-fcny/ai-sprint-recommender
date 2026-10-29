import { z } from 'zod';
import {
  categoryKeys,
  PublicCatalogSchema,
  type PublicCatalog,
  type PublicCatalogItem,
  type TagCategory,
} from '../contracts/publicCatalog';
import {
  hasUsageCatalogReferences,
  UsageEventSchema,
  type UsageEvent,
} from '../contracts/usageEvent';

const date = z.iso.date();
export const ReportFilterSchema = z
  .strictObject({
    startDate: date,
    endDate: date,
    source: z
      .enum(['all', 'website', 'email', 'session', 'pilot', 'team', 'other'])
      .default('all'),
    includeTeam: z.boolean().default(false),
    mode: z.enum(['all', 'recommendations', 'topic', 'direct']).default('all'),
    youtubeId: z
      .string()
      .regex(/^[A-Za-z0-9_-]{11}$/)
      .optional(),
    category: z.enum(['functionArea', 'tool', 'task']).optional(),
    tag: z.string().min(1).max(120).optional(),
    activity: z
      .enum(['all', 'zero-appearances', 'no-clicks', 'zero-searches'])
      .default('all'),
  })
  .refine(
    (value) =>
      value.startDate <= value.endDate && (!value.tag || value.category),
  );
export type ReportFilter = z.input<typeof ReportFilterSchema>;
export type AcceptedUsage = { receivedAt: string; event: UsageEvent };
export const AcceptedUsageSchema = z.strictObject({
  receivedAt: z.iso.datetime(),
  event: UsageEventSchema,
});
export type Tag = { category: TagCategory; tag: string };
export type Counts = {
  appearances: number;
  embedClicks: number;
  youtubeClicks: number;
  directViews: number;
  directEmbedClicks: number;
  directYoutubeClicks: number;
};
export type VideoRow = Counts & { youtubeId: string; title: string };
export type TagRow = Counts & Tag & { searches: number };
export type AssociationRow = Tag & {
  youtubeId: string;
  title: string;
  appearances: number;
  embedClicks: number;
  youtubeClicks: number;
};
export type AnalyticsReport = {
  videos: VideoRow[];
  tags: TagRow[];
  associations: AssociationRow[];
  diagnostics: {
    acceptedEvents: number;
    duplicateEvents: number;
    repeatedImpressions: number;
    unmappedEvents: number;
    unattributedEvents: number;
    retainedFrom: string | null;
    retainedThrough: string | null;
  };
};
const categories = Object.keys(categoryKeys) as TagCategory[];
const counts = (): Counts => ({
  appearances: 0,
  embedClicks: 0,
  youtubeClicks: 0,
  directViews: 0,
  directEmbedClicks: 0,
  directYoutubeClicks: 0,
});
const key = (...parts: string[]) => JSON.stringify(parts);
const contextKey = (e: UsageEvent) =>
  key(e.sessionId, e.searchId, e.catalogVersion);
const impressionKey = (e: Exclude<UsageEvent, { type: 'search' }>) =>
  key(contextKey(e), e.youtubeId);
const tagKey = (t: Tag) => key(t.category, t.tag);
function catalogTags(catalog: PublicCatalog): Tag[] {
  return categories.flatMap((category) =>
    catalog[categoryKeys[category]].map((tag) => ({ category, tag })),
  );
}
function videoTags(item: PublicCatalogItem): Tag[] {
  return categories.flatMap((category) =>
    item[categoryKeys[category]].map((tag) => ({ category, tag })),
  );
}
function searchTags(e: Extract<UsageEvent, { type: 'search' }>): Tag[] {
  return [
    ...(e.functionArea
      ? [{ category: 'functionArea' as const, tag: e.functionArea }]
      : []),
    ...e.tools.map((tag) => ({ category: 'tool' as const, tag })),
    ...e.tasks.map((tag) => ({ category: 'task' as const, tag })),
  ];
}

// Injected by Apps Script via Utilities.formatDate, avoiding runtime-specific Intl behavior.
export function newYorkDate(value: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** No session/search/event identifiers or raw event bodies leave this function. */
export function buildAnalyticsReport(
  input: {
    records: AcceptedUsage[];
    current: PublicCatalog;
    snapshots?: PublicCatalog[];
    filter: ReportFilter;
  },
  receivedDate: (value: string) => string = newYorkDate,
): AnalyticsReport {
  const filter = ReportFilterSchema.parse(input.filter);
  const current = PublicCatalogSchema.parse(input.current);
  const catalogs = new Map<string, PublicCatalog>();
  for (const value of [...(input.snapshots ?? []), current]) {
    const catalog = PublicCatalogSchema.parse(value);
    const prior = catalogs.get(catalog.catalogVersion);
    if (prior && JSON.stringify(prior) !== JSON.stringify(catalog))
      throw new Error('Conflicting catalog snapshots');
    catalogs.set(catalog.catalogVersion, catalog);
  }
  const diagnostics: AnalyticsReport['diagnostics'] = {
    acceptedEvents: 0,
    duplicateEvents: 0,
    repeatedImpressions: 0,
    unmappedEvents: 0,
    unattributedEvents: 0,
    retainedFrom: null,
    retainedThrough: null,
  };
  const unique = new Map<string, AcceptedUsage>();
  for (const raw of input.records) {
    const record = AcceptedUsageSchema.parse(raw);
    const existing = unique.get(record.event.eventId);
    if (existing) {
      if (JSON.stringify(existing.event) !== JSON.stringify(record.event))
        throw new Error('Conflicting event IDs');
      diagnostics.duplicateEvents++;
      if (record.receivedAt < existing.receivedAt)
        unique.set(record.event.eventId, record);
    } else unique.set(record.event.eventId, record);
  }
  if (input.records.length > 10_000)
    throw new Error('Analytics row limit exceeded');
  const records = [...unique.values()].sort(
    (a, b) =>
      Date.parse(a.receivedAt) - Date.parse(b.receivedAt) ||
      a.event.eventId.localeCompare(b.event.eventId),
  );
  diagnostics.acceptedEvents = records.length;
  diagnostics.retainedFrom = records[0]?.receivedAt ?? null;
  diagnostics.retainedThrough = records.at(-1)?.receivedAt ?? null;
  const searches = new Map<string, Extract<UsageEvent, { type: 'search' }>>();
  const impressions = new Map<
    string,
    Exclude<UsageEvent, { type: 'search' }>
  >();
  const seenSearches = new Set<string>();
  for (const { event } of records) {
    const snapshot = catalogs.get(event.catalogVersion);
    if (snapshot && !hasUsageCatalogReferences(event, snapshot))
      throw new Error('Invalid event catalog reference');
    if (event.type === 'search') {
      const existing = searches.get(contextKey(event));
      // A search context is immutable. Ignore retries with a new event ID only if semantically identical.
      if (
        existing &&
        JSON.stringify({ ...existing, eventId: '', time: '' }) !==
          JSON.stringify({ ...event, eventId: '', time: '' })
      )
        throw new Error('Conflicting search context');
      if (!existing && snapshot) searches.set(contextKey(event), event);
    }
    if (event.type === 'impression' && !impressions.has(impressionKey(event)))
      impressions.set(impressionKey(event), event);
  }
  const displayedContexts = new Set(
    [...impressions.values()].map((e) =>
      key(contextKey(e), e.youtubeId, e.src, e.mode),
    ),
  );
  const videos = new Map<string, VideoRow>(
    current.items.map((item) => [
      item.youtubeId,
      { youtubeId: item.youtubeId, title: item.title, ...counts() },
    ]),
  );
  const tags = new Map<string, TagRow>(
    catalogTags(current).map((tag) => [
      tagKey(tag),
      { ...tag, ...counts(), searches: 0 },
    ]),
  );
  const associations = new Map<string, AssociationRow>();
  const seenImpressions = new Set<string>();
  const matchesTag = (values: Tag[]) =>
    values.some(
      (tag) =>
        (!filter.category || tag.category === filter.category) &&
        (!filter.tag || tag.tag === filter.tag),
    );
  const eligibleVideos = new Set(
    current.items
      .filter(
        (item) =>
          !(filter.category || filter.tag) || matchesTag(videoTags(item)),
      )
      .map((item) => item.youtubeId),
  );
  const ensureTag = (tag: Tag) => {
    if (!tags.has(tagKey(tag)))
      tags.set(tagKey(tag), { ...tag, ...counts(), searches: 0 });
    return tags.get(tagKey(tag))!;
  };
  const increment = (
    row: Counts,
    e: Exclude<UsageEvent, { type: 'search' }>,
  ) => {
    if (e.mode === 'direct') {
      if (e.type === 'impression') row.directViews++;
      else if (e.target === 'embed') row.directEmbedClicks++;
      else row.directYoutubeClicks++;
    } else if (e.type === 'impression') row.appearances++;
    else if (e.target === 'embed') row.embedClicks++;
    else row.youtubeClicks++;
  };
  for (const record of records) {
    const e = record.event;
    // Deduplicate impressions across dates and sources before applying filters.
    if (e.type === 'impression') {
      if (seenImpressions.has(impressionKey(e))) {
        diagnostics.repeatedImpressions++;
        continue;
      }
      seenImpressions.add(impressionKey(e));
    }
    const day = receivedDate(record.receivedAt);
    if (
      day < filter.startDate ||
      day > filter.endDate ||
      (!filter.includeTeam && e.src === 'team') ||
      (filter.source !== 'all' && e.src !== filter.source) ||
      (filter.mode !== 'all' && e.mode !== filter.mode)
    )
      continue;
    const catalog = catalogs.get(e.catalogVersion);
    if (!catalog) diagnostics.unmappedEvents++;
    if (e.type === 'search') {
      if (seenSearches.has(contextKey(e))) continue;
      seenSearches.add(contextKey(e));
      if (!catalog) continue;
      // Video filters use the displayed-video relation, not every catalog video carrying a keyword.
      if (
        filter.youtubeId &&
        !displayedContexts.has(
          key(contextKey(e), filter.youtubeId, e.src, e.mode),
        )
      )
        continue;
      for (const tag of searchTags(e)) ensureTag(tag).searches++;
      continue;
    }
    if (filter.youtubeId && e.youtubeId !== filter.youtubeId) continue;
    const item = catalog?.items.find((item) => item.youtubeId === e.youtubeId);
    const itemTags = item ? videoTags(item) : [];
    if ((filter.category || filter.tag) && !matchesTag(itemTags)) continue;
    eligibleVideos.add(e.youtubeId);
    if (!videos.has(e.youtubeId) && item)
      videos.set(e.youtubeId, {
        youtubeId: item.youtubeId,
        title: item.title,
        ...counts(),
      });
    const video = videos.get(e.youtubeId);
    if (video) increment(video, e);
    for (const tag of itemTags) increment(ensureTag(tag), e);
    const search = searches.get(contextKey(e));
    const impression = impressions.get(impressionKey(e));
    if (
      e.mode === 'direct' ||
      !search ||
      !impression ||
      search.src !== e.src ||
      search.mode !== e.mode ||
      impression.src !== e.src ||
      impression.mode !== e.mode
    ) {
      diagnostics.unattributedEvents++;
      continue;
    }
    // Without an event-time catalog, no tags or associations can be attributed.
    if (!item) continue;
    for (const tag of searchTags(search)) {
      const id = key(e.youtubeId, tagKey(tag));
      if (!associations.has(id))
        associations.set(id, {
          youtubeId: e.youtubeId,
          title: item.title,
          ...tag,
          appearances: 0,
          embedClicks: 0,
          youtubeClicks: 0,
        });
      const association = associations.get(id)!;
      if (e.type === 'impression') association.appearances++;
      else if (e.target === 'embed') association.embedClicks++;
      else association.youtubeClicks++;
    }
  }
  const matchesActivity = (row: Counts & { searches?: number }) =>
    filter.activity === 'all' ||
    (filter.activity === 'zero-appearances' && row.appearances === 0) ||
    (filter.activity === 'no-clicks' &&
      row.appearances > 0 &&
      row.embedClicks + row.youtubeClicks === 0) ||
    (filter.activity === 'zero-searches' && row.searches === 0);
  const resultVideos = [...videos.values()].filter(
    (row) =>
      (!filter.youtubeId || row.youtubeId === filter.youtubeId) &&
      eligibleVideos.has(row.youtubeId) &&
      matchesActivity(row),
  );
  const resultTags = [...tags.values()].filter(
    (row) =>
      (!filter.category || row.category === filter.category) &&
      (!filter.tag || row.tag === filter.tag) &&
      matchesActivity(row),
  );
  const byTag = (a: Tag, b: Tag) =>
    a.category.localeCompare(b.category) || a.tag.localeCompare(b.tag);
  return {
    videos: resultVideos.sort((a, b) => a.youtubeId.localeCompare(b.youtubeId)),
    tags: resultTags.sort(byTag),
    associations: [...associations.values()]
      .filter(
        (row) =>
          (!filter.category || row.category === filter.category) &&
          (!filter.tag || row.tag === filter.tag),
      )
      .sort((a, b) => a.youtubeId.localeCompare(b.youtubeId) || byTag(a, b)),
    diagnostics,
  };
}
