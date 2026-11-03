import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyticsServices } from '../fixtures/analytics-services';
import { trackerFixture } from '../fixtures/tracker';
import {
  buildTrackerCatalog,
  planTrackerMigration,
  trackerChanges,
  youtubeId,
} from './tracker-catalog';
import { deterministicSelection } from '../src/recommendations/deterministicSelection';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe('tracker publication', () => {
  it('preserves the complete catalog and deterministic results after row reordering', () => {
    analyticsServices();
    const { baseline, rows } = trackerFixture();
    const result = buildTrackerCatalog(rows.reverse(), baseline);
    expect(result.problems).toEqual([]);
    expect(result.catalog).toEqual(baseline);
    for (const goal of [
      'grant reporting with ChatGPT',
      'budget tracking',
      'Excel',
      'unrelated task',
    ]) {
      const profile = { functionArea: null, tools: [], goalWords: [] };
      expect(deterministicSelection(result.catalog!, goal, profile)).toEqual(
        deterministicSelection(baseline, goal, profile),
      );
    }
  });
  it('adds a reviewed video and new tags without a mapping or code update', () => {
    analyticsServices();
    const { baseline, rows } = trackerFixture();
    rows.push({
      row: 8,
      cells: {
        ...rows[0].cells,
        'Video Title': 'Fictional new workflow',
        Description: 'Fictional public lesson about volunteer scheduling.',
        'YouTube Link': 'https://www.youtube.com/watch?v=newVideo001',
        'Primary Category (Web)': 'Volunteer services',
        Tool: 'New tool',
        'Task keywords': 'volunteer scheduling',
        'Instruction format': 'walkthrough',
      },
    });
    const { catalog, problems } = buildTrackerCatalog(rows, baseline);
    expect(problems).toEqual([]);
    expect(catalog?.items).toHaveLength(baseline.items.length + 1);
    expect(catalog?.tasks).toContain('volunteer scheduling');
    expect(catalog?.tools).toContain('New tool');
    expect(catalog?.functionAreas).toContain('Volunteer services');
    expect(trackerChanges(baseline, catalog!).added).toEqual([
      { youtubeId: 'newVideo001', title: 'Fictional new workflow' },
    ]);
    const matches = deterministicSelection(catalog!, 'volunteer scheduling', {
      functionArea: null,
      tools: [],
      goalWords: [],
    });
    expect(matches.results.map((r) => r.item.youtubeId)).toContain(
      'newVideo001',
    );
  });
  it('blocks incomplete published rows and duplicate links with safe row diagnostics', () => {
    analyticsServices();
    const { baseline, rows } = trackerFixture();
    rows[0].cells['Metadata status'] = 'Draft';
    rows[1].cells['YouTube Link'] = rows[0].cells['YouTube Link'];
    rows[2].cells['Task keywords'] = '';
    const result = buildTrackerCatalog(rows, baseline);
    expect(result.catalog).toBeNull();
    expect(result.problems).toEqual(
      expect.arrayContaining([
        {
          row: 5,
          field: 'Metadata status',
          reason: 'Review this published video and mark it Ready',
        },
        { row: 6, field: 'YouTube Link', reason: 'Duplicate video ID' },
        {
          row: 7,
          field: 'Task keywords',
          reason: 'Expected reviewed nonblank text',
        },
      ]),
    );
    expect(JSON.stringify(result.problems)).not.toContain(
      rows[0].cells.Description,
    );
  });
  it.each(['Retired', 'Draft'])(
    'blocks duplicate IDs even when one tracker row is %s',
    (status) => {
      analyticsServices();
      const { baseline, rows } = trackerFixture();
      rows.push({ row: 8, cells: { ...rows[0].cells, Status: status } });
      const result = buildTrackerCatalog(rows, baseline);
      expect(result.catalog).toBeNull();
      expect(result.problems).toContainEqual({
        row: 8,
        field: 'YouTube Link',
        reason: 'Duplicate video ID',
      });
      expect(
        buildTrackerCatalog([...rows].reverse(), baseline).catalog,
      ).toBeNull();
    },
  );
  it('requires reviewed evidence for additions and does not promote a mention to a taught task', () => {
    analyticsServices();
    const { baseline, rows } = trackerFixture();
    const added = {
      row: 8,
      cells: {
        ...rows[0].cells,
        'Video Title': 'Fictional volunteer scheduling lesson',
        Description: 'Fictional discussion of volunteer scheduling.',
        'YouTube Link': 'https://youtu.be/newVideo001',
        'Task keywords': 'volunteer scheduling',
      },
    };
    expect(
      buildTrackerCatalog([...rows, added], baseline).problems,
    ).toContainEqual({
      row: 8,
      field: 'Instruction format',
      reason:
        'Review the instructional evidence for this new or retagged video',
    });
    added.cells['Instruction format'] = 'mentioned';
    const catalog = buildTrackerCatalog([...rows, added], baseline).catalog!;
    const result = deterministicSelection(catalog, 'volunteer scheduling', {
      functionArea: null,
      tools: [],
      goalWords: [],
    });
    expect(result.results.map((r) => r.item.youtubeId)).not.toContain(
      'newVideo001',
    );
  });
  it('accepts newly taught tasks on an existing video through reviewed metadata rather than a code-table edit', () => {
    analyticsServices();
    const { baseline, rows } = trackerFixture();
    rows[0].cells['Task keywords'] = 'volunteer scheduling';
    expect(buildTrackerCatalog(rows, baseline).catalog).toBeNull();
    rows[0].cells['Instruction format'] = 'walkthrough';
    const catalog = buildTrackerCatalog(rows, baseline).catalog!;
    const result = deterministicSelection(catalog, 'volunteer scheduling', {
      functionArea: null,
      tools: [],
      goalWords: [],
    });
    expect(result.results.map((r) => r.item.youtubeId)).toContain(
      'fx01GrntRpt',
    );
  });
  it('retires videos without losing event-time metadata or dictionary vocabulary', () => {
    analyticsServices();
    const { baseline, rows } = trackerFixture();
    rows[0].cells.Status = 'Retired';
    const { catalog } = buildTrackerCatalog(rows, baseline);
    expect(catalog?.items).toHaveLength(2);
    expect(catalog?.tasks).toEqual(baseline.tasks);
    expect(trackerChanges(baseline, catalog!).retired).toHaveLength(1);
    expect(baseline.items).toHaveLength(3);
  });
  it('migrates by identity, reconciles public metadata and refuses a second overwrite', () => {
    analyticsServices();
    const { baseline, rows } = trackerFixture();
    rows.forEach(({ cells }) => {
      cells['Task keywords'] = '';
      cells['Metadata status'] = '';
    });
    rows[0].cells['YouTube Link'] = 'Old rich-link label';
    rows[1].cells['YouTube Link'] = rows[2].cells['YouTube Link'];
    rows[1].cells.Description = 'Earlier description';
    rows[0].cells['Primary Category (Web)'] = 'Earlier category';
    const plan = planTrackerMigration(rows.reverse(), baseline);
    expect(plan.catalog).toEqual(baseline);
    expect(plan.updates).toContainEqual({
      row: 5,
      field: 'YouTube Link',
      value: 'https://youtu.be/fx01GrntRpt',
    });
    expect(rows[0].cells['Metadata status']).toBe('');
    rows[0].cells['Task keywords'] = 'Staff edit';
    expect(() => planTrackerMigration(rows, baseline)).toThrow(
      'never overwrites',
    );
  });
  it('blocks migration when a baseline video is missing rather than silently retiring it', () => {
    analyticsServices();
    const { baseline, rows } = trackerFixture();
    rows.forEach(({ cells }) => {
      cells['Task keywords'] = '';
      cells['Metadata status'] = '';
    });
    expect(() => planTrackerMigration(rows.slice(1), baseline)).toThrow(
      'complete published catalog',
    );
  });
  it('resolves duplicate published titles by distinct YouTube IDs and rejects unresolved identities', () => {
    analyticsServices();
    const { baseline, rows } = trackerFixture();
    baseline.items[1].title = baseline.items[0].title;
    rows[1].cells['Video Title'] = baseline.items[0].title;
    baseline.catalogVersion = buildTrackerCatalog(
      rows,
      baseline,
    ).catalog!.catalogVersion;
    rows.forEach(({ cells }) => {
      cells['Task keywords'] = '';
      cells['Metadata status'] = '';
    });
    expect(planTrackerMigration(rows, baseline).catalog).toEqual(baseline);
    rows[0].cells['YouTube Link'] = 'Unresolved rich-link label';
    expect(() => planTrackerMigration(rows, baseline)).toThrow(
      'unique published video',
    );
    rows[0].cells['YouTube Link'] = rows[1].cells['YouTube Link'];
    expect(() => planTrackerMigration(rows, baseline)).toThrow(
      'unique published video',
    );
  });
  it('accepts only public YouTube link shapes', () => {
    expect(youtubeId('https://www.youtube.com/watch?v=newVideo001&t=4')).toBe(
      'newVideo001',
    );
    expect(
      youtubeId('https://example.test/watch?v=newVideo001'),
    ).toBeUndefined();
  });
});
