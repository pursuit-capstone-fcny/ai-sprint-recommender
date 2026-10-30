import { describe, expect, it } from 'vitest';
import {
  expandedCatalog,
  expandedPublicCatalog,
} from '../../fixtures/expanded-catalog';
import {
  selectRecommendations,
  selectRulesResults,
} from './selectRecommendations';

const profile = { functionArea: 'Operations', goalWords: [], tools: [] };
const noMatch = { functionArea: null, goalWords: ['zzznonsense'], tools: [] };
const response = (count: number) => ({
  outcome: 'success',
  youtubeIds: expandedCatalog.slice(0, count).map((item) => item.youtubeId),
  catalogVersion: expandedPublicCatalog.catalogVersion,
  modelVersion: 'fixture-model',
  promptVersion: 'fixture-prompt',
});

describe('spec 83 result policy', () => {
  it.each(Array.from({ length: 11 }, (_, index) => index))(
    'shows up to eight matches and fills to six when %i rules matches exist',
    (count) => {
      const catalog = expandedCatalog.map((item, index) => ({
        ...item,
        functionAreas: index < count ? ['Operations'] : ['Fundraising'],
      }));
      const results = selectRulesResults(catalog, profile);
      expect(results).toHaveLength(Math.max(6, Math.min(8, count)));
      expect(
        results.filter((match) => match.matchType === 'strong'),
      ).toHaveLength(Math.min(count, 8));
      expect(
        results.slice(count).every((match) => match.matchType === 'fallback'),
      ).toBe(true);
      expect(new Set(results.map(({ item }) => item.youtubeId)).size).toBe(
        results.length,
      );
    },
  );

  it.each([0, 1, 2, 3, 4, 5])(
    'shows an honest smaller active catalog of %i videos',
    (count) => {
      const results = selectRulesResults(
        expandedCatalog.slice(0, count),
        noMatch,
      );
      expect(results).toHaveLength(count);
      expect(results.every((match) => match.matchType === 'fallback')).toBe(
        true,
      );
    },
  );

  it.each([2, 3, 4, 5, 6, 7, 8, 9, 10])(
    'uses the same cap and fallback minimum for %i validated model picks',
    (count) => {
      const selected = selectRecommendations(
        expandedCatalog,
        noMatch,
        expandedPublicCatalog.catalogVersion,
        response(count),
      );
      expect(selected.recommendationEngine).toBe('llm');
      expect(selected.results).toHaveLength(Math.max(6, Math.min(8, count)));
      expect(
        selected.results
          .slice(0, count)
          .every((match) => match.matchType === 'semantic'),
      ).toBe(true);
      expect(
        selected.results
          .slice(count)
          .every((match) => match.matchType === 'fallback'),
      ).toBe(true);
      expect(
        new Set(selected.results.map(({ item }) => item.youtubeId)).size,
      ).toBe(selected.results.length);
    },
  );

  it('excludes all duplicate catalog IDs and retired rows in rules and model selections', () => {
    const catalog = [
      ...expandedCatalog,
      { ...expandedCatalog[0], status: 'retired' as const },
    ];
    const rules = selectRulesResults(catalog, profile);
    expect(
      rules.some(({ item }) => item.youtubeId === expandedCatalog[0].youtubeId),
    ).toBe(false);
    const selected = selectRecommendations(
      catalog,
      noMatch,
      expandedPublicCatalog.catalogVersion,
      response(3),
    );
    expect(selected.recommendationEngine).toBe('rules');
    expect(selected.llmFallbackReason).toBe('invalid-response');
    expect(selected.results).toHaveLength(6);
    expect(selected.results.every(({ item }) => item.status === 'active')).toBe(
      true,
    );
  });

  it('fills empty-model and timeout results from the same fallback policy', () => {
    for (const value of [
      response(0),
      { outcome: 'fallback', reason: 'timeout' },
    ]) {
      const selected = selectRecommendations(
        expandedCatalog,
        noMatch,
        expandedPublicCatalog.catalogVersion,
        value,
      );
      expect(selected.recommendationEngine).toBe('rules');
      expect(selected.results).toHaveLength(6);
      expect(
        selected.results.every((match) => match.matchType === 'fallback'),
      ).toBe(true);
      expect(selected.results.some(({ item }) => item.isStartHere)).toBe(true);
    }
  });
});
