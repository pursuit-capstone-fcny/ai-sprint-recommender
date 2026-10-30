import { describe, it, expect } from 'vitest';
import { dashboardDemo } from '../../fixtures/dashboard-demo';
import {
  DashboardFiltersSchema,
  queryDashboard,
  type DashboardFilters,
} from './query';
import { DashboardSnapshotSchema } from './snapshot';
const filter: DashboardFilters = {
  startDate: '2026-10-01',
  endDate: '2026-10-29',
  source: 'all',
  mode: 'all',
  includeTeam: false,
  includeHistorical: false,
  query: '',
  category: 'all',
  tag: '',
  activity: 'all',
};
describe('private dashboard queries', () => {
  it('retains zero inventory when the selected date or source has no events', () => {
    const rows = queryDashboard(dashboardDemo.facts, 'video', {
      ...filter,
      startDate: '2026-10-29',
    });
    expect(rows).toHaveLength(38);
    expect(rows.every((r) => r.appearances === 0)).toBe(true);
    expect(
      queryDashboard(dashboardDemo.facts, 'video', {
        ...filter,
        source: 'email',
      }).every((r) => r.appearances === 0),
    ).toBe(true);
  });
  it('distinguishes zero appearances, appearances without clicks, and zero keyword searches', () => {
    expect(
      queryDashboard(dashboardDemo.facts, 'video', {
        ...filter,
        activity: 'zero-appearances',
      }),
    ).toHaveLength(10);
    const shown = queryDashboard(dashboardDemo.facts, 'video', {
      ...filter,
      activity: 'no-clicks',
    });
    expect(shown.length).toBeGreaterThan(0);
    expect(
      shown.every(
        (r) => r.appearances > 0 && r.embedClicks + r.youtubeClicks === 0,
      ),
    ).toBe(true);
    expect(
      queryDashboard(dashboardDemo.facts, 'tag', {
        ...filter,
        activity: 'zero-searches',
      }).map((r) => r.tag),
    ).toEqual(['Claude']);
  });
  it('filters canonical categories and associations without adding keyword counts to video totals', () => {
    const association = queryDashboard(dashboardDemo.facts, 'association', {
      ...filter,
      query: 'demo0000001',
      category: 'tool',
      tag: 'ChatGPT',
    });
    expect(association).toHaveLength(1);
    expect(association[0].appearances).toBe(39);
    expect(
      queryDashboard(dashboardDemo.facts, 'tag', {
        ...filter,
        category: 'task',
      }),
    ).toEqual([]);
  });
  it('excludes team and historical activity by default and keeps direct views separate', () => {
    const base = dashboardDemo.facts.find(
      (f) => f.entity === 'video' && f.dateKey > 0,
    )!;
    const facts = [
      { ...base, source: 'team' as const },
      {
        ...base,
        source: 'pilot' as const,
        mode: 'direct' as const,
        appearances: 0,
        directViews: 4,
      },
      { ...base, youtubeId: 'retired0001x', activeInventory: false },
    ];
    const rows = queryDashboard(facts, 'video', filter);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ appearances: 0, directViews: 4 });
    expect(
      queryDashboard(facts, 'video', { ...filter, includeTeam: true })[0]
        .appearances,
    ).toBe(base.appearances);
    expect(
      queryDashboard(facts, 'video', { ...filter, includeHistorical: true }),
    ).toHaveLength(2);
  });
  it('rejects invalid filters, raw-event fields and duplicate facts', () => {
    expect(
      DashboardFiltersSchema.safeParse({ ...filter, startDate: '2026-11-01' })
        .success,
    ).toBe(false);
    expect(
      DashboardSnapshotSchema.safeParse({
        ...dashboardDemo,
        rawGoal: 'synthetic private input',
      }).success,
    ).toBe(false);
    expect(
      DashboardSnapshotSchema.safeParse({
        ...dashboardDemo,
        facts: [dashboardDemo.facts[0], dashboardDemo.facts[0]],
      }).success,
    ).toBe(false);
    expect(
      DashboardSnapshotSchema.safeParse({ ...dashboardDemo, state: 'error' })
        .success,
    ).toBe(false);
  });
});
