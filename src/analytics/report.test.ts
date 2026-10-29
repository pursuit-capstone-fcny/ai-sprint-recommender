import { describe, expect, it } from 'vitest';
import fixture from '../../fixtures/public-catalog.json';
import { impressionEvent, searchEvent } from '../../fixtures/usage-events';
import { parsePublicCatalog } from '../contracts/publicCatalog';
import { UsageEventSchema } from '../contracts/usageEvent';
import {
  buildAnalyticsReport,
  newYorkDate,
  type AcceptedUsage,
  type ReportFilter,
} from './report';

const catalog = parsePublicCatalog(fixture);
const window: ReportFilter = { startDate: '2026-10-20', endDate: '2026-10-20' };
const uuid = (n: number) =>
  `00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;
function record(
  n: number,
  patch: Record<string, unknown> = {},
  receivedAt = '2026-10-20T12:00:00.000Z',
): AcceptedUsage {
  return {
    receivedAt,
    event: UsageEventSchema.parse({
      ...(patch.type === 'search' ? searchEvent : impressionEvent),
      mode: 'recommendations',
      recommendationEngine: 'rules',
      llmFallbackReason: 'not-requested',
      src: 'website',
      eventId: uuid(n),
      ...patch,
    }),
  };
}
const search = (
  n = 1,
  patch: Record<string, unknown> = {},
  receivedAt?: string,
) => record(n, { ...searchEvent, eventId: uuid(n), ...patch }, receivedAt);
const run = (records: AcceptedUsage[], filter: ReportFilter = window) =>
  buildAnalyticsReport({ records, current: catalog, filter });
const video = (report: ReturnType<typeof run>, index = 0) =>
  report.videos.find(
    (row) => row.youtubeId === catalog.items[index].youtubeId,
  )!;
const task = (report: ReturnType<typeof run>, tag = 'grant reports') =>
  report.tags.find((row) => row.category === 'task' && row.tag === tag)!;

describe('MVP analytics aggregation', () => {
  it('AC-24.2/.9/.10: counts appearances, canonical searches and associations without multiplying joins', () => {
    const events = [
      search(),
      record(2),
      record(3, { type: 'click', target: 'embed' }),
      record(4, { type: 'click', target: 'youtube' }),
    ];
    const report = run([...events, events[1], record(5)]);
    expect(video(report)).toMatchObject({
      appearances: 1,
      embedClicks: 1,
      youtubeClicks: 1,
    });
    expect(task(report)).toMatchObject({
      appearances: 1,
      searches: 1,
      embedClicks: 1,
      youtubeClicks: 1,
    });
    expect(report.associations).toHaveLength(3);
    expect(
      report.associations.every(
        (row) =>
          row.appearances === 1 &&
          row.embedClicks === 1 &&
          row.youtubeClicks === 1,
      ),
    ).toBe(true);
    expect(report.diagnostics).toMatchObject({
      duplicateEvents: 1,
      repeatedImpressions: 1,
      unmappedEvents: 0,
      unattributedEvents: 0,
    });
    expect(JSON.stringify(report)).not.toContain(searchEvent.sessionId);
    expect(JSON.stringify(report)).not.toContain('eventId');
  });

  it('AC-24.4: keeps zero-activity videos and unused dictionary tags and distinguishes no-click appearances', () => {
    const records = [search(), record(2)];
    const zeros = run(records, { ...window, activity: 'zero-appearances' });
    expect(zeros.videos.map((row) => row.youtubeId)).toEqual(
      catalog.items
        .slice(1)
        .map((item) => item.youtubeId)
        .sort(),
    );
    expect(zeros.tags.some((row) => row.tag === 'Claude')).toBe(true);
    const noClicks = run(records, { ...window, activity: 'no-clicks' });
    expect(noClicks.videos).toHaveLength(1);
    expect(video(noClicks).appearances).toBe(1);
    const unusedKeywords = run(records, {
      ...window,
      activity: 'zero-searches',
    });
    expect(unusedKeywords.tags.map((row) => row.tag)).toContain('Claude');
    expect(unusedKeywords.tags.map((row) => row.tag)).not.toContain(
      'grant reports',
    );
  });

  it('AC-24.4/.8: applies source/mode/video/category/tag filters and excludes team by default', () => {
    const records = [
      search(),
      record(2),
      record(3, { searchId: uuid(33), src: 'team' }),
      record(4, {
        searchId: uuid(44),
        mode: 'topic',
        recommendationEngine: undefined,
        llmFallbackReason: undefined,
        src: 'email',
        youtubeId: catalog.items[1].youtubeId,
      }),
    ];
    expect(video(run(records)).appearances).toBe(1);
    expect(
      video(run(records, { ...window, includeTeam: true })).appearances,
    ).toBe(2);
    const email = run(records, {
      ...window,
      source: 'email',
      mode: 'topic',
      category: 'tool',
      tag: 'Excel',
    });
    expect(email.videos).toHaveLength(1);
    expect(video(email, 1).appearances).toBe(1);
    expect(email.tags).toHaveLength(1);
    expect(
      run(records, {
        ...window,
        youtubeId: catalog.items[1].youtubeId,
      }).tags.every((row) => row.searches === 0),
    ).toBe(true);
    expect(
      run(records, { ...window, source: 'team' }).videos.every(
        (row) => row.appearances === 0,
      ),
    ).toBe(true);
  });

  it('AC-24.8: uses receivedAt, handles NY midnight and DST, and deduplicates before date filtering', () => {
    expect(newYorkDate('2026-10-21T03:59:59Z')).toBe('2026-10-20');
    expect(newYorkDate('2026-10-21T04:00:00Z')).toBe('2026-10-21');
    expect(newYorkDate('2026-11-01T05:30:00Z')).toBe('2026-11-01');
    expect(newYorkDate('2026-11-01T06:30:00Z')).toBe('2026-11-01');
    const original = record(1, {}, '2026-10-21T03:59:59Z');
    const rerender = record(2, {}, '2026-10-21T04:00:00Z');
    expect(video(run([rerender, original])).appearances).toBe(1);
    expect(
      video(
        run([rerender, original], {
          startDate: '2026-10-21',
          endDate: '2026-10-21',
        }),
      ).appearances,
    ).toBe(0);
  });

  it('AC-24.3: maps historical tags against snapshots and flags missing versions without guessing', () => {
    const oldVersion = `sha256:${'1'.repeat(64)}`;
    const old = parsePublicCatalog({
      ...catalog,
      catalogVersion: oldVersion,
      items: catalog.items.map((item, index) =>
        index ? item : { ...item, tasks: ['budget tracking'] },
      ),
    });
    const events = [record(1, { catalogVersion: oldVersion })];
    const mapped = buildAnalyticsReport({
      records: events,
      current: catalog,
      snapshots: [old],
      filter: window,
    });
    expect(task(mapped, 'budget tracking').appearances).toBe(1);
    expect(task(mapped).appearances).toBe(0);
    const missing = run(events);
    expect(video(missing).appearances).toBe(1);
    expect(task(missing).appearances).toBe(0);
    expect(missing.diagnostics.unmappedEvents).toBe(1);
    expect(missing.associations).toEqual([]);
    const filtered = buildAnalyticsReport({
      records: events,
      current: catalog,
      snapshots: [old],
      filter: { ...window, category: 'task', tag: 'budget tracking' },
    });
    expect(video(filtered).appearances).toBe(1);
  });

  it('AC-24.7/.10: separates direct views/clicks and unjoinable activity from keyword attribution', () => {
    const direct = {
      mode: 'direct',
      matchType: 'direct',
      recommendationEngine: undefined,
      llmFallbackReason: undefined,
      searchId: uuid(99),
    };
    const report = run([
      record(1),
      record(2, { ...direct }),
      record(3, { ...direct, type: 'click', target: 'youtube' }),
    ]);
    expect(video(report)).toMatchObject({
      appearances: 1,
      directViews: 1,
      directYoutubeClicks: 1,
      youtubeClicks: 0,
    });
    expect(report.associations).toEqual([]);
    expect(report.diagnostics.unattributedEvents).toBe(3);
    expect(JSON.stringify(report)).not.toContain('percentWatched');
  });

  it('AC-24.9/.10: search context crosses the reporting boundary without counting that search in the new period', () => {
    const report = run([search(1, {}, '2026-10-20T03:59:59Z'), record(2)]);
    expect(task(report).searches).toBe(0);
    expect(report.associations).toHaveLength(3);
    const otherSession = run([search(), record(2, { sessionId: uuid(98) })]);
    expect(otherSession.associations).toEqual([]);
    const otherSource = run([search(), record(2, { src: 'pilot' })]);
    expect(otherSource.associations).toEqual([]);
  });

  it('AC-24.9: canonical keywords are counted once per submission even with no results', () => {
    const report = run([
      search(1, { resultCount: 0, strongMatchCount: 0 }),
      search(2, { resultCount: 0, strongMatchCount: 0 }),
      search(3, {
        searchId: uuid(88),
        functionArea: null,
        tools: [],
        tasks: [],
        resultCount: 0,
        strongMatchCount: 0,
      }),
    ]);
    expect(task(report).searches).toBe(1);
    expect(report.videos.every((row) => row.appearances === 0)).toBe(true);
    expect(report.associations).toEqual([]);
  });

  it('rejects conflicting IDs, invalid catalog references and malformed filters rather than publishing wrong totals', () => {
    expect(() =>
      run([record(1), record(1, { youtubeId: catalog.items[1].youtubeId })]),
    ).toThrow('Conflicting event IDs');
    expect(() =>
      run([search(), search(2, { tasks: ['budget tracking'] })]),
    ).toThrow('Conflicting search context');
    expect(() =>
      run([search(1, { tasks: ['synthetic unapproved tag'] })]),
    ).toThrow('Invalid event catalog reference');
    expect(() =>
      run([], { startDate: '2026-10-22', endDate: '2026-10-20' }),
    ).toThrow();
    expect(() => run([], { ...window, tag: 'ChatGPT' })).toThrow();
  });
});
