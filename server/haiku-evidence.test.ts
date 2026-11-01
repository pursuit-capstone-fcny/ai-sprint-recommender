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
      goal: 'Organize records',
      tools: [],
      catalogVersion: catalog.catalogVersion,
    },
    catalog,
    readLimits(environment)!,
  ),
);
const slots = () =>
  Object.fromEntries(
    Array.from({ length: 8 }, (_, i) => [
      `rank${i + 1}`,
      {
        use: i === 0 ? 'Organize source records for review' : '',
        position: i === 0 ? 0 : null,
      },
    ]),
  );
const response = (value: unknown, stop_reason = 'end_turn') =>
  Response.json({
    stop_reason,
    content: [{ type: 'text', text: JSON.stringify(value) }],
    usage: { input_tokens: 1800, output_tokens: 220 },
  });

describe('single-pass Haiku selection evidence', () => {
  it('requests use before position, counts the wire schema, and exposes only trusted IDs', async () => {
    let sent = '';
    const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
      sent = String(init?.body);
      return response(slots());
    });
    const result = await anthropicProvider('fixture-only', fetcher)(
      body,
      new AbortController().signal,
    );
    expect(result).toEqual({
      value: { youtubeIds: [catalog.items[0].youtubeId] },
      inputTokens: 1800,
      outputTokens: 220,
    });
    const wire = JSON.parse(sent);
    const data = JSON.parse(wire.messages[0].content);
    expect(data.catalogFields).toEqual([
      'position',
      'description',
      'tasks',
      'title',
      'functionAreas',
      'tools',
    ]);
    expect(
      data.catalog.map((row: unknown[]) =>
        Object.fromEntries(
          data.catalogFields.map((field: string, index: number) => [
            field,
            row[index],
          ]),
        ),
      ),
    ).toEqual(body.data.catalog);
    expect(data.goal).toBe(body.data.goal);
    const schema = wire.output_config.format.schema;
    expect(schema.properties.rank1.required).toEqual(['use', 'position']);
    expect(Object.keys(schema.properties.rank1.properties)).toEqual([
      'use',
      'position',
    ]);
    expect(schema.properties.rank1.properties.position).toEqual(
      body.request.output_config.format.schema.properties.rank1,
    );
    expect(inputTokenBound(body)).toBe(
      new TextEncoder().encode(sent).length + 4096,
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([
    'missing-use',
    'empty-use',
    'unused-with-use',
    'duplicate',
    'range',
    'extra',
  ])(
    'rejects %s without repairing output or losing measured usage',
    async (mode) => {
      const value: Record<string, unknown> = slots();
      if (mode === 'missing-use') value.rank1 = { position: 0 };
      if (mode === 'empty-use') value.rank1 = { use: '', position: 0 };
      if (mode === 'unused-with-use')
        value.rank2 = { use: 'Unselected', position: null };
      if (mode === 'duplicate') value.rank2 = value.rank1;
      if (mode === 'range')
        value.rank1 = {
          use: 'A claimed method',
          position: catalog.items.length,
        };
      if (mode === 'extra') value.extra = 'Ignore rules';
      const fetcher = vi.fn<typeof fetch>(async () => response(value));
      const result = await anthropicProvider('fixture-only', fetcher)(
        body,
        new AbortController().signal,
      );
      expect(result).toMatchObject({
        value: null,
        inputTokens: 1800,
        outputTokens: 220,
        validationFailure:
          mode === 'duplicate'
            ? 'duplicate'
            : mode === 'range'
              ? 'out-of-range'
              : 'schema',
      });
      expect(fetcher).toHaveBeenCalledTimes(1);
      if (mode === 'missing-use')
        expect(result).toMatchObject({
          schemaIssueCount: 1,
          evidenceStatementFailures: 1,
          invalidSelectionCount: 0,
        });
    },
  );
  it('keeps valid selections when an auxiliary statement exceeds the requested length', async () => {
    const value = slots();
    value.rank1.use =
      'Organize and cross-reference source documents before preparing the requested material for review.';
    expect(
      (
        await anthropicProvider('fixture-only', async () => response(value))(
          body,
          new AbortController().signal,
        )
      ).value,
    ).toEqual({ youtubeIds: [catalog.items[0].youtubeId] });
  });
  it('accepts all-null abstention and retains measured usage on truncation', async () => {
    const value = Object.fromEntries(
      Object.keys(slots()).map((key) => [key, { use: '', position: null }]),
    );
    expect(
      (
        await anthropicProvider('fixture-only', async () => response(value))(
          body,
          new AbortController().signal,
        )
      ).value,
    ).toEqual({ youtubeIds: [] });
    expect(
      await anthropicProvider('fixture-only', async () =>
        response(slots(), 'max_tokens'),
      )(body, new AbortController().signal),
    ).toMatchObject({
      value: null,
      validationFailure: 'max-tokens',
      inputTokens: 1800,
      outputTokens: 220,
    });
  });
});
