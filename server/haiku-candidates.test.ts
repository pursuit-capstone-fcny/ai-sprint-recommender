// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { anthropicProvider, providerBody } from './anthropic';
import { haikuCandidates } from './haiku-candidates';
import { haikuDeployedBody } from './haiku';
import { readLimits } from './config';
import { catalog, environment } from './test-helpers';

const items = Array.from({ length: 64 }, (_, i) => ({
  ...catalog.items[0],
  youtubeId: `retr${String(i).padStart(7, '0')}`,
  title: i < 16 ? 'Orchard planting' : `Inventory method ${i}`,
  description: i < 16 ? 'Plant trees in soil.' : 'Organize inventory records.',
  tasks: i < 16 ? ['gardening'] : ['inventory management'],
}));
const input = {
  functionArea: null,
  goal: 'organize inventory',
  tools: [],
  catalogVersion: catalog.catalogVersion,
};
const limits = readLimits(environment)!;

describe('Haiku candidate retrieval', () => {
  it('retains the strongest 48 candidates in source order without mutating metadata', () => {
    const before = structuredClone(items);
    const selected = haikuCandidates(items, input);
    expect(selected).toEqual(items.slice(16));
    expect(items).toEqual(before);
    expect(new Set(selected.map((i) => i.youtubeId)).size).toBe(48);
  });
  it.each(['', 'and the', 'zxqv'])(
    'preserves all candidates when lexical retrieval has no evidence: %s',
    (goal) => {
      expect(haikuCandidates(items, { ...input, goal })).toEqual(items);
    },
  );
  it('keeps selected-area candidates even when an unfamiliar paraphrase scores other areas higher', () => {
    const scoped = items.map((item, i) => ({
      ...item,
      functionAreas: [i < 16 ? 'Communications' : 'Operations'],
    }));
    const selected = haikuCandidates(scoped, {
      ...input,
      functionArea: 'Communications',
    });
    expect(selected).toEqual(scoped.slice(0, 48));
    expect(
      selected.some((item) => item.functionAreas.includes('Operations')),
    ).toBe(true);
  });
  it('keeps all candidates when the selected area alone exceeds the shortlist limit', () => {
    expect(
      haikuCandidates(items, {
        ...input,
        functionArea: items[0].functionAreas[0],
      }),
    ).toEqual(items);
  });
  it('preserves small catalogs', () => {
    expect(haikuCandidates(items.slice(0, 12), input)).toEqual(
      items.slice(0, 12),
    );
  });
  it('reindexes schema and trusted IDs together through the real provider adapter', async () => {
    const selected = haikuCandidates(items, input);
    const body = haikuDeployedBody(
      providerBody(input, { ...catalog, items: selected }, limits),
    );
    const data = JSON.parse(body.request.messages[0].content);
    expect(data.catalog.map((row: unknown[]) => row[0])).toEqual(
      Array.from({ length: 48 }, (_, i) => i),
    );
    expect(data.catalog.map((row: unknown[]) => row[1])).toEqual(
      selected.map((i) => i.title),
    );
    const positions =
      body.request.output_config.format.schema.properties.rank1.anyOf[0].enum;
    expect(positions).toEqual(Array.from({ length: 48 }, (_, i) => i));
    const response = (position: number) =>
      anthropicProvider('fixture-only', async () =>
        Response.json({
          stop_reason: 'end_turn',
          usage: { input_tokens: 1000, output_tokens: 60 },
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                workSteps: 'Organize inventory records',
                ranks: Object.fromEntries(
                  Array.from({ length: 8 }, (_, i) => [
                    `rank${i + 1}`,
                    i === 0 ? position : null,
                  ]),
                ),
              }),
            },
          ],
        }),
      )(body, new AbortController().signal);
    expect((await response(47)).value).toEqual({
      youtubeIds: [items[63].youtubeId],
    });
    expect(await response(48)).toMatchObject({
      value: null,
      validationFailure: 'out-of-range',
      inputTokens: 1000,
      outputTokens: 60,
    });
  });
});
