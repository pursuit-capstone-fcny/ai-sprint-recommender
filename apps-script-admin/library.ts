/// <reference types="google-apps-script" />
import { z } from 'zod';
import {
  publishedCatalog,
  publishedHistory,
} from '../apps-script/published-library';
import { readAnalyticsRecords } from '../apps-script/analytics-sheet';
import { buildAnalyticsReport } from '../src/analytics/report';
import {
  DashboardSnapshotSchema,
  TopicUsageConfigSchema,
} from '../src/admin/snapshot';
const DAY = 86_400_000;
export { importLibraryRows } from '../apps-script/library-source';
export function readLibraryDashboard(
  book: GoogleAppsScript.Spreadsheet.Spreadsheet,
) {
  const catalog = publishedCatalog();
  const policySchema = z.strictObject({
    schemaVersion: z.literal(1),
    retentionDays: z.number().int().min(1).max(365),
    environment: z.enum(['test', 'production']),
  });
  const marker = book
    .getDeveloperMetadata()
    .filter((value) => value.getKey() === 'FCNY_ANALYTICS_POLICY_V1');
  if (marker.length > 1) throw new Error('Conflicting reporting policy');
  const policy = marker.length
    ? policySchema.parse(JSON.parse(marker[0].getValue() ?? ''))
    : null;
  const days = policy?.retentionDays ?? 1,
    now = new Date();
  const log = book.getSheetByName('Usage');
  const records = log ? readAnalyticsRecords(log, now, days) : [];
  const snapshots = publishedHistory(
    records.map((record) => record.event.catalogVersion),
    catalog,
  );
  const date = (value: string) =>
    Utilities.formatDate(new Date(value), 'America/New_York', 'yyyy-MM-dd');
  const startDate = date(new Date(now.getTime() - days * DAY).toISOString()),
    endDate = date(now.toISOString());
  const result = buildAnalyticsReport(
    {
      records,
      current: catalog,
      snapshots,
      filter: { startDate, endDate, includeTeam: true },
    },
    date,
  );
  const properties = PropertiesService.getScriptProperties();
  const topicUsage = TopicUsageConfigSchema.safeParse({
    url: properties.getProperty('TOPIC_USAGE_URL'),
    retentionDays: Number(properties.getProperty('TOPIC_USAGE_RETENTION_DAYS')),
  });
  return DashboardSnapshotSchema.parse({
    catalog,
    ...(properties.getProperty('TOPIC_USAGE_ENABLED') === 'true' &&
    topicUsage.success
      ? { topicUsage: topicUsage.data }
      : {}),
    state: records.length ? 'ready' : 'empty',
    refreshedAt: now.toISOString(),
    staleAt: new Date(now.getTime() + 15 * 60_000).toISOString(),
    generationId: Utilities.getUuid(),
    startDate,
    endDate,
    retainedFrom: result.diagnostics.retainedFrom,
    retainedThrough: result.diagnostics.retainedThrough,
    environment: policy?.environment ?? 'connected',
    unmappedEvents: result.diagnostics.unmappedEvents,
    unattributedEvents: result.diagnostics.unattributedEvents,
    facts: result.facts,
    collectionAvailable: Boolean(log),
    pendingTagReviews: 0,
    conservativeWindow: !policy,
  });
}
