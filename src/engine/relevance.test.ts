import { describe, expect, it } from 'vitest';
import type { CatalogItem } from '../contracts/catalogItem';
import type { IntakeProfile } from '../contracts/intakeProfile';
import { rank } from './rank';
import { taskRelevance } from './relevance';

function item(overrides: Partial<CatalogItem>): CatalogItem {
  return {
    youtubeId: 'fictional01',
    title: '[Fixture] General guide',
    description: 'Fictional public catalog example.',
    functionAreas: ['Operations'],
    tasks: [],
    tools: ['ChatGPT'],
    addedAt: null,
    status: 'active',
    isStartHere: false,
    ...overrides,
  };
}
const profile: IntakeProfile = {
  functionArea: 'Operations',
  goalWords: ['use', 'attendance'],
  tools: ['ChatGPT'],
};

describe('task relevance within ranking tiers', () => {
  it('ranks a specific task above a generic shared word before start-here and date tiebreaks', () => {
    const general = item({
      youtubeId: 'fictional01',
      title: '[Fixture] Use AI',
      isStartHere: true,
      addedAt: '2026-10-01',
    });
    const specific = item({
      youtubeId: 'fictional02',
      title: '[Fixture] Use attendance records',
      addedAt: '2025-01-01',
    });
    expect(rank([general, specific], profile)[0].item.youtubeId).toBe(
      specific.youtubeId,
    );
  });

  it('weights a distinguishing concept above one shared by most catalog items', () => {
    const common = item({
      youtubeId: 'fictional01',
      title: '[Fixture] Create',
      isStartHere: true,
    });
    const distinguishing = item({
      youtubeId: 'fictional02',
      title: '[Fixture] Reconcile',
    });
    const background = item({
      youtubeId: 'fictional03',
      title: '[Fixture] Create',
    });
    expect(
      rank([common, distinguishing, background], {
        ...profile,
        goalWords: ['create', 'reconcile'],
      })[0].item.youtubeId,
    ).toBe(distinguishing.youtubeId);
  });

  it('uses a title or canonical task as stronger evidence than incidental description text', () => {
    const incidental = item({
      youtubeId: 'fictional01',
      description: 'Fictional guide mentioning attendance.',
      isStartHere: true,
    });
    const direct = item({ youtubeId: 'fictional02', tasks: ['attendance'] });
    expect(
      rank([incidental, direct], { ...profile, goalWords: ['attendance'] })[0]
        .item.youtubeId,
    ).toBe(direct.youtubeId);
  });

  it('does not reward repeated query words, multiple synonyms for one concept, or keyword repetition', () => {
    const first = item({
      youtubeId: 'fictional01',
      title: '[Fixture] Deck design',
    });
    const second = item({
      youtubeId: 'fictional02',
      description: 'Fictional presentation guide.',
    });
    const single = { ...profile, goalWords: ['deck'] };
    const repeated = {
      ...profile,
      goalWords: ['deck', 'deck', 'presentation', 'slides'],
    };
    expect(rank([first, second], repeated)).toEqual(
      rank([first, second], single),
    );
    const stuffed = {
      ...second,
      description: `${second.description} presentation presentation presentation`,
    };
    expect(taskRelevance([first, stuffed], single.goalWords)).toEqual(
      taskRelevance([first, second], single.goalWords),
    );
  });

  it('preserves area before task relevance and task relevance before tool preference', () => {
    const general = item({
      youtubeId: 'fictional01',
      title: '[Fixture] Use AI',
      tools: ['ChatGPT'],
    });
    const specific = item({
      youtubeId: 'fictional02',
      title: '[Fixture] Use attendance records',
      tools: ['Claude'],
    });
    expect(rank([general, specific], profile)[0].item.youtubeId).toBe(
      specific.youtubeId,
    );
    expect(
      rank(
        [general, { ...specific, functionAreas: ['Fundraising'] }],
        profile,
      )[0].item.youtubeId,
    ).toBe(general.youtubeId);
  });

  it('preserves exact-tool preference when task evidence ties', () => {
    const exact = item({
      youtubeId: 'fictional01',
      title: '[Fixture] Attendance',
      tools: ['ChatGPT'],
    });
    const adjacent = item({
      youtubeId: 'fictional02',
      title: exact.title,
      tools: ['Claude'],
      addedAt: '2026-10-01',
      isStartHere: true,
    });
    expect(rank([adjacent, exact], profile)[0].item.youtubeId).toBe(
      exact.youtubeId,
    );
  });

  it('is deterministic across catalog order and ignores retired rows in relevance statistics', () => {
    const first = item({ youtubeId: 'fictional01', title: '[Fixture] Use AI' });
    const second = item({
      youtubeId: 'fictional02',
      title: '[Fixture] Attendance',
    });
    const retired = item({
      youtubeId: 'fictional03',
      title: second.title,
      status: 'retired',
    });
    const expected = rank([first, second], profile);
    expect(rank([second, first], profile)).toEqual(expected);
    expect(rank([first, second, retired], profile)).toEqual(expected);
  });
});
