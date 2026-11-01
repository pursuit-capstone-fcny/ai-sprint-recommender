// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { anthropicProvider, inputTokenBound, providerBody } from './anthropic';
import { haikuDeployedBody } from './haiku';
import { readLimits } from './config';
import { catalog, environment } from './test-helpers';

const body = {
  ...haikuDeployedBody(
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
  ),
  selectionEvidence: 'rated' as const,
};
const scores = () =>
  Object.fromEntries(
    body.catalogIds.map((_, i) => [String(i), i === 0 ? 95 : 0]),
  );
const response = (value: unknown) =>
  Response.json({
    stop_reason: 'end_turn',
    content: [{ type: 'text', text: JSON.stringify(value) }],
    usage: { input_tokens: 1200, output_tokens: 220 },
  });

describe('rate every candidate before selection', () => {
  it('requires one score per candidate and returns only trusted ranked IDs in one call', async () => {
    let sent = '';
    const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
      sent = String(init?.body);
      return response({ workSteps: 'Group source records', scores: scores() });
    });
    expect(
      await anthropicProvider('fixture-only', fetcher)(
        body,
        new AbortController().signal,
      ),
    ).toEqual({
      value: { youtubeIds: [catalog.items[0].youtubeId] },
      inputTokens: 1200,
      outputTokens: 220,
    });
    const schema = JSON.parse(sent).output_config.format.schema;
    expect(schema.properties.scores.required).toEqual(
      body.catalogIds.map((_, i) => String(i)),
    );
    expect(inputTokenBound(body)).toBe(
      new TextEncoder().encode(sent).length + 4096,
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([
    'missing',
    'extra',
    'fraction',
    'negative',
    'overflow',
    'string',
    'empty-plan',
  ])('rejects %s and retains usage without repair', async (mode) => {
    const selected: Record<string, unknown> = scores();
    if (mode === 'missing') delete selected['0'];
    if (mode === 'extra') selected[body.catalogIds.length] = 90;
    if (mode === 'fraction') selected['0'] = 80.5;
    if (mode === 'negative') selected['0'] = -1;
    if (mode === 'overflow') selected['0'] = 101;
    if (mode === 'string') selected['0'] = '95';
    const fetcher = vi.fn<typeof fetch>(async () =>
      response({
        workSteps: mode === 'empty-plan' ? '' : 'Group source records',
        scores: selected,
      }),
    );
    expect(
      await anthropicProvider('fixture-only', fetcher)(
        body,
        new AbortController().signal,
      ),
    ).toMatchObject({
      value: null,
      validationFailure: 'schema',
      inputTokens: 1200,
      outputTokens: 220,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('does not fill a list with below-threshold candidates and supports empty abstention', async () => {
    const selected = Object.fromEntries(
      body.catalogIds.map((_, i) => [String(i), 59]),
    );
    const result = await anthropicProvider('fixture-only', async () =>
      response({ workSteps: '', scores: selected }),
    )(body, new AbortController().signal);
    expect(result.value).toEqual({ youtubeIds: [] });
  });
  it('sorts scores, breaks ties in catalog order, and caps at eight without repeated IDs', async () => {
    const ids = Array.from({ length: 12 }, (_, i) => `fixture-${i}`);
    const larger = { ...body, catalogIds: ids };
    const values = [75, 90, 80, 90, 0, 70, 60, 99, 95, 60, 59, 60];
    const result = await anthropicProvider('fixture-only', async () =>
      response({
        workSteps: 'Organize source records',
        scores: Object.fromEntries(
          values.map((score, i) => [String(i), score]),
        ),
      }),
    )(larger, new AbortController().signal);
    expect(result.value).toEqual({
      youtubeIds: [7, 8, 1, 3, 2, 0, 5, 6].map((i) => ids[i]),
    });
  });
});
