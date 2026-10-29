import { readFileSync } from 'node:fs';
import { parseBenchmark } from '../src/evaluation/benchmark';
import haikuConfig from '../wrangler.evaluation.json';
// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import config from '../wrangler.luna-test.json';
import { catalog, TestStorage } from './test-helpers';
import { readLimits } from './config';
import { providerBody } from './anthropic';
import { lunaBody, lunaProvider } from './luna';
import { recommend } from './recommendations';
import worker from './worker';
import { RecommendationBudget, type BudgetNamespace } from './budget-object';
import type { Ledger } from './budget';
import { LUNA_PRIOR_SPEND } from '../src/evaluation/luna-ledger';

const env = {
  ...config.vars,
  LLM_ENABLED: 'true',
  LLM_TEST_EXPIRES_AT: '2099-01-01T00:00:00Z',
  OPENAI_API_KEY: 'fixture-key',
  LLM_RATE_KEY: 'x'.repeat(32),
};
const intake = {
  functionArea: 'Operations',
  goal: 'organize budget data',
  tools: ['Excel'],
  catalogVersion: catalog.catalogVersion,
};
const request = () =>
  new Request('https://test.example/api/recommendations', {
    method: 'POST',
    headers: { 'CF-Connecting-IP': '192.0.2.1' },
    body: JSON.stringify(intake),
  });
const output = (positions = [1, 2, 3]) => ({
  id: 'fixture-response',
  model: 'gpt-6-luna',
  status: 'completed',
  output: [
    { type: 'reasoning', summary: [] },
    {
      type: 'message',
      content: [
        {
          type: 'output_text',
          text: JSON.stringify(
            Object.fromEntries(
              Array.from({ length: 10 }, (_, i) => [
                `rank${i + 1}`,
                positions[i] ?? null,
              ]),
            ),
          ),
        },
      ],
    },
  ],
  usage: {
    input_tokens: 1000,
    output_tokens: 200,
    output_tokens_details: { reasoning_tokens: 150 },
    input_tokens_details: { cached_tokens: 0 },
  },
});
function budgetObject() {
  const storage = new TestStorage();
  const object = new RecommendationBudget({ storage }, env);
  const namespace: BudgetNamespace = {
    idFromName: vi.fn((name) => name),
    get: () => object,
  };
  return { storage, object, namespace };
}
describe('deployed Luna low candidate', () => {
  it('uses the exact comparison request and counts reasoning inside output only once', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json(output()));
    const body = providerBody(intake, catalog, readLimits(env)!);
    const measured = await lunaProvider('fixture-key', fetcher)(
      body,
      new AbortController().signal,
    );
    expect(fetcher.mock.calls[0][0]).toBe(
      'https://api.openai.com/v1/responses',
    );
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual(
      lunaBody(body, 'low'),
    );
    expect(measured).toMatchObject({
      inputTokens: 1000,
      outputTokens: 200,
      reasoningTokens: 150,
      value: { youtubeIds: catalog.items.slice(1, 4).map((x) => x.youtubeId) },
    });
  });
  it('routes through the deployed handler and persists measured spend above the original allowance floor', async () => {
    const { storage, namespace } = budgetObject();
    const fetcher = vi.fn<typeof fetch>(async (url) =>
      String(url).includes('script.google.com')
        ? Response.json(catalog)
        : Response.json(output()),
    );
    const diagnostic = vi.fn();
    const response = await recommend(
      request(),
      { ...env, RECOMMENDATION_BUDGET: namespace },
      { fetch: fetcher, diagnostic },
    );
    expect(await response.json()).toMatchObject({
      outcome: 'success',
      modelVersion: 'gpt-6-luna',
      promptVersion: 'catalog-rank-v7',
    });
    expect(namespace.idFromName).toHaveBeenCalledWith('test:gpt-6-luna');
    expect((await storage.get<Ledger>('ledger'))?.total).toBe(
      LUNA_PRIOR_SPEND + 200,
    );
    expect(diagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        costMicrodollars: 200,
        outputTokens: 200,
        reasoningTokens: 150,
        reservedMicrodollars: 7000,
      }),
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it.each([
    { LLM_ENABLED: 'false' },
    { LLM_ENVIRONMENT: 'production' },
    { LLM_REASONING_EFFORT: 'medium' },
    { OPENAI_API_KEY: undefined },
    { LLM_PRIOR_MICRODOLLARS: undefined },
    { LLM_ALLOWANCE_MICRODOLLARS: undefined },
    { LLM_TEST_EXPIRES_AT: '2020-01-01T00:00:00Z' },
    { LLM_MODEL: 'different-model' },
    { LLM_INPUT_MICRODOLLARS_PER_MILLION: '1' },
  ])(
    'fails closed for unsupported or disabled configuration %j',
    async (override) => {
      const fetcher = vi.fn<typeof fetch>();
      const { namespace } = budgetObject();
      const response = await recommend(
        request(),
        { ...env, ...override, RECOMMENDATION_BUDGET: namespace },
        { fetch: fetcher },
      );
      expect((await response.json()).outcome).toBe('fallback');
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
  it('retains measured usage on invalid output and full reservation on transport failure, with no retry', async () => {
    for (const mode of ['duplicate', 'transport']) {
      const { storage, namespace } = budgetObject();
      const fetcher = vi.fn<typeof fetch>(async (url) => {
        if (String(url).includes('script.google.com'))
          return Response.json(catalog);
        if (mode === 'transport') throw new Error('private provider body');
        return Response.json(output([1, 1]));
      });
      const response = await recommend(
        request(),
        { ...env, RECOMMENDATION_BUDGET: namespace },
        { fetch: fetcher, diagnostic: () => {} },
      );
      expect((await response.json()).reason).toBe(
        mode === 'duplicate' ? 'invalid-response' : 'provider-error',
      );
      expect((await storage.get<Ledger>('ledger'))?.total).toBe(
        LUNA_PRIOR_SPEND + (mode === 'duplicate' ? 200 : 7000),
      );
      expect(fetcher).toHaveBeenCalledTimes(2);
    }
  });
  it('accepts every full tagged benchmark request under the Haiku guard before dispatch', async () => {
    const benchmark = parseBenchmark(
      JSON.parse(
        readFileSync(
          'docs/evaluation/2026-10-28-task-tags/benchmark.json',
          'utf8',
        ),
      ),
    );
    const haikuEnv = {
      ...haikuConfig.vars,
      LLM_ENABLED: 'true',
      LLM_TEST_EXPIRES_AT: '2099-01-01T00:00:00Z',
      ANTHROPIC_API_KEY: 'fixture-only',
      LLM_RATE_KEY: 'x'.repeat(32),
    };
    const provider = vi.fn(async () => ({
      value: {
        youtubeIds: benchmark.catalog.items.slice(0, 3).map((x) => x.youtubeId),
      },
      inputTokens: 20000,
      outputTokens: 72,
    }));
    for (const profile of benchmark.profiles) {
      const request = new Request('https://test.example/api/recommendations', {
        method: 'POST',
        body: JSON.stringify({
          ...profile.input,
          catalogVersion: benchmark.catalog.catalogVersion,
        }),
      });
      const response = await recommend(request, haikuEnv, {
        fetch: async () => Response.json(benchmark.catalog),
        provider,
        clientKey: async () => 'a'.repeat(64),
        budget: { reserve: async () => ({ ok: true }), settle: async () => {} },
        diagnostic: () => {},
      });
      expect((await response.json()).outcome).toBe('success');
    }
    expect(provider).toHaveBeenCalledTimes(10);
  });
  it('carries Luna spend into Haiku on the same object and preserves the allowance ceiling', async () => {
    const storage = new TestStorage();
    const priorTotal = LUNA_PRIOR_SPEND + 200;
    await storage.put('ledger', {
      day: '',
      month: '',
      daily: 0,
      monthly: 0,
      total: priorTotal,
      minute: 0,
      requests: 0,
      clients: {},
      reservations: {},
    });
    const haikuEnv = {
      ...haikuConfig.vars,
      LLM_ENABLED: 'true',
      LLM_TEST_EXPIRES_AT: '2099-01-01T00:00:00Z',
      ANTHROPIC_API_KEY: 'fixture-only',
      LLM_RATE_KEY: 'x'.repeat(32),
    };
    const object = new RecommendationBudget({ storage }, haikuEnv);
    const namespace: BudgetNamespace = {
      idFromName: vi.fn((name) => name),
      get: () => object,
    };
    const fetcher = vi.fn<typeof fetch>(async (url) =>
      String(url).includes('script.google.com')
        ? Response.json(catalog)
        : Response.json({
            stop_reason: 'end_turn',
            usage: { input_tokens: 1000, output_tokens: 100 },
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  Object.fromEntries(
                    Array.from({ length: 10 }, (_, i) => [
                      'rank' + (i + 1),
                      i < 3 ? i : null,
                    ]),
                  ),
                ),
              },
            ],
          }),
    );
    const response = await recommend(
      request(),
      { ...haikuEnv, RECOMMENDATION_BUDGET: namespace },
      { fetch: fetcher, diagnostic: () => {} },
    );
    expect((await response.json()).outcome).toBe('success');
    expect(namespace.idFromName).toHaveBeenCalledWith('test:gpt-6-luna');
    expect((await storage.get<Ledger>('ledger'))?.total).toBe(priorTotal + 150);
    const saved = (await storage.get<Ledger>('ledger'))!;
    saved.total = 999_999;
    await storage.put('ledger', saved);
    fetcher.mockClear();
    const blocked = await recommend(
      request(),
      { ...haikuEnv, RECOMMENDATION_BUDGET: namespace },
      { fetch: fetcher, diagnostic: () => {} },
    );
    expect((await blocked.json()).reason).toBe('budget-exhausted');
    expect(fetcher).toHaveBeenCalledTimes(1);
    const summary = await worker.fetch(
      new Request('https://test.example/api/test-budget', {
        headers: { Authorization: 'Bearer ' + haikuEnv.LLM_RATE_KEY },
      }),
      { ...haikuEnv, LLM_ENABLED: 'false', RECOMMENDATION_BUDGET: namespace },
    );
    expect(await summary.json()).toEqual({
      allowanceMicrodollars: 1000000,
      spentMicrodollars: 999999,
    });
  });
  it('restricts budget readback to the test runner and exposes only cumulative amounts', async () => {
    const { namespace } = budgetObject();
    const get = (auth: string) =>
      new Request('https://test.example/api/test-budget', {
        headers: { Authorization: auth },
      });
    for (const environment of ['test', 'production']) {
      const response = await worker.fetch(get('wrong'), {
        ...env,
        LLM_ENVIRONMENT: environment,
        RECOMMENDATION_BUDGET: namespace,
      });
      expect(response.status).toBe(404);
    }
    expect(
      (
        await worker.fetch(get(`Bearer ${env.LLM_RATE_KEY}`), {
          ...env,
          LLM_ENVIRONMENT: 'production',
          RECOMMENDATION_BUDGET: namespace,
        })
      ).status,
    ).toBe(404);
    const response = await worker.fetch(get(`Bearer ${env.LLM_RATE_KEY}`), {
      ...env,
      LLM_ENABLED: 'false',
      RECOMMENDATION_BUDGET: namespace,
    });
    expect(await response.json()).toEqual({
      allowanceMicrodollars: 1000000,
      spentMicrodollars: LUNA_PRIOR_SPEND,
    });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});
