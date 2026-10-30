import { describe, expect, it } from 'vitest';
import fixture from '../../fixtures/public-catalog.json';
import { toCatalogItem } from '../contracts/catalogItem';
import { parsePublicCatalog } from '../contracts/publicCatalog';
import {
  selectRecommendations,
  selectRulesResults,
} from './selectRecommendations';

const envelope = parsePublicCatalog(fixture);
const catalog = envelope.items.map(toCatalogItem);
const profile = {
  functionArea: null,
  goalWords: ['unmatched-semantic-goal'],
  tools: [],
};
const success = {
  outcome: 'success',
  youtubeIds: ['fx04BdgtSht', 'fx03BdgtXls', 'fx09IntroCt', 'fx01GrntRpt'],
  catalogVersion: envelope.catalogVersion,
  modelVersion: 'fixture-model',
  promptVersion: 'fixture-prompt',
};
const select = (response: unknown) =>
  selectRecommendations(catalog, profile, envelope.catalogVersion, response);

describe('final recommendation selection', () => {
  it('keeps semantic picks without a keyword match, applies task dedupe and uses catalog-only content', () => {
    const selected = select(success);
    expect(selected.recommendationEngine).toBe('llm');
    expect(selected.results.map(({ item }) => item.youtubeId)).toEqual([
      'fx04BdgtSht',
      'fx03BdgtXls',
      'fx01GrntRpt',
      'fx09IntroCt',
    ]);
    expect(
      selected.results.every(
        (match) => match.reason === 'Suggested for your goal',
      ),
    ).toBe(true);
    expect(selected.results[0].item).toBe(catalog[2]);
  });
  it('rejects nine model picks and caps rules results even when more are requested', () => {
    const candidates = Array.from({ length: 9 }, (_, index) => ({
      ...catalog[index % catalog.length],
      youtubeId: `bound00000${index}`,
      status: 'active' as const,
    }));
    expect(
      selectRecommendations(candidates, profile, envelope.catalogVersion, {
        ...success,
        youtubeIds: candidates.map((item) => item.youtubeId),
      }).llmFallbackReason,
    ).toBe('invalid-response');
    expect(
      selectRulesResults(
        candidates,
        { functionArea: null, goalWords: [], tools: [] },
        100,
      ),
    ).toHaveLength(8);
  });
  it('labels cross-area selections without claiming that the catalog lacks an in-area video', () => {
    const selected = selectRecommendations(
      catalog,
      { ...profile, functionArea: 'Fundraising' },
      envelope.catalogVersion,
      success,
    );
    expect(selected.results[0].matchType).toBe('cross-area');
    expect(selected.results[0].reason).toBe(
      'Suggested for your goal. From Operations',
    );
    expect(selected.results[2].reason).toBe('In Fundraising');
  });
  it('uses verified task/tool tags for reasons', () => {
    const selected = selectRecommendations(
      catalog,
      { ...profile, goalWords: ['budget'], tools: ['Sheets'] },
      envelope.catalogVersion,
      success,
    );
    expect(selected.results[0].reason).toBe(
      'About budget tracking. Made with Sheets',
    );
  });
  it.each([
    [
      'duplicates',
      { ...success, youtubeIds: ['fx04BdgtSht', 'fx04BdgtSht'] },
      'invalid-response',
    ],
    [
      'unknown ID',
      { ...success, youtubeIds: ['unknown0000', 'fx01GrntRpt'] },
      'invalid-response',
    ],
    [
      'extra model content',
      { ...success, reasons: ['untrusted'] },
      'invalid-response',
    ],
    [
      'wrong version',
      { ...success, catalogVersion: `sha256:${'0'.repeat(64)}` },
      'catalog-mismatch',
    ],
    ['empty response', { ...success, youtubeIds: [] }, 'insufficient-results'],
    [
      'one pick',
      { ...success, youtubeIds: ['fx01GrntRpt'] },
      'insufficient-results',
    ],
    [
      'only one distinct task',
      { ...success, youtubeIds: ['fx04BdgtSht', 'fx03BdgtXls'] },
      'insufficient-results',
    ],
    ['disabled', { outcome: 'fallback', reason: 'disabled' }, 'disabled'],
  ])('uses complete rules results for %s', (_, response, reason) => {
    const selected = select(response);
    expect(selected.recommendationEngine).toBe('rules');
    expect(selected.llmFallbackReason).toBe(reason);
    expect(selected.results).toEqual(selectRulesResults(catalog, profile));
  });
  it('keeps three distinct videos across two primary tasks instead of truncating to two cards', () => {
    const selected = select({
      ...success,
      youtubeIds: ['fx04BdgtSht', 'fx03BdgtXls', 'fx01GrntRpt'],
    });
    expect(selected.recommendationEngine).toBe('llm');
    expect(selected.results.map(({ item }) => item.youtubeId)).toEqual([
      'fx04BdgtSht',
      'fx03BdgtXls',
      'fx01GrntRpt',
    ]);
  });
  it.each([
    ['two untagged picks', [[], []]],
    ['an untagged pick before one task', [[], ['budget tracking']]],
    ['an untagged pick after one task', [['budget tracking'], []]],
    [
      'different secondary tasks under the same primary task',
      [
        ['budget tracking', 'grant reports'],
        ['budget tracking', 'meeting notes'],
      ],
    ],
  ])('uses complete rules results for %s', (_, tasks) => {
    const candidates = catalog.slice(0, 2).map((item, index) => ({
      ...item,
      tasks: tasks[index],
    }));
    const selected = selectRecommendations(
      candidates,
      profile,
      envelope.catalogVersion,
      { ...success, youtubeIds: candidates.map((item) => item.youtubeId) },
    );
    expect(selected.recommendationEngine).toBe('rules');
    expect(selected.llmFallbackReason).toBe('insufficient-results');
    expect(selected.results).toEqual(selectRulesResults(candidates, profile));
  });
  it('preserves an untagged pick and remaining picks when two primary tasks are present', () => {
    const youtubeIds = [
      'fx09IntroCt',
      'fx04BdgtSht',
      'fx01GrntRpt',
      'fx03BdgtXls',
    ];
    const selected = select({ ...success, youtubeIds });
    expect(selected.recommendationEngine).toBe('llm');
    expect(selected.results.map(({ item }) => item.youtubeId)).toEqual(
      youtubeIds,
    );
  });
  it('rejects an entire response with a retired ID and handles an empty catalog', () => {
    expect(
      selectRecommendations(
        catalog.map((item) => ({ ...item, status: 'retired' })),
        profile,
        envelope.catalogVersion,
        success,
      ).llmFallbackReason,
    ).toBe('unavailable');
    expect(
      selectRecommendations([], profile, envelope.catalogVersion, success)
        .results,
    ).toEqual([]);
  });
});
