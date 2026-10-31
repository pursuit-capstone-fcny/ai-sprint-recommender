// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { anthropicProvider, providerBody } from './anthropic';
import { haikuDeployedBody } from './haiku';
import { readLimits } from './config';
import { catalog, environment } from './test-helpers';

const body = haikuDeployedBody(
  providerBody(
    {
      functionArea: null,
      goal: 'Review fictional source documents',
      tools: [],
      catalogVersion: catalog.catalogVersion,
    },
    catalog,
    readLimits(environment)!,
  ),
);
const choices = body.data.catalog.map(
  (item) => `${item.position}: ${item.title}`,
);
const slots = (values: unknown[]) =>
  Object.fromEntries(
    Array.from({ length: 8 }, (_, i) => [`rank${i + 1}`, values[i] ?? null]),
  );
function respond(value: unknown) {
  return vi.fn(async () =>
    Response.json({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: JSON.stringify(value) }],
      usage: { input_tokens: 200, output_tokens: 90 },
    }),
  );
}

describe('Haiku catalog choice protocol', () => {
  it('rejects inconsistent trusted maps before dispatch', async () => {
    const fetcher = respond(slots([]));
    for (const selectionKeys of [
      choices.slice(1),
      choices.map(() => choices[0]),
    ]) {
      await expect(
        anthropicProvider('fixture-only', fetcher)(
          { ...body, selectionKeys },
          new AbortController().signal,
        ),
      ).rejects.toThrow('Invalid trusted selection map');
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('offers every exact position/title choice through one shared schema definition', () => {
    expect(body.request.output_config.format.schema).toEqual({
      type: 'object',
      properties: Object.fromEntries(
        Array.from({ length: 8 }, (_, i) => [
          `rank${i + 1}`,
          { $ref: '#/definitions/choice' },
        ]),
      ),
      required: Array.from({ length: 8 }, (_, i) => `rank${i + 1}`),
      additionalProperties: false,
      definitions: {
        choice: {
          anyOf: [{ type: 'string', enum: choices }, { type: 'null' }],
        },
      },
    });
  });
  it.each([{ positions: [2, 0] }, { positions: [] }, { positions: [1] }])(
    'maps exact choices to the same trusted IDs without reordering: $positions',
    async ({ positions }) => {
      const fetcher = respond(
        Object.fromEntries(
          Object.entries(slots(positions.map((i) => choices[i]))).reverse(),
        ),
      );
      const result = await anthropicProvider('fixture-only', fetcher)(
        body,
        new AbortController().signal,
      );
      expect(result.value).toEqual({
        youtubeIds: positions.map((i) => body.catalogIds[i]),
      });
      expect(result).toMatchObject({ inputTokens: 200, outputTokens: 90 });
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it.each([
    ['duplicate', slots([choices[0], choices[0]])],
    ['out-of-range', slots([`0: ${body.data.catalog[1].title}`])],
    ['out-of-range', slots(['999: invented title'])],
    ['out-of-range', slots([choices[0].toUpperCase()])],
    ['schema', slots([0])],
    ['schema', { rank1: choices[0] }],
    ['schema', { ...slots([choices[0]]), explanation: 'untrusted' }],
  ])(
    'rejects %s while retaining measured usage',
    async (validationFailure, value) => {
      const fetcher = respond(value);
      const result = await anthropicProvider('fixture-only', fetcher)(
        body,
        new AbortController().signal,
      );
      expect(result).toMatchObject({
        value: null,
        validationFailure,
        inputTokens: 200,
        outputTokens: 90,
      });
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
});
