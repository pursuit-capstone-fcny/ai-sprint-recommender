// @vitest-environment node
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { catalogDataJson } from '../src/library/catalog';
import { scoringBody, catalogScoringProvider } from './full-catalog-provider';
import {
  catalogFixture,
  inputFixture,
  assessmentFixture,
} from './scoring-test-helpers';
import { recommend, SCORING_SERVER_DEADLINE_MS } from './recommendations';
import { environment } from './test-helpers';
import type { Budget } from './budget';

const usage = { input_tokens: 21000, output_tokens: 7000 };
const rowsOf = (catalog: ReturnType<typeof catalogFixture>) =>
  catalog.items.map((item, position) => ({
    position,
    title: item.title,
    description: item.description,
    functionAreas: item.functionAreas,
    tasks: item.tasks,
    tools: item.tools,
    lengthSeconds: item.lengthSeconds,
    addedAt: item.addedAt,
    startHere: item.startHere,
  }));
const providerResponse = (value: unknown, stop = 'end_turn') =>
  Response.json({
    stop_reason: stop,
    content: [{ type: 'text', text: JSON.stringify(value) }],
    usage,
  });
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('V1 Haiku provider transport', () => {
  it.each([
    'Copilot',
    'For example, I coordinate volunteers and need help planning outreach.',
  ])(
    'AC-PROD-5: sends broad discovery goals with an explicit discovery policy: %s',
    async (goal) => {
      const fetcher = vi.fn<typeof fetch>(async () =>
        providerResponse(assessmentFixture()),
      );
      const result = await catalogScoringProvider('fixture-only', fetcher)(
        scoringBody({ ...inputFixture(), goal }, catalogFixture()),
        new AbortController().signal,
      );
      const wire = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
      expect(wire.system).toContain(
        'A tool-only inquiry is a valid discovery goal',
      );
      expect(wire.system).toContain(
        'A role, mission or topic description is also a valid discovery goal',
      );
      expect(wire.system).toContain(
        'do not require a concrete task for discovery',
      );
      expect(wire.system).toContain('Do not pad broad discovery');
      expect(JSON.parse(wire.messages[0].content[1].text).goal).toBe(goal);
      expect(JSON.parse(wire.messages[0].content[0].text).catalog).toHaveLength(
        89,
      );
      expect(result.value).toEqual({
        youtubeIds: ['scoring0000', 'scoring0001'],
        reasons: Array(2).fill('Teaches checking the records before writing.'),
      });
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it('sends the complete prepared V1 request once and returns only validated IDs', async () => {
    const body = scoringBody(inputFixture(), catalogFixture());
    const fetcher = vi.fn<typeof fetch>(async () =>
      providerResponse(assessmentFixture()),
    );
    const result = await catalogScoringProvider('fixture-only', fetcher)(
      body,
      new AbortController().signal,
    );
    expect(result).toEqual({
      value: {
        youtubeIds: ['scoring0000', 'scoring0001'],
        reasons: Array(2).fill('Teaches checking the records before writing.'),
      },
      inputTokens: 21000,
      outputTokens: 7000,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const wire = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    expect(JSON.parse(wire.messages[0].content[0].text).catalog).toEqual(
      rowsOf(catalogFixture()),
    );
    expect(wire).toMatchObject({
      model: 'claude-haiku-5-5',
      max_tokens: 2000,
      thinking: { type: 'disabled' },
      output_config: { effort: 'low' },
    });
    expect(JSON.stringify(wire)).not.toContain('fixture-only');
  });
  it.each(['an out-of-range position', 'an extra field', 'a missing decision'])(
    'preserves usage when %s rejects the response',
    async (failure) => {
      const value: Record<string, unknown> = assessmentFixture();
      if (failure === 'an out-of-range position')
        value.picks = [{ ...assessmentFixture().picks[0], position: 89 }];
      if (failure === 'an extra field') value.override = 'approved';
      if (failure === 'a missing decision') delete value.noWork;
      const result = await catalogScoringProvider(
        'fixture-only',
        vi.fn(async () => providerResponse(value)),
      )(
        scoringBody(inputFixture(), catalogFixture()),
        new AbortController().signal,
      );
      expect(result).toEqual({
        value: null,
        validationFailure: 'schema',
        inputTokens: 21000,
        outputTokens: 7000,
      });
    },
  );
  it('preserves known usage for malformed JSON and truncated responses', async () => {
    const body = scoringBody(inputFixture(), catalogFixture());
    for (const [text, stop, failure] of [
      ['{', 'end_turn', 'json'],
      ['{}', 'max_tokens', 'max-tokens'],
    ]) {
      const fetcher = vi.fn(async () =>
        Response.json({
          stop_reason: stop,
          content: [{ type: 'text', text }],
          usage,
        }),
      );
      expect(
        await catalogScoringProvider('fixture-only', fetcher)(
          body,
          new AbortController().signal,
        ),
      ).toMatchObject({
        value: null,
        validationFailure: failure,
        inputTokens: 21000,
        outputTokens: 7000,
      });
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });
  it('preserves an empty pick list without a rules substitute', async () => {
    const value = { noWork: false, goalType: 'task', picks: [] };
    const result = await catalogScoringProvider(
      'fixture-only',
      vi.fn(async () => providerResponse(value)),
    )(
      scoringBody(inputFixture(), catalogFixture()),
      new AbortController().signal,
    );
    expect(result.value).toEqual({ youtubeIds: [], reasons: [] });
  });
  it('does not retry failed HTTP requests', async () => {
    const fetcher = vi.fn(
      async () => new Response('unavailable', { status: 503 }),
    );
    await expect(
      catalogScoringProvider('fixture-only', fetcher)(
        scoringBody(inputFixture(), catalogFixture()),
        new AbortController().signal,
      ),
    ).rejects.toThrow('Provider failed');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

function endpointSetup(count = 89) {
  const catalog = catalogFixture(count);
  catalog.catalogVersion = `sha256:${createHash('sha256').update(catalogDataJson(catalog)).digest('hex')}`;
  const input = { ...inputFixture(), catalogVersion: catalog.catalogVersion };
  const assessment = assessmentFixture();
  const fetcher = vi.fn<typeof fetch>(async (url) => {
    const path = String(url);
    if (path === 'https://api.anthropic.com/v1/messages')
      return providerResponse(assessment);
    if (path.endsWith('/current.json'))
      return Response.json({
        schemaVersion: 1,
        catalogVersion: catalog.catalogVersion,
        publishedAt: '2026-11-02T00:00:00Z',
      });
    return Response.json(catalog);
  });
  const budget = {
    reserve: vi.fn<Budget['reserve']>(async () => ({ ok: true })),
    settle: vi.fn(async () => undefined),
  };
  const env = {
    ...environment,
    LLM_MODEL: 'claude-haiku-5-5',
    LLM_MAX_INPUT_TOKENS: '63000',
    LLM_MAX_OUTPUT_TOKENS: '16384',
    LLM_INPUT_MICRODOLLARS_PER_MILLION: '100000',
    LLM_OUTPUT_MICRODOLLARS_PER_MILLION: '500000',
  };
  const request = () =>
    new Request('https://example.test/api/recommendations', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  return {
    catalog,
    input,
    assessment,
    fetcher,
    budget,
    env,
    request,
    deps: { fetch: fetcher, budget, clientKey: async () => 'fixture-client' },
  };
}
describe('V1 endpoint integration', () => {
  it.each([1, 88, 89, 90])(
    'AC-63.8: dispatches the complete %i-item catalog once and returns a pick from its last row',
    async (count) => {
      const s = endpointSetup(count);
      s.assessment.picks = [
        {
          position: count - 1,
          grade: 3,
          quote: 'Check records before drafting a report.',
          rationale: 'Teaches record checking.',
        },
      ];
      const response = await recommend(s.request(), s.env, s.deps);
      expect(await response.json()).toMatchObject({
        outcome: 'success',
        youtubeIds: [s.catalog.items.at(-1)!.youtubeId],
        catalogVersion: s.catalog.catalogVersion,
      });
      const calls = s.fetcher.mock.calls.filter(([url]) =>
        String(url).includes('api.anthropic.com'),
      );
      expect(calls).toHaveLength(1);
      expect(
        JSON.parse(
          JSON.parse(String(calls[0][1]?.body)).messages[0].content[0].text,
        ).catalog,
      ).toEqual(rowsOf(s.catalog));
      expect(s.budget.reserve).toHaveBeenCalledTimes(1);
      expect(s.budget.settle).toHaveBeenCalledTimes(1);
    },
  );

  it('loads the trusted static snapshot, reserves the full maximum and settles the measured call', async () => {
    const s = endpointSetup();
    const response = await recommend(s.request(), s.env, s.deps);
    expect(await response.json()).toMatchObject({
      outcome: 'success',
      youtubeIds: ['scoring0000', 'scoring0001'],
      promptVersion: 'catalog-pick-evidence-v9',
    });
    expect(s.budget.reserve).toHaveBeenCalledWith(
      expect.any(String),
      'fixture-client',
      14492,
      expect.any(Number),
    );
    expect(s.budget.settle).toHaveBeenCalledWith(expect.any(String), 5600);
    const providerCalls = s.fetcher.mock.calls.filter(([url]) =>
      String(url).includes('api.anthropic.com'),
    );
    expect(providerCalls).toHaveLength(1);
    expect(
      JSON.parse(
        JSON.parse(String(providerCalls[0][1]?.body)).messages[0].content[0]
          .text,
      ).catalog,
    ).toEqual(rowsOf(s.catalog));
  });
  it.each([
    'disabled',
    'budget-exhausted',
    'undersized output limit',
    'undersized input limit',
    'empty catalog',
    'oversized complete catalog',
  ])('does not dispatch a paid call for %s', async (failure) => {
    const s = endpointSetup();
    if (failure === 'disabled') s.env.LLM_ENABLED = 'false';
    if (failure === 'undersized output limit')
      s.env.LLM_MAX_OUTPUT_TOKENS = '1000';
    if (failure === 'undersized input limit') s.env.LLM_MAX_INPUT_TOKENS = '1';
    if (failure === 'empty catalog') s.catalog.items = [];
    if (failure === 'oversized complete catalog')
      s.catalog.items[0].description = 'x'.repeat(80_000);
    s.catalog.catalogVersion = `sha256:${createHash('sha256').update(catalogDataJson(s.catalog)).digest('hex')}`;
    s.input.catalogVersion = s.catalog.catalogVersion;
    if (failure === 'budget-exhausted')
      s.budget.reserve.mockImplementation(async () => ({
        ok: false,
        reason: 'budget-exhausted',
      }));
    const response = await recommend(s.request(), s.env, s.deps);
    expect((await response.json()).outcome).toBe('fallback');
    expect(
      s.fetcher.mock.calls.filter(([url]) =>
        String(url).includes('api.anthropic.com'),
      ),
    ).toHaveLength(0);
    expect(s.budget.reserve).toHaveBeenCalledTimes(
      failure === 'budget-exhausted' ? 1 : 0,
    );
  });
  it('has a 6.5-second server window inside the 7-second browser window', () => {
    expect(SCORING_SERVER_DEADLINE_MS).toBe(6500);
  });
});
