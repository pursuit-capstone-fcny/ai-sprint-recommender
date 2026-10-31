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
      goal: 'Draft a report',
      tools: [],
      catalogVersion: catalog.catalogVersion,
    },
    catalog,
    readLimits(environment)!,
  ),
);
const slots = (positions: unknown[]) =>
  Object.fromEntries(
    Array.from({ length: 8 }, (_, i) => [`rank${i + 1}`, positions[i] ?? null]),
  );
async function parse(value: unknown) {
  const fetcher = vi.fn<typeof fetch>(async () =>
    Response.json({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: JSON.stringify(value) }],
      usage: { input_tokens: 1000, output_tokens: 150 },
    }),
  );
  const result = await anthropicProvider('fixture-only', fetcher)(
    body,
    new AbortController().signal,
  );
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(result).toMatchObject({ inputTokens: 1000, outputTokens: 150 });
  return result;
}
describe('Haiku structured work plan', () => {
  it('returns only mapped IDs and measured usage for a valid work plan', async () => {
    const result = await parse({
      work: 'Draft a clear report',
      steps: 'Organize evidence; outline findings; check wording.',
      ...slots([2, 0]),
    });
    expect(result.value).toEqual({
      youtubeIds: [body.catalogIds[2], body.catalogIds[0]],
    });
    expect(result).not.toHaveProperty('work');
    expect(result).not.toHaveProperty('steps');
  });
  it('accepts explicit abstention without inventing a work task', async () => {
    expect((await parse({ work: '', steps: '', ...slots([]) })).value).toEqual({
      youtubeIds: [],
    });
  });
  it.each([
    { work: '', steps: '', ...slots([0]) },
    { work: 'Task', steps: '', ...slots([0]) },
    { work: '', steps: 'A step', ...slots([]) },
    { work: 'x'.repeat(201), steps: 'Step', ...slots([0]) },
    { work: 'Task', steps: 'x'.repeat(401), ...slots([0]) },
    { work: 'Task', steps: [], ...slots([0]) },
    { work: 'Task', steps: 'Step', ...slots([0]), extra: 'untrusted' },
    { ...slots([0]) },
  ])(
    'rejects malformed or missing plans without dropping known usage',
    async (value) => {
      expect(await parse(value)).toMatchObject({
        value: null,
        validationFailure: 'schema',
      });
    },
  );
  it('still rejects duplicate and out-of-range ranks without repair', async () => {
    expect(
      await parse({ work: 'Task', steps: 'Step', ...slots([0, 0]) }),
    ).toMatchObject({ value: null, validationFailure: 'duplicate' });
    expect(
      await parse({ work: 'Task', steps: 'Step', ...slots([999]) }),
    ).toMatchObject({ value: null, validationFailure: 'out-of-range' });
  });
});
