import { describe, expect, it } from 'vitest';
import { expandedCatalog } from '../../fixtures/expanded-catalog';
import type { RankedMatch } from '../contracts/rankedMatch';
import { scoreDisplayedResults } from './displayedResults';
import {
  selectRulesResults,
  selectRecommendations,
} from '../recommendations/selectRecommendations';
import { expandedPublicCatalog } from '../../fixtures/expanded-catalog';

const results: RankedMatch[] = expandedCatalog.map((item) => ({
  item,
  reason: 'Fixture recommendation',
  matchType: 'semantic',
}));
const judgments = { ideal: [results[3].item], good: [results[4].item] };

describe('AC-83.6 displayed result scoring', () => {
  it('scores final rules and model selections after capping and fallback filling', () => {
    const profile = {
      functionArea: null,
      goalWords: ['zzznonsense'],
      tools: [],
    };
    const rules = selectRulesResults(expandedCatalog, profile);
    const model = selectRecommendations(
      expandedCatalog,
      profile,
      expandedPublicCatalog.catalogVersion,
      {
        outcome: 'success',
        youtubeIds: expandedCatalog.slice(0, 2).map((item) => item.youtubeId),
        catalogVersion: expandedPublicCatalog.catalogVersion,
        modelVersion: 'fixture-model',
        promptVersion: 'fixture-prompt',
      },
    );
    for (const displayed of [rules, model.results]) {
      const score = scoreDisplayedResults(judgments, displayed);
      expect(score.expanded.count).toBe(6);
      expect(score.expanded.displayedIds).toEqual(
        displayed.map(({ item }) => item.youtubeId),
      );
      expect(score.expanded.qualityApproval).toBe('pending-client-review');
    }
  });
  it('scores every displayed card without changing the top-three score', () => {
    const score = scoreDisplayedResults(judgments, results.slice(0, 8));
    expect(score.topThree).toMatchObject({ hits: 0, misses: 3, passed: false });
    expect(score.topThree).toEqual(
      scoreDisplayedResults(judgments, results.slice(0, 3)).topThree,
    );
    expect(score.expanded.count).toBe(8);
    expect(score.expanded.knownGoodIds).toEqual([
      results[3].item.youtubeId,
      results[4].item.youtubeId,
    ]);
    expect(score.expanded.unreviewedIds).toHaveLength(6);
    expect(score.expanded.qualityApproval).toBe('pending-client-review');
    // Expansion is scored in full, rather than silently truncating to eight.
    expect(scoreDisplayedResults(judgments, results).expanded.count).toBe(
      results.length,
    );
  });

  it('counts missing top-three slots as misses and never invents full-set labels', () => {
    const one = scoreDisplayedResults(judgments, [results[3]]);
    expect(one.topThree).toMatchObject({ hits: 1, misses: 2, passed: false });
    expect(one.expanded.unreviewedIds).toEqual([]);
    expect(scoreDisplayedResults(judgments, []).topThree.misses).toBe(3);
  });

  it('rejects duplicate and retired cards instead of inflating the score', () => {
    expect(() =>
      scoreDisplayedResults(judgments, [results[3], results[3]]),
    ).toThrow('distinct IDs');
    expect(() =>
      scoreDisplayedResults(judgments, [
        {
          ...results[3],
          item: { ...results[3].item, status: 'retired' },
        },
      ]),
    ).toThrow('active');
  });
});
