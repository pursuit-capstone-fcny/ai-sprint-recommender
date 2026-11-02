import { afterEach, expect, it, vi } from 'vitest';
import { parsePublicCatalog } from '../contracts/publicCatalog';
import { deterministicSelection } from './deterministicSelection';
const catalog = parsePublicCatalog({
  schemaVersion: 1,
  catalogVersion: `sha256:${'a'.repeat(64)}`,
  functionAreas: ['Operations'],
  tasks: ['report writing', 'Other work'],
  tools: ['Fixture editor'],
  synonyms: [],
  adjacentTools: [],
  items: Array.from({ length: 5 }, (_, i) => ({
    youtubeId: `demoitem00${i}`,
    title: `Fictional lesson ${i}`,
    description:
      i < 4
        ? 'Demonstrate report writing from supplied notes.'
        : 'An unrelated overview.',
    functionAreas: ['Operations'],
    tasks: [i < 4 ? 'report writing' : 'Other work'],
    tools: ['Fixture editor'],
    addedAt: null,
    lengthSeconds: 60,
    status: 'active',
    startHere: i === 4,
  })),
});
const profile = {
  functionArea: null,
  tools: [],
  goalWords: ['report', 'writing'],
};
afterEach(() => vi.unstubAllGlobals());
it('runs the latest deterministic engine locally and preserves a useful short set without filler', () => {
  const fetcher = vi.fn(() => {
    throw new Error('No network allowed');
  });
  vi.stubGlobal('fetch', fetcher);
  const result = deterministicSelection(catalog, 'report writing', profile);
  expect(result.recommendationEngine).toBe('rules');
  expect(result.llmFallbackReason).toBe('not-requested');
  expect(result.results).toHaveLength(4);
  expect(result.results.some((r) => r.item.youtubeId === 'demoitem004')).toBe(
    false,
  );
  expect(result.results.every((r) => r.matchType === 'strong')).toBe(true);
  expect(fetcher).not.toHaveBeenCalled();
});
it('keeps unsupported work empty without substituting Start-here videos', () => {
  expect(
    deterministicSelection(
      catalog,
      'Reconcile bank transactions in QuickBooks Online only.',
      profile,
    ).results,
  ).toEqual([]);
});
