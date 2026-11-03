import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyticsServices } from '../fixtures/analytics-services';
import { trackerFixture } from '../fixtures/tracker';
import { searchEvent } from '../fixtures/usage-events';
import * as published from './published-library';
import { initializeTrackerFromPublished, readTracker } from './tracker-sheet';
import { buildTrackerCatalog } from './tracker-catalog';
import { doPost } from './usage-sheet';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function setup() {
  const s = analyticsServices();
  const fixture = trackerFixture();
  vi.spyOn(published, 'publishedCatalog').mockReturnValue(fixture.baseline);
  s.data['fixture-catalog'] = { 'Video Tracker': fixture.grid };
  s.properties.LIBRARY_SOURCE_SHEET_URL =
    'https://docs.google.com/spreadsheets/d/fixture-catalog/edit';
  vi.stubGlobal('SpreadsheetApp', {
    ...SpreadsheetApp,
    getActiveSpreadsheet: () => s.openById('fixture-catalog'),
  });
  vi.stubGlobal('DriveApp', {
    Access: { PRIVATE: 'PRIVATE' },
    getFileById: () => ({ getSharingAccess: () => 'PRIVATE' }),
  });
  return { ...s, ...fixture };
}
describe('tracker workbook adapter', () => {
  it('refuses publicly shared source workbooks before setup or writing activity', () => {
    const s = setup();
    vi.stubGlobal('DriveApp', {
      Access: { PRIVATE: 'PRIVATE' },
      getFileById: () => ({ getSharingAccess: () => 'ANYONE_WITH_LINK' }),
    });
    expect(() => initializeTrackerFromPublished()).toThrow('Restricted');
    expect(s.ops.filter((op) => op.startsWith('write:'))).toEqual([]);
    s.properties.LIBRARY_SOURCE_FORMAT = 'tracker';
    s.properties.USAGE_SPREADSHEET_ID = 'fixture-catalog';
    const response = JSON.parse(
      doPost({
        postData: {
          type: 'text/plain',
          contents: JSON.stringify({
            ...searchEvent,
            catalogVersion: s.baseline.catalogVersion,
          }),
        },
      }).getContent(),
    );
    expect(response).toEqual({ error: { code: 'USAGE_UNAVAILABLE' } });
    expect(s.ops.filter((op) => op.startsWith('write:'))).toEqual([]);
  });
  it('migrates once, preserves unrelated fields and stores accepted activity in the same workbook', () => {
    const s = setup();
    s.grid[4][7] = '';
    s.grid[4][8] = '';
    s.grid[5][7] = '';
    s.grid[5][8] = '';
    s.grid[6][7] = '';
    s.grid[6][8] = '';
    s.grid[3].push('Private field');
    s.grid[4].push('Private content never read');
    const result = initializeTrackerFromPublished();
    expect(result.catalogVersion).toBe(s.baseline.catalogVersion);
    expect(s.grid[4][10]).toBe('Private content never read');
    expect(s.properties.USAGE_SPREADSHEET_ID).toBe('fixture-catalog');
    expect(s.properties.USAGE_LOGGING_ENABLED).toBe('true');
    expect(s.properties.USAGE_RETENTION_DAYS).toBe('30');
    expect(Object.keys(s.data['fixture-catalog'])).toEqual([
      'Video Tracker',
      'Usage',
    ]);
    const { rows } = readTracker(SpreadsheetApp.openById('fixture-catalog'));
    expect(buildTrackerCatalog(rows, s.baseline).catalog).toEqual(s.baseline);
    const response = JSON.parse(
      doPost({
        postData: {
          type: 'text/plain',
          contents: JSON.stringify({
            ...searchEvent,
            catalogVersion: s.baseline.catalogVersion,
          }),
        },
      }).getContent(),
    );
    expect(response).toEqual({ ok: true, status: 'accepted' });
    expect(s.data['fixture-catalog'].Usage).toHaveLength(2);
    expect(s.data['fixture-usage'].Usage).toHaveLength(1);
    expect(() => initializeTrackerFromPublished()).toThrow('never overwrites');
  });
  it('rejects tracker activity configured to write to a different workbook', () => {
    const s = setup();
    s.properties.LIBRARY_SOURCE_FORMAT = 'tracker';
    const response = JSON.parse(
      doPost({
        postData: {
          type: 'text/plain',
          contents: JSON.stringify({
            ...searchEvent,
            catalogVersion: s.baseline.catalogVersion,
          }),
        },
      }).getContent(),
    );
    expect(response).toEqual({ error: { code: 'USAGE_UNAVAILABLE' } });
    expect(s.data['fixture-usage'].Usage).toHaveLength(1);
  });
  it('refuses to abandon retained activity in the previous workbook before any migration writes', () => {
    const s = setup();
    s.grid.slice(4).forEach((row) => {
      row[7] = '';
      row[8] = '';
    });
    s.data['fixture-usage'].Usage.push([
      searchEvent.eventId,
      searchEvent.time,
      JSON.stringify(searchEvent),
    ]);
    const before = structuredClone(s.data);
    const properties = { ...s.properties };
    expect(() => initializeTrackerFromPublished()).toThrow('retention cleanup');
    expect(s.data).toEqual(before);
    expect(s.properties).toEqual(properties);
    expect(s.ops.filter((op) => op.startsWith('write:'))).toEqual([]);
  });
  it('fails closed when the previous activity workbook cannot be checked', () => {
    const s = setup();
    s.grid.slice(4).forEach((row) => {
      row[7] = '';
      row[8] = '';
    });
    s.properties.USAGE_SPREADSHEET_ID = 'inaccessible-previous-book';
    const before = structuredClone(s.data);
    expect(() => initializeTrackerFromPublished()).toThrow(
      'previous activity workbook',
    );
    expect(s.data).toEqual(before);
    expect(s.properties.USAGE_SPREADSHEET_ID).toBe(
      'inaccessible-previous-book',
    );
  });
  it('preserves retained activity when usage already targets the source workbook', () => {
    const s = setup();
    s.grid.slice(4).forEach((row) => {
      row[7] = '';
      row[8] = '';
    });
    s.properties.USAGE_SPREADSHEET_ID = 'fixture-catalog';
    s.data['fixture-catalog'].Usage = [
      ...s.data['fixture-usage'].Usage,
      [searchEvent.eventId, searchEvent.time, JSON.stringify(searchEvent)],
    ];
    const retained = structuredClone(s.data['fixture-catalog'].Usage);
    initializeTrackerFromPublished();
    expect(s.data['fixture-catalog'].Usage).toEqual(retained);
    expect(s.properties.USAGE_RETENTION_DAYS).toBe('30');
    expect(s.properties.USAGE_SPREADSHEET_ID).toBe('fixture-catalog');
  });
  it('reads only the whitelisted columns even with private adjacent content', () => {
    const s = setup();
    s.grid[3].push('Private field');
    const sheet = s
      .openById('fixture-catalog')
      .getSheetByName('Video Tracker')!;
    const read = vi.spyOn(sheet, 'getRange');
    const result = readTracker(SpreadsheetApp.openById('fixture-catalog'));
    expect(result.rows).toHaveLength(3);
    expect(
      read.mock.calls
        .filter(([row]) => row > 4)
        .every(([, col, , width]) => col <= 10 && width === 1),
    ).toBe(true);
  });
});
