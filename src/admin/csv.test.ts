import { describe, expect, it } from 'vitest';
import { csvFilename, toCsv } from './csv';

describe('analytics CSV', () => {
  it('quotes text, keeps numbers raw and neutralizes formula cells', () => {
    expect(
      toCsv(
        ['Video', 'Appearances'],
        [
          ['Say "hi", team', 3],
          ['=HYPERLINK("x")', 0],
          ['+1 idea', 1],
          ['-draft', 2],
          ['@mention', 4],
        ],
      ).split('\r\n'),
    ).toEqual([
      '"Video","Appearances"',
      '"Say ""hi"", team",3',
      `"'=HYPERLINK(""x"")",0`,
      `"'+1 idea",1`,
      `"'-draft",2`,
      `"'@mention",4`,
    ]);
  });
  it('names the file after the view and date range', () => {
    expect(csvFilename('tag', '2026-11-01', '2026-11-02')).toBe(
      'library-analytics-tag-2026-11-01-to-2026-11-02.csv',
    );
  });
});
