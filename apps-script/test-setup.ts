import { buildPublicCatalog, headers, type Workbook } from './catalog';

export const TEST_SPREADSHEET_ID =
  '1UO6Biq_clsL8kqmHyBN2qChJ8nbLSwclY_Jdg499xHY';
export const TEST_SOURCE_TAB = 'First 10  -Tag Review';
const sourceHeaders = [
  'Video Title',
  'Description',
  'YouTube Link',
  'Status',
  'Proposed Function Areas',
  'Proposed Tools',
  'Proposed Task Keywords',
] as const;

// One-time test import. Proposed tags remain unapproved in the source tab.
export function prepareTestWorkbook(source: unknown[][]): Workbook {
  const heading = source[0] ?? [];
  if (
    sourceHeaders.some(
      (name) => heading.filter((value) => value === name).length !== 1,
    )
  ) {
    throw new Error(
      'Test source is missing a required header or has duplicate headers.',
    );
  }
  const dictionary = new Map<string, [string, string]>();
  const rows = source.slice(1).flatMap((row, index) => {
    if (!row.some((cell) => cell !== '' && cell != null)) return [];
    const value = (name: (typeof sourceHeaders)[number]) =>
      row[heading.indexOf(name)];
    if (
      !['Live on Web + YouTube', 'Live on YouTube'].includes(
        String(value('Status')),
      )
    )
      return [];
    const link = value('YouTube Link');
    const youtubeId =
      typeof link === 'string'
        ? link
            .trim()
            .match(
              /^https:\/\/youtu\.be\/([A-Za-z0-9_-]{11})(?:\?[^\s]*)?$/,
            )?.[1]
        : undefined;
    if (!youtubeId)
      throw new Error(`Test source row ${index + 2}: invalid YouTube link.`);
    const tags = (name: (typeof sourceHeaders)[number], category: string) => {
      const cell = value(name);
      if (cell != null && typeof cell !== 'string')
        throw new Error(`Test source row ${index + 2}: invalid tags.`);
      const list = [
        ...new Set(
          (cell ?? '')
            .toString()
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
        ),
      ];
      list.forEach((tag) =>
        dictionary.set(`${category}:${tag}`, [category, tag]),
      );
      return list.join(', ');
    };
    return [
      [
        youtubeId,
        value('Video Title'),
        value('Description'),
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
  if (rows.length === 0)
    throw new Error('Test source has no published videos.');
  const workbook: Workbook = {
    Catalog: [[...headers.Catalog], ...rows],
    Dictionary: [[...headers.Dictionary], ...dictionary.values()],
    Synonyms: [[...headers.Synonyms]],
    'Adjacent tools': [[...headers['Adjacent tools']]],
  };
  for (const grid of Object.values(workbook)) {
    if (
      grid
        .flat()
        .some(
          (cell) =>
            typeof cell === 'string' && cell.trimStart().startsWith('='),
        )
    ) {
      throw new Error('Test import cannot write formula-like text.');
    }
  }
  const result = buildPublicCatalog(workbook, () => `sha256:${'0'.repeat(64)}`);
  if (
    !result.catalog ||
    result.problems.length ||
    result.catalog.items.length !== rows.length
  ) {
    throw new Error(
      'Test source failed the public catalog contract. No tabs were changed.',
    );
  }
  return workbook;
}

// Only included in build:apps-script:test; never exposed by doGet.
export function initializeTestCatalog() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  if (book?.getId() !== TEST_SPREADSHEET_ID) {
    throw new Error(
      'Run this only from the script bound to the designated test Sheet.',
    );
  }
  const properties = PropertiesService.getScriptProperties();
  const environment = properties.getProperty('CATALOG_ENVIRONMENT');
  const configuredId = properties.getProperty('CATALOG_SPREADSHEET_ID');
  if (
    (environment && environment !== 'test') ||
    (configuredId && configuredId !== TEST_SPREADSHEET_ID)
  ) {
    throw new Error('This project is configured for a different environment.');
  }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1500)) throw new Error('Test setup is busy. Try again.');
  try {
    const names = [...Object.keys(headers), 'Problems'];
    if (names.some((name) => book.getSheetByName(name))) {
      throw new Error(
        'Catalog setup tabs already exist. Nothing was overwritten.',
      );
    }
    const source = book.getSheetByName(TEST_SOURCE_TAB);
    if (!source) throw new Error('Test source tab was not found.');
    const workbook = prepareTestWorkbook(source.getRange('A1:O11').getValues());
    properties.setProperties({
      CATALOG_ENVIRONMENT: 'test',
      CATALOG_SPREADSHEET_ID: TEST_SPREADSHEET_ID,
      CATALOG_PUBLIC_ENABLED: 'false',
    });
    const grids = {
      ...workbook,
      Problems: [['Tab', 'Row', 'Field', 'Reason']],
    };
    for (const [name, rows] of Object.entries(grids)) {
      const sheet = book.insertSheet(name);
      sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, rows[0].length).setFontWeight('bold');
      sheet.setColumnWidths(1, rows[0].length, 160);
      if (name === 'Catalog') {
        sheet.setColumnWidth(2, 280);
        sheet.setColumnWidth(3, 400);
        sheet.getRange(2, 1, rows.length - 1, rows[0].length).setWrap(true);
        sheet.getRange(2, 10, rows.length - 1, 1).insertCheckboxes();
        sheet
          .getRange(1, 1, 1, rows[0].length)
          .setNote(
            'Test catalog copied from the ten published videos. Tags are proposals for testing; source approval status is unchanged. Upload dates and lengths are unknown.',
          );
      }
    }
    SpreadsheetApp.flush();
    console.log(
      `Created test catalog with ${workbook.Catalog.length - 1} videos. Public access remains disabled.`,
    );
  } finally {
    lock.releaseLock();
  }
}
