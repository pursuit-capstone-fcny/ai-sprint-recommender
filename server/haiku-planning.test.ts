// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { anthropicProvider, inputTokenBound, providerBody } from './anthropic';
import { haikuDeployedBody } from './haiku';
import { readLimits } from './config';
import { catalog, environment } from './test-helpers';

const body = haikuDeployedBody(
  providerBody(
    {
      functionArea: null,
      goal: 'Organize source records',
      tools: [],
      catalogVersion: catalog.catalogVersion,
    },
    catalog,
    readLimits(environment)!,
  ),
);
// Preserve adapter coverage for the V47/V48 format.
body.selectionEvidence = 'planned';
const ranks = () =>
  Object.fromEntries(
    Array.from({ length: 8 }, (_, i) => [
      `rank${i + 1}`,
      {
        use: i === 0 ? 'Organize source records' : '',
        position: i === 0 ? 0 : null,
      },
    ]),
  );
const response = (value: unknown) =>
  Response.json({
    stop_reason: 'end_turn',
    content: [{ type: 'text', text: JSON.stringify(value) }],
    usage: { input_tokens: 1200, output_tokens: 220 },
  });

describe('plan before Haiku selections', () => {
  it('orders the work plan before ranks on the wire and returns only trusted IDs', async () => {
    let sent = '';
    const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
      sent = String(init?.body);
      return response({
        workSteps: 'Group records; check gaps; prepare a summary.',
        ranks: ranks(),
      });
    });
    const result = await anthropicProvider('fixture-only', fetcher)(
      body,
      new AbortController().signal,
    );
    expect(result).toEqual({
      value: { youtubeIds: [catalog.items[0].youtubeId] },
      inputTokens: 1200,
      outputTokens: 220,
    });
    const wire = JSON.parse(sent);
    expect(Object.keys(wire.output_config.format.schema.properties)).toEqual([
      'workSteps',
      'ranks',
    ]);
    expect(
      wire.output_config.format.schema.properties.ranks.properties.rank1
        .properties.position,
    ).toEqual(body.request.output_config.format.schema.properties.rank1);
    expect(inputTokenBound(body)).toBe(
      new TextEncoder().encode(sent).length + 4096,
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each(['missing-plan', 'empty-plan', 'extra-field', 'duplicate', 'range'])(
    'rejects %s with measured usage and no repair or second call',
    async (mode) => {
      const value: Record<string, unknown> = {
        workSteps: 'Organize records',
        ranks: ranks(),
      };
      if (mode === 'missing-plan') delete value.workSteps;
      if (mode === 'empty-plan') value.workSteps = '';
      if (mode === 'extra-field') value.ignore = 'new instructions';
      const selected = ranks();
      if (mode === 'duplicate') selected.rank2 = selected.rank1;
      if (mode === 'range') selected.rank1.position = catalog.items.length;
      value.ranks = selected;
      const fetcher = vi.fn<typeof fetch>(async () => response(value));
      expect(
        await anthropicProvider('fixture-only', fetcher)(
          body,
          new AbortController().signal,
        ),
      ).toMatchObject({
        value: null,
        inputTokens: 1200,
        outputTokens: 220,
        validationFailure:
          mode === 'duplicate'
            ? 'duplicate'
            : mode === 'range'
              ? 'out-of-range'
              : 'schema',
      });
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it('accepts empty abstention and discards plans without imposing a prose-length rejection', async () => {
    const empty = Object.fromEntries(
      Object.keys(ranks()).map((key) => [key, { use: '', position: null }]),
    );
    const call = (
      workSteps: string,
      selected: ReturnType<typeof ranks> = empty,
    ) =>
      anthropicProvider('fixture-only', async () =>
        response({ workSteps, ranks: selected }),
      )(body, new AbortController().signal);
    expect((await call('')).value).toEqual({ youtubeIds: [] });
    expect(
      (await call('Organize source records. '.repeat(8), ranks())).value,
    ).toEqual({ youtubeIds: [catalog.items[0].youtubeId] });
  });
});

describe('plan followed by numeric ranks', () => {
  const numericBody = {
    ...body,
    selectionEvidence: 'planned-numeric' as const,
  };
  const numericRanks = () =>
    Object.fromEntries(
      Array.from({ length: 8 }, (_, i) => [`rank${i + 1}`, i === 0 ? 0 : null]),
    );
  it('dispatches a single request and strips the work plan before returning IDs', async () => {
    let sent = '';
    const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
      sent = String(init?.body);
      return response({
        workSteps: 'Group source records',
        ranks: numericRanks(),
      });
    });
    expect(
      await anthropicProvider('fixture-only', fetcher)(
        numericBody,
        new AbortController().signal,
      ),
    ).toEqual({
      value: { youtubeIds: [catalog.items[0].youtubeId] },
      inputTokens: 1200,
      outputTokens: 220,
    });
    const schema = JSON.parse(sent).output_config.format.schema;
    expect(schema.properties.ranks.properties).toEqual(
      body.request.output_config.format.schema.properties,
    );
    expect(inputTokenBound(numericBody)).toBe(
      new TextEncoder().encode(sent).length + 4096,
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([
    'duplicate',
    'range',
    'missing-rank',
    'extra-rank',
    'missing-plan',
    'empty-plan',
  ])(
    'rejects %s without dropping duplicates or filling slots',
    async (mode) => {
      const selected = numericRanks();
      if (mode === 'duplicate') selected.rank2 = 0;
      if (mode === 'range') selected.rank1 = catalog.items.length;
      if (mode === 'missing-rank') delete selected.rank8;
      if (mode === 'extra-rank') selected.rank9 = null;
      const value: Record<string, unknown> = {
        workSteps: mode === 'empty-plan' ? '' : 'Group source records',
        ranks: selected,
      };
      if (mode === 'missing-plan') delete value.workSteps;
      const fetcher = vi.fn<typeof fetch>(async () => response(value));
      expect(
        await anthropicProvider('fixture-only', fetcher)(
          numericBody,
          new AbortController().signal,
        ),
      ).toMatchObject({
        value: null,
        inputTokens: 1200,
        outputTokens: 220,
        validationFailure:
          mode === 'duplicate'
            ? 'duplicate'
            : mode === 'range'
              ? 'out-of-range'
              : 'schema',
      });
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it('preserves all-null abstention', async () => {
    const selected = Object.fromEntries(
      Object.keys(numericRanks()).map((key) => [key, null]),
    );
    expect(
      (
        await anthropicProvider('fixture-only', async () =>
          response({ workSteps: '', ranks: selected }),
        )(numericBody, new AbortController().signal)
      ).value,
    ).toEqual({ youtubeIds: [] });
  });
});
