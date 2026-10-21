import { describe, expect, it } from 'vitest';
import catalogFixtureRaw from '../../fixtures/catalog.json';
import { CatalogItemSchema } from '../contracts/catalogItem';
import type { CatalogItem } from '../contracts/catalogItem';
import { FUNCTION_AREAS } from '../contracts/functionAreas';
import type { IntakeProfile } from '../contracts/intakeProfile';
import type { RankedMatch } from '../contracts/rankedMatch';
import { rank } from './rank';

const fixtureCatalog: CatalogItem[] = catalogFixtureRaw.map((row) =>
  CatalogItemSchema.parse(row),
);

function byId(youtubeId: string) {
  return (match: RankedMatch) => match.item.youtubeId === youtubeId;
}

function profile(overrides: Partial<IntakeProfile>): IntakeProfile {
  return { functionArea: null, goalWords: [], tools: [], ...overrides };
}

describe('rank', () => {
  it('AC-11.1: rank is pure — identical inputs produce deeply equal results', () => {
    const p = profile({
      functionArea: 'Fundraising',
      goalWords: ['grant', 'reports'],
      tools: ['ChatGPT'],
    });
    expect(rank(fixtureCatalog, p)).toEqual(rank(fixtureCatalog, p));
  });

  it('AC-11.1: rank does not mutate the catalog or profile inputs', () => {
    const catalogSnapshot = JSON.parse(JSON.stringify(fixtureCatalog));
    const p = profile({
      functionArea: 'Operations',
      goalWords: ['budget'],
      tools: ['Excel'],
    });
    const profileSnapshot = JSON.parse(JSON.stringify(p));

    rank(fixtureCatalog, p);

    expect(fixtureCatalog).toEqual(catalogSnapshot);
    expect(p).toEqual(profileSnapshot);
  });

  it('AC-11.2: in-area video outranks out-of-area video', () => {
    const result = rank(
      fixtureCatalog,
      profile({ functionArea: 'Fundraising' }),
    );
    expect(result.findIndex(byId('fx01GrntRpt'))).toBeLessThan(
      result.findIndex(byId('fx03BdgtXls')),
    );
  });

  it('AC-11.3: within an area, a task match outranks a tool-only match', () => {
    const result = rank(
      fixtureCatalog,
      profile({
        functionArea: 'Fundraising',
        goalWords: ['donor', 'emails'],
        tools: ['ChatGPT'],
      }),
    );
    expect(result.findIndex(byId('fx02DonrEml'))).toBeLessThan(
      result.findIndex(byId('fx01GrntRpt')),
    );
  });

  it('AC-11.4: an exact tool match outranks an adjacent tool match', () => {
    const result = rank(
      fixtureCatalog,
      profile({
        functionArea: 'Operations',
        goalWords: ['budget', 'tracking'],
        tools: ['Excel'],
      }),
    );
    expect(result.findIndex(byId('fx03BdgtXls'))).toBeLessThan(
      result.findIndex(byId('fx04BdgtSht')),
    );
  });

  it('AC-11.5: tied videos rank by newer addedAt', () => {
    const result = rank(
      fixtureCatalog,
      profile({ functionArea: 'Fundraising' }),
    );
    // fx13 (2026-10-01) and fx02 (2026-09-05) tie on area/task/tool/isStartHere.
    expect(result.findIndex(byId('fx13GrntTrk'))).toBeLessThan(
      result.findIndex(byId('fx02DonrEml')),
    );
  });

  it('AC-11.5: fully tied videos fall back to youtubeId ascending', () => {
    const result = rank(
      fixtureCatalog,
      profile({
        functionArea: 'Operations',
        goalWords: ['budget', 'tracking'],
      }),
    );
    // fx03 and fx04 tie on area/task/tool(none, no tool given)/isStartHere/addedAt.
    expect(result.findIndex(byId('fx03BdgtXls'))).toBeLessThan(
      result.findIndex(byId('fx04BdgtSht')),
    );
  });

  it('AC-11.5: top-N dedupe keeps at most one video per task and demotes the rest, without dropping them', () => {
    const result = rank(
      fixtureCatalog,
      profile({
        functionArea: 'Operations',
        goalWords: ['budget', 'tracking'],
      }),
      { topN: 3 },
    );

    const topThreeTasks = result
      .slice(0, 3)
      .map((match) => match.item.tasks[0]);
    const budgetTrackingCount = topThreeTasks.filter(
      (task) => task === 'budget tracking',
    ).length;
    expect(budgetTrackingCount).toBeLessThanOrEqual(1);

    const allIds = result.map((match) => match.item.youtubeId);
    expect(allIds).toContain('fx03BdgtXls');
    expect(allIds).toContain('fx04BdgtSht');
    expect(allIds).toContain('fx14BdgtNtn');
  });

  it("AC-11.6: a pick's reason names the area and task", () => {
    const result = rank(
      fixtureCatalog,
      profile({
        functionArea: 'Fundraising',
        goalWords: ['grant', 'reports'],
        tools: ['ChatGPT'],
      }),
    );
    const pick = result.find(byId('fx01GrntRpt'));
    expect(pick?.reason).toBe('In Fundraising, about grant reports');
    expect(pick?.matchType).toBe('strong');
  });

  it('AC-11.8: an empty catalog returns an empty array', () => {
    expect(rank([], profile({}))).toEqual([]);
  });

  it('AC-11.8: a catalog where nothing is eligible (all retired) returns an empty array', () => {
    const retiredOnly = fixtureCatalog.filter(
      (video) => video.status === 'retired',
    );
    expect(retiredOnly.length).toBeGreaterThan(0);
    expect(rank(retiredOnly, profile({}))).toEqual([]);
  });

  it("AC-12.1: a synonym widens a goal word to match a video's task/title text it doesn't literally contain", () => {
    const result = rank(fixtureCatalog, profile({ goalWords: ['slides'] }));
    expect(result[0]?.item.youtubeId).toBe('fx07BrdDeck');
  });

  it('AC-12.3: an unmapped tool matches its adjacent tool and is marked accordingly', () => {
    const result = rank(fixtureCatalog, profile({ tools: ['Claude Design'] }));
    const pick = result.find(byId('fx05VolOnbd'));
    expect(pick?.matchType).toBe('strong');
    expect(pick?.reason).toBe('Made with Claude, close to Claude Design');
  });

  it('AC-12.3: tools in the same AI-assistant group rank above tools with no relation, marked as adjacent', () => {
    const result = rank(fixtureCatalog, profile({ tools: ['ChatGPT'] }));
    expect(result.findIndex(byId('fx05VolOnbd'))).toBeLessThan(
      result.findIndex(byId('fx03BdgtXls')),
    );
    const pick = result.find(byId('fx05VolOnbd'));
    expect(pick?.matchType).toBe('strong');
    expect(pick?.reason).toContain('close to ChatGPT');
  });

  it('AC-13.1: a "Not sure" function area ranks by task and tool alone', () => {
    const result = rank(
      fixtureCatalog,
      profile({ functionArea: null, goalWords: ['impact'] }),
    );
    expect(result[0]?.item.youtubeId).toBe('fx06ImpctRp');
  });

  it('AC-13.2: no relevant match in the chosen area falls back to the best task/tool match from other areas, marked as fallback', () => {
    const result = rank(
      fixtureCatalog,
      profile({
        functionArea: 'Fundraising',
        goalWords: ['volunteer', 'onboarding'],
      }),
    );
    expect(result[0]?.item.youtubeId).toBe('fx05VolOnbd');
    expect(result[0]?.matchType).toBe('fallback');
    expect(result[0]?.reason).toBe(
      "No Fundraising video on this yet. This one's from Programs & Direct Service, about volunteer onboarding.",
    );
  });

  it('AC-13.2: a function area with zero videos at all also falls back the same way', () => {
    const result = rank(
      fixtureCatalog,
      profile({
        functionArea: 'Marketing',
        goalWords: ['volunteer', 'onboarding'],
      }),
    );
    expect(result[0]?.item.youtubeId).toBe('fx05VolOnbd');
    expect(result[0]?.matchType).toBe('fallback');
  });

  it('AC-13.3: no match anywhere falls back to the start-here set, marked as fallback', () => {
    const result = rank(
      fixtureCatalog,
      profile({
        functionArea: 'Marketing',
        goalWords: ['zzznonsense'],
        tools: ['NoSuchTool'],
      }),
    );
    expect(result[0]?.item.youtubeId).toBe('fx01GrntRpt');
    expect(result[0]?.matchType).toBe('fallback');
    expect(result[0]?.reason).toBe('A good place to start.');
  });

  it('AC-13.4: an untagged video still matches on title and description', () => {
    const result = rank(
      fixtureCatalog,
      profile({ functionArea: null, goalWords: ['orientation'] }),
    );
    expect(result[0]?.item.youtubeId).toBe('fx09IntroCt');
    expect(result[0]?.reason).toBe('About orientation');
  });

  it('AC-13.5: sample-shaped and nonsense profiles always return at least two picks', () => {
    const profiles: IntakeProfile[] = [
      profile({
        functionArea: 'Fundraising',
        goalWords: ['grant'],
        tools: ['ChatGPT'],
      }),
      profile({ functionArea: null, goalWords: [], tools: [] }),
      profile({
        functionArea: 'Marketing',
        goalWords: ['zzznonsense'],
        tools: ['NoSuchTool'],
      }),
      profile({
        functionArea: 'Leadership',
        goalWords: ['qwertyuiop'],
        tools: [],
      }),
    ];
    for (const p of profiles) {
      expect(rank(fixtureCatalog, p).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('a retired video never appears in results', () => {
    const profiles: IntakeProfile[] = [
      profile({
        functionArea: 'Operations',
        goalWords: ['CRM', 'cleanup'],
        tools: ['ChatGPT'],
      }),
      profile({ functionArea: null, goalWords: [], tools: [] }),
      profile({ functionArea: 'Marketing', goalWords: [], tools: [] }),
    ];
    for (const p of profiles) {
      expect(rank(fixtureCatalog, p).some(byId('fx10CrmClup'))).toBe(false);
    }
  });

  it('every result carries a non-empty reason', () => {
    const profiles: IntakeProfile[] = [
      profile({
        functionArea: 'Fundraising',
        goalWords: ['grant'],
        tools: ['ChatGPT'],
      }),
      profile({ functionArea: null, goalWords: [], tools: [] }),
      profile({
        functionArea: 'Marketing',
        goalWords: ['zzznonsense'],
        tools: [],
      }),
    ];
    for (const p of profiles) {
      for (const match of rank(fixtureCatalog, p)) {
        expect(match.reason.length).toBeGreaterThan(0);
      }
    }
  });

  it('rank never returns an empty list while the active catalog is non-empty', () => {
    const profiles: IntakeProfile[] = [
      profile({
        functionArea: 'Marketing',
        goalWords: ['zzznonsense'],
        tools: ['NoSuchTool'],
      }),
      profile({ functionArea: null, goalWords: ['qwertyuiop'], tools: [] }),
    ];
    for (const p of profiles) {
      expect(rank(fixtureCatalog, p).length).toBeGreaterThan(0);
    }
  });

  it('no reason ever mentions an undefined tool', () => {
    const areas: (string | null)[] = [...FUNCTION_AREAS, null];
    const extras: Partial<IntakeProfile>[] = [
      {},
      { goalWords: ['grant', 'reports'] },
      { tools: ['ChatGPT'] },
      { goalWords: ['zzznonsense'], tools: ['NoSuchTool'] },
    ];
    for (const functionArea of areas) {
      for (const extra of extras) {
        const p = profile({ functionArea, ...extra });
        for (const match of rank(fixtureCatalog, p, {
          topN: fixtureCatalog.length,
        })) {
          expect(match.reason).not.toContain('undefined');
        }
      }
    }
  });
});
