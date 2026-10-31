// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { anthropicProvider, providerBody } from './anthropic';
import { haikuDeployedBody } from './haiku';
import { readLimits } from './config';
import { catalog, environment } from './test-helpers';

const items = [
  {
    title: 'Soup recipes',
    description: 'Roast potatoes and season a soup.',
    tasks: ['cooking'],
  },
  {
    title: 'Write a committee report',
    description: 'Write a clear report.',
    tasks: ['report drafting'],
  },
  {
    title: 'Organize source evidence',
    description: 'Collect and organize the source evidence for a report.',
    tasks: ['document review'],
  },
  {
    title: 'Holiday invitation poster',
    description: 'Lay out an invitation poster.',
    tasks: ['graphic design'],
  },
].map((item, i) => ({
  ...catalog.items[0],
  ...item,
  youtubeId: `order00000${i}`,
}));
function original(goal = 'report') {
  return providerBody(
    {
      functionArea: null,
      goal,
      tools: [],
      catalogVersion: catalog.catalogVersion,
    },
    { ...catalog, items },
    readLimits(environment)!,
  );
}

describe('Haiku relevance ordering', () => {
  it('orders by the existing content scorer, retaining every item and stable ties without mutation', () => {
    const input = original();
    const before = structuredClone(input);
    const result = haikuDeployedBody(input);
    expect(result.catalogIds).toEqual(
      [items[1], items[2], items[0], items[3]].map((i) => i.youtubeId),
    );
    expect(result.data.catalog.map((i) => i.position)).toEqual([0, 1, 2, 3]);
    expect(new Set(result.catalogIds)).toEqual(new Set(input.catalogIds));
    for (const [position, id] of result.catalogIds.entries()) {
      const oldPosition = input.catalogIds.indexOf(id);
      expect(result.data.catalog[position]).toEqual({
        ...input.data.catalog[oldPosition],
        position,
      });
    }
    expect(input).toEqual(before);
    expect(result.request.output_config.effort).toEqual(
      input.request.output_config.effort,
    );
  });
  it.each(['', 'and the', 'zxqv'])(
    'preserves source order when the goal provides no lexical evidence: %s',
    (goal) => {
      const input = original(goal);
      const result = haikuDeployedBody(input);
      expect(result.catalogIds).toEqual(input.catalogIds);
      expect(result.data).toEqual(input.data);
    },
  );
  it('maps provider ranks back to the reordered trusted IDs through the real adapter', async () => {
    const input = original();
    const result = haikuDeployedBody(input);
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({
        stop_reason: 'end_turn',
        usage: { input_tokens: 1000, output_tokens: 30 },
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              work: 'Prepare fictional work',
              steps: 'Review sources; organize findings; check the result.',
              ...Object.fromEntries(
                Array.from({ length: 8 }, (_, i) => [
                  `rank${i + 1}`,
                  i < 2 ? i : null,
                ]),
              ),
            }),
          },
        ],
      }),
    );
    const response = await anthropicProvider('fixture-only', fetcher)(
      result,
      new AbortController().signal,
    );
    expect(response.value).toEqual({
      youtubeIds: [items[1].youtubeId, items[2].youtubeId],
    });
    expect(response).toMatchObject({ inputTokens: 1000, outputTokens: 30 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    const rows = JSON.parse(sent.messages[0].content).catalog;
    expect(rows.map((row: unknown[]) => row[0])).toEqual([0, 1, 2, 3]);
    expect(rows.map((row: unknown[]) => row[1])).toEqual(
      [items[1], items[2], items[0], items[3]].map((i) => i.title),
    );
  });
});
