import haikuConfig from '../wrangler.evaluation.json';
// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import config from '../wrangler.luna-test.json';
import snapshot from '../docs/evaluation/2026-10-30-luna-ranking/catalog.json';
import { parseBenchmark } from '../src/evaluation/benchmark';
import worker from './evaluation-worker';
import ordinaryWorker from './worker';
import { CatalogSourceSchema, readLimits } from './config';
import { EVALUATION_CATALOG_URL } from './evaluation-catalog-policy';
import { RecommendationBudget } from './budget-object';
import { TestStorage } from './test-helpers';

afterEach(() => vi.unstubAllGlobals());

describe('frozen test catalog isolation', () => {
  it.each(['openai', 'anthropic'])(
    'uses the frozen catalog through the real %s handler',
    async (provider) => {
      const isHaiku = provider === 'anthropic';
      const env = {
        ...(isHaiku ? haikuConfig.vars : config.vars),
        LLM_ENABLED: 'true',
        LLM_TEST_EXPIRES_AT: '2099-01-01T00:00:00Z',
        OPENAI_API_KEY: 'synthetic-key',
        ANTHROPIC_API_KEY: 'synthetic-key',
        LLM_RATE_KEY: 'x'.repeat(32),
      };
      const budget = new RecommendationBudget(
        { storage: new TestStorage() },
        env,
      );
      const fetcher = vi.fn<typeof fetch>(async () =>
        Response.json(
          isHaiku
            ? {
                stop_reason: 'end_turn',
                usage: { input_tokens: 1000, output_tokens: 20 },
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify({
                      workSteps: 'Prepare an AI policy',
                      ranks: Object.fromEntries(
                        Array.from({ length: 8 }, (_, i) => [
                          'rank' + (i + 1),
                          {
                            use: i < 2 ? 'Prepare an AI policy' : '',
                            position: i < 2 ? i : null,
                          },
                        ]),
                      ),
                    }),
                  },
                ],
              }
            : {
                id: 'synthetic',
                model: 'gpt-6-luna',
                status: 'completed',
                service_tier: 'fast',
                usage: { input_tokens: 1000, output_tokens: 20 },
                output: [
                  {
                    type: 'message',
                    content: [
                      {
                        type: 'output_text',
                        text: JSON.stringify({ positions: [0, 1] }),
                      },
                    ],
                  },
                ],
              },
        ),
      );
      vi.stubGlobal('fetch', fetcher);
      const request = new Request(
        new URL('/api/recommendations', EVALUATION_CATALOG_URL),
        {
          method: 'POST',
          headers: { 'CF-Connecting-IP': '192.0.2.1' },
          body: JSON.stringify({
            functionArea: 'Leadership',
            tools: [],
            goal: 'Prepare an AI policy',
            catalogVersion: snapshot.catalogVersion,
          }),
        },
      );
      const result = await worker.fetch(request, {
        ...env,
        RECOMMENDATION_BUDGET: {
          idFromName: (name) => name,
          get: () => budget,
        },
      });
      expect(await result.json()).toMatchObject({
        outcome: 'success',
        catalogVersion: snapshot.catalogVersion,
        youtubeIds: snapshot.items.slice(0, 2).map((item) => item.youtubeId),
      });
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(fetcher.mock.calls[0][0]).toBe(
        isHaiku
          ? 'https://api.anthropic.com/v1/messages'
          : 'https://api.openai.com/v1/responses',
      );
      const payload = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
      expect(
        JSON.parse(
          isHaiku ? payload.messages[0].content : payload.input[1].content,
        ).catalog,
      ).toHaveLength(isHaiku ? 48 : 89);
      if (isHaiku) {
        expect(payload.thinking).toEqual({ type: 'disabled' });
        expect(payload.output_config.effort).toBe('low');
        expect(payload.output_config.format.schema.required).toEqual([
          'workSteps',
          'ranks',
        ]);
      }
    },
  );
  it('preserves the original public catalog and serves it without network or model calls', async () => {
    const benchmark = parseBenchmark(
      JSON.parse(
        readFileSync(
          'docs/evaluation/2026-10-28-task-tags/benchmark.json',
          'utf8',
        ),
      ),
    );
    expect(snapshot).toEqual(benchmark.catalog);
    const fetcher = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetcher);
    const response = await worker.fetch(
      new Request(EVALUATION_CATALOG_URL),
      config.vars,
    );
    expect(await response.json()).toEqual(benchmark.catalog);
    const load = await worker.fetch(
      new Request(new URL('/api/catalog', EVALUATION_CATALOG_URL)),
      config.vars,
    );
    expect(load.status).toBe(200);
    expect(await load.json()).toEqual(benchmark.catalog);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('does not expose the snapshot from the ordinary Worker or another environment', async () => {
    const request = new Request(EVALUATION_CATALOG_URL);
    expect((await ordinaryWorker.fetch(request, config.vars)).status).toBe(404);
    for (const change of [
      { LLM_ENVIRONMENT: 'production' },
      { LLM_PROVIDER: 'anthropic' },
    ]) {
      expect(readLimits({ ...config.vars, ...change })).toBeNull();
      expect(
        (await worker.fetch(request, { ...config.vars, ...change })).status,
      ).toBe(404);
    }
    expect(
      (
        await worker.fetch(
          new Request(EVALUATION_CATALOG_URL, { method: 'POST' }),
          config.vars,
        )
      ).status,
    ).toBe(404);
  });
  it('permits only the exact frozen URL and keeps provider calls disabled', async () => {
    expect(CatalogSourceSchema.safeParse(EVALUATION_CATALOG_URL).success).toBe(
      true,
    );
    for (const suffix of ['?source=other', '#fragment', '/other'])
      expect(
        CatalogSourceSchema.safeParse(EVALUATION_CATALOG_URL + suffix).success,
      ).toBe(false);
    const fetcher = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetcher);
    const result = await worker.fetch(
      new Request(new URL('/api/recommendations', EVALUATION_CATALOG_URL), {
        method: 'POST',
        body: '{}',
      }),
      config.vars,
    );
    expect(await result.json()).toEqual({
      outcome: 'fallback',
      reason: 'disabled',
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
