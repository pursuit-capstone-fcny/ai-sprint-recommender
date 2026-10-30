import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyticsServices } from '../fixtures/analytics-services';
import { importLibraryRows, readLibraryDashboard } from './library';
import { buildPublicCatalog } from '../apps-script/catalog';
import { catalogVersion } from '../apps-script/catalog-sheet';
const heading = [
  'Video Title',
  'Description',
  'YouTube Link',
  'Status',
  'Proposed Function Areas',
  'Proposed Tools',
  'Proposed Task Keywords',
  'Approval Status',
];
const row = [
  'Fictional video',
  'Public example description',
  'https://www.youtube.com/watch?v=demo0000001',
  'Live on Web + YouTube',
  'Finance',
  'ChatGPT',
  'Reporting',
  'Needs review',
];
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe('connected library reader', () => {
  it('loads the integration format but never promotes pending proposals to canonical tags', () => {
    analyticsServices();
    const pending = importLibraryRows([heading, row]);
    const parsed = buildPublicCatalog(pending.workbook, catalogVersion);
    expect(parsed.problems).toEqual([]);
    expect(parsed.catalog?.items).toHaveLength(1);
    expect(parsed.catalog?.items[0].tools).toEqual([]);
    expect(pending.pending).toBe(1);
    const approved = importLibraryRows([
      heading,
      [...row.slice(0, -1), 'Approved'],
    ]);
    expect(
      buildPublicCatalog(approved.workbook, catalogVersion).catalog?.items[0]
        .tools,
    ).toEqual(['ChatGPT']);
  });
  it('reads only known columns and handles a library without events honestly', () => {
    const s = analyticsServices();
    s.data['fixture-library'] = {
      'First 10  -Tag Review': [
        [...heading, 'Review Notes'],
        [...row, 'Private note never returned'],
      ],
    };
    const result = readLibraryDashboard(
      SpreadsheetApp.openById('fixture-library'),
    );
    expect(result.collectionAvailable).toBe(false);
    expect(result.pendingTagReviews).toBe(0);
    expect(
      result.facts.filter((f) => f.entity === 'video').length,
    ).toBeGreaterThan(1);
    expect(JSON.stringify(result)).not.toContain('Private note');
    expect(s.ops).toEqual([]);
  });
  it('rejects ambiguous headers and unsupported video links instead of guessing', () => {
    expect(() =>
      importLibraryRows([[...heading, 'Video Title'], row]),
    ).toThrow();
    const invalid = [...row];
    invalid[2] = 'https://example.test/watch?v=demo0000001';
    expect(() => importLibraryRows([heading, invalid])).toThrow();
  });
  it('honors an approved policy and rejects conflicting or malformed policy metadata', () => {
    const s = analyticsServices();
    const book = s.openById('fixture-catalog');
    const marker = {
      getKey: () => 'FCNY_ANALYTICS_POLICY_V1',
      getValue: () =>
        JSON.stringify({
          schemaVersion: 1,
          retentionDays: 30,
          environment: 'test',
        }),
    };
    const connected = { ...book, getDeveloperMetadata: () => [marker] };
    const result = readLibraryDashboard(
      connected as unknown as GoogleAppsScript.Spreadsheet.Spreadsheet,
    );
    expect(result.conservativeWindow).toBe(false);
    expect(result.environment).toBe('test');
    expect(() =>
      readLibraryDashboard({
        ...connected,
        getDeveloperMetadata: () => [marker, marker],
      } as unknown as GoogleAppsScript.Spreadsheet.Spreadsheet),
    ).toThrow('Conflicting');
  });
});
