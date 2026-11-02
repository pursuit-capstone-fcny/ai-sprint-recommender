import { afterEach, expect, it, vi } from 'vitest';
import * as engine from '../engine/deterministicPrompt';
afterEach(() => vi.restoreAllMocks());
import { parsePublicCatalog } from '../contracts/publicCatalog';
import { deterministicCatalog } from './deterministicCatalog';
import { deterministicSelection } from './deterministicSelection';
const catalog = () =>
  parsePublicCatalog({
    schemaVersion: 1,
    catalogVersion: `sha256:${'a'.repeat(64)}`,
    functionAreas: ['Operations'],
    tasks: ['grant application drafting', 'content creation'],
    tools: ['Fixture editor'],
    synonyms: [],
    adjacentTools: [],
    items: [
      {
        youtubeId: 'aliasgrant1',
        title: 'Fictional grant application walkthrough',
        description:
          'Demonstrate drafting a grant application from supplied program details.',
        tasks: ['grant application drafting'],
      },
      {
        youtubeId: 'aliasother1',
        title: 'Fictional overview',
        description: 'A general introduction to content creation.',
        tasks: ['content creation'],
      },
    ].map((item) => ({
      ...item,
      functionAreas: ['Operations'],
      tools: ['Fixture editor'],
      status: 'active',
      startHere: false,
      lengthSeconds: null,
      addedAt: null,
    })),
  });
it('maps the Sheet vocabulary without changing the source snapshot or broadening unknown tasks', () => {
  const source = catalog();
  const saved = structuredClone(source);
  const projected = deterministicCatalog(source);
  expect(projected.items[0].tasks).toEqual(['Grant drafting']);
  expect(projected.items[1].tasks).toEqual(['content creation']);
  expect(projected.synonyms).toContainEqual({
    category: 'task',
    alias: 'grant application drafting',
    target: 'Grant drafting',
  });
  expect(() => parsePublicCatalog(projected)).not.toThrow();
  expect(source).toEqual(saved);
});
it('restores original public card metadata after the engine selects from its private projection', () => {
  const source = catalog();
  const projected = deterministicCatalog(source);
  const blank = engine.recommendVideos(source, { prompt: '' });
  const recommend = vi.spyOn(engine, 'recommendVideos').mockReturnValue({
    ...blank,
    recommendations: [
      {
        item: projected.items[0],
        rank: 1,
        reason: 'Fixture match.',
        origin: 'operation',
      },
    ],
  });
  const result = deterministicSelection(source, 'grant application drafting', {
    functionArea: null,
    goalWords: [],
    tools: [],
  });
  expect(recommend).toHaveBeenCalledWith(
    projected,
    expect.objectContaining({ prompt: 'grant application drafting', limit: 8 }),
  );
  expect(result.results.map((r) => r.item.youtubeId)).toEqual(['aliasgrant1']);
  expect(result.results[0].item.tasks).toEqual(['grant application drafting']);
});
