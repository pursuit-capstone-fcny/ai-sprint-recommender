import { describe, expect, it } from 'vitest';
import fixture from '../../fixtures/public-catalog.json';
import { toCatalogItem } from '../contracts/catalogItem';
import { parsePublicCatalog } from '../contracts/publicCatalog';
import { selectRecommendationState } from './selectRecommendationState';

const envelope = parsePublicCatalog(fixture);
const catalog = envelope.items.map(toCatalogItem);
const profile = {
  functionArea: null,
  goalWords: ['fictional-goal'],
  tools: [],
};
const success = {
  outcome: 'success',
  youtubeIds: ['fx04BdgtSht', 'fx03BdgtXls', 'fx01GrntRpt'],
  catalogVersion: envelope.catalogVersion,
  modelVersion: 'fixture-model',
  promptVersion: 'fixture-prompt',
};
const select = (response: unknown) =>
  selectRecommendationState(
    catalog,
    profile,
    envelope.catalogVersion,
    response,
  );

describe('browser recommendation outcomes', () => {
  it('preserves a valid empty selection as an abstention with no rules cards', () => {
    expect(select({ ...success, youtubeIds: [] })).toEqual({
      status: 'abstained',
      selection: {
        results: [],
        recommendationEngine: 'llm',
        llmFallbackReason: 'none',
        modelVersion: 'fixture-model',
        promptVersion: 'fixture-prompt',
      },
    });
  });
  it('shows an unavailable outcome rather than rules cards for a rejected response', () => {
    expect(
      select({ ...success, youtubeIds: ['fx04BdgtSht', 'fx04BdgtSht'] }),
    ).toEqual({
      status: 'unavailable',
      reason: 'invalid-response',
    });
  });
  it('preserves valid nonempty model order', () => {
    const state = select(success);
    expect(state.status).toBe('ready');
    if (state.status === 'unavailable')
      throw new Error('Expected ready results');
    expect(state.selection.results.map(({ item }) => item.youtubeId)).toEqual([
      'fx04BdgtSht',
      'fx03BdgtXls',
      'fx01GrntRpt',
    ]);
    expect(state.selection.recommendationEngine).toBe('llm');
  });
  it('AC-REASON-1: shows each pick its own reason, or the neutral text without reasons', () => {
    const reasons = ['Budget sheet reason.', 'Excel reason.', 'Grant reason.'];
    const withReasons = select({ ...success, reasons });
    const without = select(success);
    if (
      withReasons.status === 'unavailable' ||
      without.status === 'unavailable'
    )
      throw new Error('Expected ready results');
    expect(withReasons.selection.results.map((r) => r.reason)).toEqual(reasons);
    expect(without.selection.results.map((r) => r.reason)).toEqual(
      Array(3).fill('Suggested for your goal'),
    );
  });
  it.each([
    ['missing response', undefined, 'invalid-response'],
    [
      'reasons that do not match the picks',
      { ...success, reasons: ['Only one reason.'] },
      'invalid-response',
    ],
    [
      'an overlong reason',
      { ...success, reasons: Array(3).fill('x'.repeat(216)) },
      'invalid-response',
    ],
    [
      'unknown ID',
      { ...success, youtubeIds: ['unknown0000', 'fx01GrntRpt'] },
      'invalid-response',
    ],
    [
      'extra fields',
      { ...success, explanation: 'untrusted' },
      'invalid-response',
    ],
    [
      'stale empty response',
      {
        ...success,
        youtubeIds: [],
        catalogVersion: `sha256:${'0'.repeat(64)}`,
      },
      'catalog-mismatch',
    ],
  ])('does not substitute cards for %s', (_, response, reason) => {
    expect(select(response)).toEqual({ status: 'unavailable', reason });
  });
  it.each([
    'timeout',
    'provider-error',
    'disabled',
    'budget-exhausted',
    'rate-limited',
    'unavailable',
  ])('keeps a %s failure distinct from abstention', (reason) => {
    expect(select({ outcome: 'fallback', reason })).toEqual({
      status: 'unavailable',
      reason,
    });
  });
  it.each([
    ['one pick', ['fx01GrntRpt']],
    ['one primary task', ['fx04BdgtSht', 'fx03BdgtXls']],
  ])('shows %s in model order; task tags only reorder', (_, youtubeIds) => {
    const state = select({ ...success, youtubeIds });
    expect(state.status).toBe('ready');
    if (state.status === 'unavailable')
      throw new Error('Expected ready results');
    expect(state.selection.results.map(({ item }) => item.youtubeId)).toEqual(
      youtubeIds,
    );
  });
  it('keeps untagged picks instead of rejecting the answer', () => {
    const state = selectRecommendationState(
      catalog.map((item) => ({ ...item, tasks: [] })),
      profile,
      envelope.catalogVersion,
      success,
    );
    expect(state.status).toBe('ready');
  });
  it('rejects a retired ID without returning a partial set', () => {
    expect(
      selectRecommendationState(
        catalog.map((item) =>
          item.youtubeId === 'fx04BdgtSht'
            ? { ...item, status: 'retired' }
            : item,
        ),
        profile,
        envelope.catalogVersion,
        success,
      ),
    ).toEqual({ status: 'unavailable', reason: 'invalid-response' });
  });
});
