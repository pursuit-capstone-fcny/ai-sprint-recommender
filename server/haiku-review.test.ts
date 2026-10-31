// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { anthropicProvider, providerBody } from './anthropic';
import { haikuDeployedBody } from './haiku';
import { haikuReviewProvider } from './haiku-review';
import { readLimits } from './config';
import { catalog, environment } from './test-helpers';

const items = Array.from({ length: 30 }, (_, i) => ({
  ...catalog.items[0],
  youtubeId: `revw${String(i).padStart(7, '0')}`,
  title: `Inventory method ${i}`,
  description: 'Organize inventory records and check missing entries.',
  tasks: ['inventory management'],
}));
const original = haikuDeployedBody(
  providerBody(
    {
      functionArea: null,
      goal: 'organize inventory',
      tools: [],
      catalogVersion: catalog.catalogVersion,
    },
    { ...catalog, items },
    { ...readLimits(environment)!, LLM_MAX_OUTPUT_TOKENS: 512 },
  ),
);
const payload = (positions: (number | null)[]) => ({
  stop_reason: 'end_turn',
  usage: { input_tokens: 1000, output_tokens: 60 },
  content: [
    {
      type: 'text',
      text: JSON.stringify(
        Object.fromEntries(
          Array.from({ length: 8 }, (_, i) => [
            `rank${i + 1}`,
            positions[i] ?? null,
          ]),
        ),
      ),
    },
  ],
});

describe('bounded Haiku review', () => {
  it('reviews a valid draft with alternatives and accounts for both calls without returning the draft', async () => {
    const requests: { max_tokens: number; messages: { content: string }[] }[] =
      [];
    const provider = anthropicProvider('fixture-only', async (_url, init) => {
      requests.push(JSON.parse(String(init?.body)));
      return Response.json(
        payload(
          requests.length === 1 ? [22, 23, 24, 25, 26] : [0, 1, 2, 3, 4, 5],
        ),
      );
    });
    const result = await haikuReviewProvider(provider)(
      original,
      new AbortController().signal,
    );
    expect(requests).toHaveLength(2);
    expect(requests.map((r) => r.max_tokens)).toEqual([256, 256]);
    const review = JSON.parse(requests[1].messages[0].content);
    expect(review.catalog).toHaveLength(18);
    expect(review.draftPositions).toHaveLength(5);
    expect(result.value).toEqual({
      youtubeIds: items.slice(0, 6).map((i) => i.youtubeId),
    });
    expect(result).toMatchObject({ inputTokens: 2000, outputTokens: 120 });
  });
});

it('bounds the two stages for every frozen benchmark and wording request before dispatch', async () => {
  const { readFileSync } = await import('node:fs');
  const { parseBenchmark } = await import('../src/evaluation/benchmark');
  const { haikuCandidates } = await import('./haiku-candidates');
  const { haikuReviewPlan } = await import('./haiku-review');
  const benchmark = parseBenchmark(
    JSON.parse(
      readFileSync(
        'docs/evaluation/2026-10-28-task-tags/benchmark.json',
        'utf8',
      ),
    ),
  );
  const wording = JSON.parse(
    readFileSync(
      'docs/evaluation/2026-10-29-luna-deployed/wording.json',
      'utf8',
    ),
  ) as { profiles: { input: (typeof benchmark.profiles)[number]['input'] }[] };
  for (const { input } of [...benchmark.profiles, ...wording.profiles]) {
    const body = haikuDeployedBody(
      providerBody(
        { ...input, catalogVersion: benchmark.catalog.catalogVersion },
        {
          ...benchmark.catalog,
          items: haikuCandidates(benchmark.catalog.items, {
            ...input,
            catalogVersion: benchmark.catalog.catalogVersion,
          }),
        },
        { ...readLimits(environment)!, LLM_MAX_OUTPUT_TOKENS: 512 },
      ),
    );
    expect(haikuReviewPlan(body)).toMatchObject({ review: true });
    expect(haikuReviewPlan(body).inputBound).toBeLessThanOrEqual(65_000);
  }
});

it.each(['blank', 'large', 'context'] as const)(
  'retains the single 512-token call for %s inputs',
  async (mode) => {
    const body = structuredClone(original);
    if (mode === 'blank') body.data.goal = '';
    if (mode === 'large')
      body.catalogIds = Array.from({ length: 49 }, () => items[0].youtubeId);
    if (mode === 'context') body.request.system = 'long'.repeat(20_000);
    const calls: number[] = [];
    const provider: import('./anthropic').Provider = async (request) => {
      calls.push(request.request.max_tokens);
      return { value: { youtubeIds: [] }, inputTokens: 100, outputTokens: 100 };
    };
    await haikuReviewProvider(provider)(body, new AbortController().signal);
    expect(calls).toEqual([512]);
  },
);

it.each(['empty', 'invalid', 'aborted'] as const)(
  'does not review a draft that is %s',
  async (mode) => {
    const controller = new AbortController();
    let calls = 0;
    const provider: import('./anthropic').Provider = async () => {
      calls++;
      if (mode === 'aborted') controller.abort();
      return {
        value:
          mode === 'invalid'
            ? null
            : { youtubeIds: mode === 'empty' ? [] : [items[0].youtubeId] },
        inputTokens: 100,
        outputTokens: 50,
      };
    };
    const result = await haikuReviewProvider(provider)(
      original,
      controller.signal,
    );
    expect(calls).toBe(1);
    expect(result).toMatchObject({ inputTokens: 100, outputTokens: 50 });
  },
);

it('keeps measured charges from both stages when the review contains a duplicate', async () => {
  let calls = 0;
  const provider = anthropicProvider('fixture-only', async () =>
    Response.json(payload(++calls === 1 ? [0, 1, 2] : [0, 0])),
  );
  expect(
    await haikuReviewProvider(provider)(original, new AbortController().signal),
  ).toMatchObject({
    value: null,
    validationFailure: 'duplicate',
    inputTokens: 2000,
    outputTokens: 120,
  });
  expect(calls).toBe(2);
});

it('propagates an unknown review charge instead of returning the successful draft', async () => {
  let calls = 0;
  const provider: import('./anthropic').Provider = async () => {
    if (++calls === 2) throw new Error('transport failure');
    return {
      value: { youtubeIds: [items[0].youtubeId] },
      inputTokens: 100,
      outputTokens: 50,
    };
  };
  const progress: import('./haiku-review').HaikuReviewDiagnostic = {};
  await expect(
    haikuReviewProvider(provider, (value) => Object.assign(progress, value))(
      original,
      new AbortController().signal,
    ),
  ).rejects.toThrow('transport failure');
  expect(progress).toMatchObject({
    providerCallCount: 2,
    draftInputTokens: 100,
    draftOutputTokens: 50,
  });
  expect(progress.reviewInputTokens).toBeUndefined();
});

it.each(['duplicate', 'transport'] as const)(
  'settles the entire client request correctly after a review %s',
  async (mode) => {
    const { recommend } = await import('./recommendations');
    const { default: config } = await import('../wrangler.evaluation.json');
    let calls = 0;
    const fetcher: typeof fetch = async (url) => {
      if (!String(url).includes('api.anthropic.com'))
        return Response.json(catalog);
      if (++calls === 2 && mode === 'transport') throw new Error('transport');
      return Response.json(payload(calls === 1 ? [0, 1, 2] : [0, 0]));
    };
    const settle = vi.fn(async () => {});
    const diagnostic = vi.fn();
    const response = await recommend(
      new Request('https://test.example/api/recommendations', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + 'x'.repeat(32) },
        body: JSON.stringify({
          functionArea: null,
          goal: 'organize inventory',
          tools: [],
          catalogVersion: catalog.catalogVersion,
        }),
      }),
      {
        ...config.vars,
        LLM_ENABLED: 'true',
        LLM_TEST_EXPIRES_AT: '2099-01-01T00:00:00Z',
        ANTHROPIC_API_KEY: 'fixture-only',
        LLM_RATE_KEY: 'x'.repeat(32),
      },
      {
        fetch: fetcher,
        budget: { reserve: async () => ({ ok: true }), settle },
        clientKey: async () => 'a'.repeat(64),
        diagnostic,
      },
    );
    expect(await response.json()).toMatchObject({
      outcome: 'fallback',
      reason: mode === 'duplicate' ? 'invalid-response' : 'provider-error',
    });
    expect(calls).toBe(2);
    expect(settle).toHaveBeenCalledWith(
      expect.any(String),
      mode === 'duplicate' ? 260 : null,
    );
    expect(diagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        providerCallCount: 2,
        accountingFinal: true,
        draftInputTokens: 1000,
        draftOutputTokens: 60,
      }),
    );
    const reported = JSON.parse(
      response.headers.get('x-evaluation-diagnostic')!,
    );
    expect(reported.providerCallCount).toBe(2);
    if (mode === 'duplicate')
      expect(reported).toMatchObject({
        inputTokens: 2000,
        outputTokens: 120,
        costMicrodollars: 260,
        reviewInputTokens: 1000,
        reviewOutputTokens: 60,
      });
    else expect(reported.inputTokens).toBeUndefined();
  },
);
