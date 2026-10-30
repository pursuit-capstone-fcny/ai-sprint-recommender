/// <reference types="google-apps-script" />
import { z } from 'zod';
import { buildPublicCatalog } from '../apps-script/catalog';
import { catalogVersion } from '../apps-script/catalog-sheet';
import { readAnalyticsRecords } from '../apps-script/analytics-sheet';
import {
  readAnalyticsSnapshots,
  SNAPSHOT_TABLE,
} from '../apps-script/analytics-snapshots';
import { buildAnalyticsReport } from '../src/analytics/report';
import { DashboardSnapshotSchema } from '../src/admin/snapshot';
const DAY = 86_400_000;
import { libraryCatalog } from '../apps-script/library-source';
export { importLibraryRows } from '../apps-script/library-source';
export function readLibraryDashboard(
  book: GoogleAppsScript.Spreadsheet.Spreadsheet,
) {
  const { pending, workbook } = libraryCatalog(book);
  const { catalog, problems } = buildPublicCatalog(workbook, catalogVersion);
  if (!catalog || problems.length)
    throw new Error('Library catalog is invalid');
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
  const snapshotSheet = book.getSheetByName(SNAPSHOT_TABLE);
  const snapshots = snapshotSheet ? readAnalyticsSnapshots(snapshotSheet) : [];
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
  return DashboardSnapshotSchema.parse({
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
    pendingTagReviews: pending,
    conservativeWindow: !policy,
  });
}
