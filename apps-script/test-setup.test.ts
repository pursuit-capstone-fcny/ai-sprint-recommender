import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildPublicCatalog } from './catalog';
import {
  initializeTestCatalog,
  prepareTestWorkbook,
  TEST_SOURCE_TAB,
  TEST_SPREADSHEET_ID,
} from './test-setup';

const source = [
  [
    'Video Title',
    'Description',
    'YouTube Link',
    'Status',
    'Proposed Function Areas',
    'Proposed Tools',
    'Proposed Task Keywords',
    'Date Shared',
    'Review Notes',
  ],
  [
    '[Fixture] Public title',
    'Fictional public description.',
    'https://youtu.be/fx01GrntRpt',
    'Live on YouTube',
    'Operations',
    'ChatGPT',
    'staff training',
    '3/5/2025',
    'private source notes',
  ],
];

afterEach(() => vi.unstubAllGlobals());

describe('test catalog preparation', () => {
  it('imports public fields and proposed tags without guessing metadata or including notes', () => {
    const workbook = prepareTestWorkbook(source);
    const { catalog, problems } = buildPublicCatalog(
      workbook,
      () => `sha256:${'0'.repeat(64)}`,
    );
    expect(problems).toEqual([]);
    expect(catalog?.items[0]).toMatchObject({
      youtubeId: 'fx01GrntRpt',
      functionAreas: ['Operations'],
      tools: ['ChatGPT'],
      tasks: ['staff training'],
      addedAt: null,
      lengthSeconds: null,
      startHere: false,
      status: 'active',
    });
    expect(JSON.stringify(workbook)).not.toContain('private source notes');
    expect(JSON.stringify(workbook)).not.toContain('3/5/2025');
  });

  it('does not activate unpublished videos', () => {
    const draft = [...source[1]];
    draft[3] = 'Draft';
    draft[2] = 'https://youtu.be/fx02DrftVid';
    const workbook = prepareTestWorkbook([...source, draft]);
    expect(workbook.Catalog).toHaveLength(2);
  });

  it('rejects duplicate IDs and missing source headers before returning any writes', () => {
    expect(() => prepareTestWorkbook([...source, source[1]])).toThrow(
      'public catalog contract',
    );
    expect(() => prepareTestWorkbook([[], source[1]])).toThrow(
      'required header',
    );
  });

  it('rejects invalid links and formula-like strings without quoting source values', () => {
    const invalid = source.map((row) => [...row]);
    invalid[1][2] = 'private-invalid-link';
    expect(() => prepareTestWorkbook(invalid)).toThrow(
      'Test source row 2: invalid YouTube link.',
    );
    invalid[1][2] = source[1][2];
    invalid[1][0] = '=private-formula';
    expect(() => prepareTestWorkbook(invalid)).toThrow(
      'cannot write formula-like text',
    );
  });
});

function googleSetup({
  id = TEST_SPREADSHEET_ID,
  environment = '',
  existing = false,
} = {}) {
  const values: Record<string, unknown[][]> = {};
  const properties: Record<string, string> = {
    CATALOG_ENVIRONMENT: environment,
  };
  const changes = vi.fn((next: Record<string, string>) =>
    Object.assign(properties, next),
  );
  const insertSheet = vi.fn((name: string) => ({
    getRange: () => ({
      setValues: (rows: unknown[][]) => {
        values[name] = rows;
      },
      setFontWeight: vi.fn(),
      setWrap: vi.fn(),
      insertCheckboxes: vi.fn(),
      setNote: vi.fn(),
    }),
    setFrozenRows: vi.fn(),
    setColumnWidths: vi.fn(),
    setColumnWidth: vi.fn(),
  }));
  vi.stubGlobal('SpreadsheetApp', {
    getActiveSpreadsheet: () => ({
      getId: () => id,
      getSheetByName: (name: string) =>
        name === TEST_SOURCE_TAB
          ? { getRange: () => ({ getValues: () => source }) }
          : existing && name === 'Catalog'
            ? {}
            : null,
      insertSheet,
    }),
    flush: vi.fn(),
  });
  vi.stubGlobal('PropertiesService', {
    getScriptProperties: () => ({
      getProperty: (key: string) => properties[key],
      setProperties: changes,
    }),
  });
  vi.stubGlobal('LockService', {
    getScriptLock: () => ({ tryLock: () => true, releaseLock: vi.fn() }),
  });
  return { values, changes, insertSheet, properties };
}

describe('test Sheet initialization', () => {
  it('pins the test Sheet and leaves public access disabled', () => {
    const service = googleSetup();
    initializeTestCatalog();
    expect(Object.keys(service.values)).toEqual([
      'Catalog',
      'Dictionary',
      'Synonyms',
      'Adjacent tools',
      'Problems',
    ]);
    expect(service.properties).toEqual({
      CATALOG_ENVIRONMENT: 'test',
      CATALOG_SPREADSHEET_ID: TEST_SPREADSHEET_ID,
      CATALOG_PUBLIC_ENABLED: 'false',
    });
    expect(service.values.Catalog).toHaveLength(2);
  });
  it.each([
    { id: 'another-sheet' },
    { environment: 'production' },
    { existing: true },
  ])('refuses an unsafe target or existing data: %j', (options) => {
    const service = googleSetup(options);
    expect(() => initializeTestCatalog()).toThrow();
    expect(service.insertSheet).not.toHaveBeenCalled();
    expect(service.changes).not.toHaveBeenCalled();
  });
});
