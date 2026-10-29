/// <reference types="google-apps-script" />
import { z } from 'zod';
import {
  buildPublicCatalog,
  headers,
  type Workbook,
} from '../apps-script/catalog';
import {
  catalogVersion,
  readCatalogWorkbook,
} from '../apps-script/catalog-sheet';
import { readAnalyticsRecords } from '../apps-script/analytics-sheet';
import {
  readAnalyticsSnapshots,
  SNAPSHOT_TABLE,
} from '../apps-script/analytics-snapshots';
import { buildAnalyticsReport } from '../src/analytics/report';
import { DashboardSnapshotSchema } from '../src/admin/snapshot';
const DAY = 86_400_000;
const rawColumns = [
  'Video Title',
  'Description',
  'YouTube Link',
  'Status',
  'Proposed Function Areas',
  'Proposed Tools',
  'Proposed Task Keywords',
  'Approval Status',
] as const;
export function importLibraryRows(input: unknown[][]) {
  const heading = input[0] ?? [];
  if (
    rawColumns.some(
      (name) => heading.filter((value) => value === name).length !== 1,
    )
  )
    throw new Error('Unsupported library headers');
  const dictionary = new Map<string, [string, string]>();
  let pending = 0;
  const rows = input.slice(1).flatMap((row) => {
    const cell = (name: (typeof rawColumns)[number]) =>
      row[heading.indexOf(name)];
    if (
      !['Live on Web + YouTube', 'Live on YouTube'].includes(
        String(cell('Status')),
      )
    )
      return [];
    const link = String(cell('YouTube Link') ?? '').trim();
    const id =
      link.match(
        /^https:\/\/youtu\.be\/([A-Za-z0-9_-]{11})(?:[?#][^\s]*)?$/,
      )?.[1] ??
      (/^https:\/\/(?:www\.)?youtube\.com\/watch\?[^\s]+$/.test(link)
        ? link.match(/[?&]v=([A-Za-z0-9_-]{11})(?:[&#]|$)/)?.[1]
        : undefined);
    if (!id) throw new Error('Invalid video link');
    const approved =
      String(cell('Approval Status') ?? '')
        .trim()
        .toLowerCase() === 'approved';
    if (!approved) pending++;
    const tags = (name: (typeof rawColumns)[number], category: string) => {
      if (!approved) return '';
      const value = cell(name);
      if (value != null && typeof value !== 'string')
        throw new Error('Invalid tag cell');
      const terms = [
        ...new Set(
          String(value ?? '')
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
        ),
      ];
      terms.forEach((tag) =>
        dictionary.set(JSON.stringify([category, tag]), [category, tag]),
      );
      return terms.join(', ');
    };
    return [
      [
        id,
        cell('Video Title'),
        cell('Description'),
        tags('Proposed Function Areas', 'functionArea'),
        tags('Proposed Task Keywords', 'task'),
        tags('Proposed Tools', 'tool'),
        '',
        '',
        'active',
        false,
      ],
    ];
  });
  return {
    pending,
    workbook: {
      Catalog: [[...headers.Catalog], ...rows],
      Dictionary: [[...headers.Dictionary], ...dictionary.values()],
      Synonyms: [[...headers.Synonyms]],
      'Adjacent tools': [[...headers['Adjacent tools']]],
    } satisfies Workbook,
  };
}
function libraryCatalog(book: GoogleAppsScript.Spreadsheet.Spreadsheet) {
  if (book.getSheetByName('Catalog')) {
    for (const name of Object.keys(headers)) {
      const sheet = book.getSheetByName(name);
      if (sheet && (sheet.getLastRow() > 5001 || sheet.getLastColumn() > 50))
        throw new Error('Library exceeds reporting limits');
    }
    return { pending: 0, workbook: readCatalogWorkbook(book) };
  }
  const sheet = book.getSheetByName('First 10  -Tag Review');
  if (!sheet || sheet.getLastRow() > 1001 || sheet.getLastColumn() > 50)
    throw new Error('Unsupported library');
  const names: unknown[] = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0];
  if (
    rawColumns.some(
      (name) => names.filter((value) => value === name).length !== 1,
    )
  )
    throw new Error('Unsupported library');
  // Read only recognized public metadata/approval columns, never review notes or other tabs.
  const columns = rawColumns.map((name) =>
    sheet
      .getRange(
        2,
        names.indexOf(name) + 1,
        Math.max(1, sheet.getLastRow() - 1),
        1,
      )
      .getValues(),
  );
  const rows: unknown[][] = Array.from(
    { length: Math.max(0, sheet.getLastRow() - 1) },
    (_, row) => columns.map((column) => column[row]?.[0] ?? ''),
  );
  return importLibraryRows([[...rawColumns], ...rows]);
}
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
