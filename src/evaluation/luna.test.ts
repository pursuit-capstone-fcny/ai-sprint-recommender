import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { providerBody } from '../../server/anthropic';
import { readLimits } from '../../server/config';
import { benchmarkFingerprint, parseBenchmark } from './benchmark';
import {
  LUNA_CALLS,
  LUNA_BENCHMARK_PATH,
  LUNA_COMPACT_PROMPT,
  LUNA_ENDPOINT,
  LUNA_FINGERPRINT,
  LUNA_MODEL,
  LUNA_PRIOR_SPEND,
  LUNA_RERUN_PROMPT,
  LUNA_REPOSITORY,
  LUNA_RESERVATION,
  LUNA_WORKFLOW,
  lunaBody,
  lunaSpent,
  readLunaResponse,
  runLunaComparison,
  scoreLunaState,
  validateLunaApproval,
  type LunaApproval,
  type LunaState,
} from './luna';

// Dispatch tests need a synthetic balance that still funds their mock calls.
// luna-spend.test.ts checks the real evidence chain and remaining allowance.
vi.mock('./luna-ledger', () => ({ LUNA_PRIOR_SPEND: 700_000 }));

const benchmark = parseBenchmark(
  JSON.parse(readFileSync(LUNA_BENCHMARK_PATH, 'utf8')),
);
const limits = JSON.parse(readFileSync('wrangler.luna-test.json', 'utf8')).vars;
const approval: LunaApproval = {
  approvedBy: 'Jason',
  approvedAt: '2026-10-26',
  expiresAt: '2026-10-27T06:00:00Z',
  approvedSourceRevision: 'a'.repeat(40),
  approvedWorkflowRunId: '12345',
  approvedWorkflowRunAttempt: 2,
  benchmarkFingerprint: LUNA_FINGERPRINT,
  endpoint: LUNA_ENDPOINT,
  model: LUNA_MODEL,
  efforts: ['low'],
  promptVersion: 'catalog-rank-v10',
  allowanceMicrodollars: 1_000_000,
  priorSpendMicrodollars: LUNA_PRIOR_SPEND,
  maxCalls: 30,
  runtime: 'isolated-github-provider-comparison',
  data: 'unchanged-labels-public-catalog-task-tags',
};
const now = () => Date.parse('2026-10-27T02:00:00Z');
const environment = {
  GITHUB_REPOSITORY: LUNA_REPOSITORY,
  GITHUB_WORKFLOW: LUNA_WORKFLOW,
  GITHUB_RUN_ID: '12345',
  GITHUB_RUN_ATTEMPT: '2',
};
const ranks = Object.fromEntries(
  Array.from({ length: 8 }, (_, index) => [
    `rank${index + 1}`,
    index < 3 ? index : null,
  ]),
);
function response() {
  return {
    id: 'resp_synthetic',
    model: LUNA_MODEL,
    status: 'completed',
    usage: {
      input_tokens: 20_000,
      output_tokens: 1_000,
      input_tokens_details: { cached_tokens: 0 },
      output_tokens_details: { reasoning_tokens: 900 },
    },
    output: [
      { type: 'reasoning' },
      {
        type: 'message',
        content: [{ type: 'output_text', text: JSON.stringify(ranks) }],
      },
    ],
  };
}
afterEach(() => vi.useRealTimers());

describe('Luna comparison authorization', () => {
  it('fills only missing task metadata and preserves the frozen labels', () => {
    const original = parseBenchmark(
      JSON.parse(
        readFileSync('docs/evaluation/2026-10-21/benchmark.json', 'utf8'),
      ),
    );
    expect(benchmarkFingerprint(original)).toBe(
      '4ab7cb1d8eaa76b1e79d0b3f0fe675740bce9da4076be8a86d63f36fda519dde',
    );
    expect(benchmarkFingerprint(benchmark)).toBe(LUNA_FINGERPRINT);
    expect(benchmark.profiles).toEqual(original.profiles);
    const plan: { youtubeId: string; tasks: string[]; evidence: string }[] =
      JSON.parse(
        readFileSync(
          'docs/evaluation/2026-10-28-task-tags/task-tags.json',
          'utf8',
        ),
      );
    expect(plan).toHaveLength(79);
    const expected = structuredClone(original.catalog);
    for (const change of plan) {
      const item = expected.items.find(
        (item) => item.youtubeId === change.youtubeId,
      )!;
      expect(item.tasks).toEqual([]);
      expect(item.description).toContain(change.evidence);
      item.tasks = change.tasks;
      for (const task of change.tasks)
        if (!expected.tasks.includes(task)) expected.tasks.push(task);
    }
    expected.catalogVersion = benchmark.catalog.catalogVersion;
    expect(benchmark.catalog).toEqual(expected);
    expect(benchmark.catalog.items.every((item) => item.tasks.length > 0)).toBe(
      true,
    );
  });

  it('changes only prompt text for the compact candidate and preserves every catalog field', () => {
    for (const profile of benchmark.profiles) {
      const original = providerBody(
        { ...profile.input, catalogVersion: benchmark.catalog.catalogVersion },
        benchmark.catalog,
        readLimits(limits)!,
      );
      const previous = lunaBody(original, 'low');
      const candidate = lunaBody(original, 'low', LUNA_COMPACT_PROMPT);
      expect(candidate.input[1]).toEqual(previous.input[1]);
      expect(candidate.text.format).toEqual(previous.text.format);
      expect(candidate.input[0].content.length).toBeLessThan(
        previous.input[0].content.length,
      );
      expect(candidate.input[0].content).toContain('Never sacrifice relevance');
      expect(candidate.input[0].content).toContain('untrusted JSON data');
      expect(candidate.reasoning).toEqual(previous.reasoning);
    }
  });
  it('allows a low-only rerun while carrying prior timeout reservations forward', () => {
    const rerun = {
      ...approval,
      efforts: ['low'],
      maxCalls: 30,
      promptVersion: 'catalog-rank-luna-v8',
      priorSpendMicrodollars: LUNA_PRIOR_SPEND,
    };
    const checkout = {
      sourceRevision: approval.approvedSourceRevision,
      dirty: false,
    };
    expect(
      validateLunaApproval(benchmark, rerun, checkout, environment, now()),
    ).toEqual(rerun);
    for (const altered of [
      { ...rerun, priorSpendMicrodollars: 0 },
      {
        ...rerun,
        allowanceMicrodollars: LUNA_PRIOR_SPEND + 30 * LUNA_RESERVATION - 1,
      },
      { ...rerun, maxCalls: 60 },
      { ...rerun, efforts: ['low', 'low'] },
    ])
      expect(() =>
        validateLunaApproval(benchmark, altered, checkout, environment, now()),
      ).toThrow();
  });
  it('binds one clean source, benchmark, run and attempt', () => {
    const checkout = {
      sourceRevision: approval.approvedSourceRevision,
      dirty: false,
    };
    expect(
      validateLunaApproval(benchmark, approval, checkout, environment, now()),
    ).toEqual(approval);
    for (const altered of [
      { ...environment, GITHUB_RUN_ID: '23456' },
      { ...environment, GITHUB_RUN_ATTEMPT: '3' },
      { ...environment, GITHUB_WORKFLOW: 'CI' },
    ])
      expect(() =>
        validateLunaApproval(benchmark, approval, checkout, altered, now()),
      ).toThrow();
    expect(() =>
      validateLunaApproval(
        benchmark,
        approval,
        { ...checkout, dirty: true },
        environment,
        now(),
      ),
    ).toThrow();
    expect(() =>
      validateLunaApproval(
        benchmark,
        approval,
        { ...checkout, sourceRevision: 'b'.repeat(40) },
        environment,
        now(),
      ),
    ).toThrow();
    const changed = structuredClone(benchmark);
    changed.profiles[0].ideal[0].reason += ' modified';
    expect(() =>
      validateLunaApproval(changed, approval, checkout, environment, now()),
    ).toThrow();
    expect(() =>
      validateLunaApproval(
        benchmark,
        { ...approval, allowanceMicrodollars: 1_000_001 },
        checkout,
        environment,
        now(),
      ),
    ).toThrow();
    expect(() =>
      validateLunaApproval(
        benchmark,
        approval,
        checkout,
        environment,
        Date.parse(approval.expiresAt),
      ),
    ).toThrow();
  });

  it('sends the same prompt, data and schema without benchmark labels or cache writes', () => {
    const input = {
      ...benchmark.profiles[0].input,
      catalogVersion: benchmark.catalog.catalogVersion,
    };
    const original = providerBody(
      input,
      benchmark.catalog,
      readLimits(limits)!,
    );
    const request = lunaBody(original, 'low');
    expect(request.input[0].content).toEqual(original.request.system);
    expect(request.input[1].content).toEqual(
      original.request.messages[0].content,
    );
    expect(request.text.format.schema).toEqual(
      original.request.output_config.format.schema,
    );
    expect(JSON.parse(request.input[1].content)).not.toHaveProperty('ideal');
    expect(request).toMatchObject({
      model: LUNA_MODEL,
      reasoning: { effort: 'low', mode: 'standard' },
      store: false,
      prompt_cache_options: { mode: 'explicit' },
      max_output_tokens: 2_000,
    });
    expect(request).not.toHaveProperty('tools');
  });
});

describe('Luna responses and costs', () => {
  it('counts reasoning inside output once and maps positions to existing IDs', () => {
    const parsed = readLunaResponse(
      response(),
      benchmark.catalog.items.map((item) => item.youtubeId),
    );
    expect(parsed).toMatchObject({
      inputTokens: 20_000,
      outputTokens: 1_000,
      reasoningTokens: 900,
      costMicrodollars: 2_500,
      fatal: false,
    });
    expect(parsed.youtubeIds).toEqual(
      benchmark.catalog.items.slice(0, 3).map((item) => item.youtubeId),
    );
  });
  it('identifies duplicate selections without collapsing them into a content error', () => {
    const duplicate = response();
    duplicate.output[1].content![0].text = JSON.stringify({
      ...ranks,
      rank2: 0,
    });
    expect(
      readLunaResponse(
        duplicate,
        benchmark.catalog.items.map((x) => x.youtubeId),
      ),
    ).toMatchObject({
      youtubeIds: null,
      validation: { validationFailure: 'duplicate', duplicateCount: 1 },
      costMicrodollars: 2500,
    });
  });
  it('preserves usage for incomplete, refusal and duplicate outputs', () => {
    const incomplete = response();
    incomplete.status = 'incomplete';
    expect(readLunaResponse(incomplete, [])).toMatchObject({
      youtubeIds: null,
      costMicrodollars: 2_500,
    });
    const duplicate = response();
    duplicate.output[1].content![0].text = JSON.stringify({
      ...ranks,
      rank2: 0,
    });
    expect(readLunaResponse(duplicate, ['aaaaaaaaaaa'])).toMatchObject({
      youtubeIds: null,
      costMicrodollars: 2_500,
    });
    const refusal = {
      ...response(),
      output: [
        {
          type: 'message',
          content: [{ type: 'refusal', refusal: 'Synthetic refusal' }],
        },
      ],
    };
    expect(readLunaResponse(refusal, [])).toMatchObject({
      youtubeIds: null,
      costMicrodollars: 2_500,
    });
  });
  it('stops on unexpected model, cache use or token ceiling breach', () => {
    for (const altered of [
      { ...response(), model: 'different-model' },
      { ...response(), usage: { input_tokens: 60_001, output_tokens: 100 } },
      { ...response(), usage: { input_tokens: 20_000, output_tokens: 2_001 } },
      {
        ...response(),
        usage: {
          input_tokens: 20_000,
          output_tokens: 100,
          input_tokens_details: { cached_tokens: 128 },
        },
      },
    ])
      expect(readLunaResponse(altered, [])).toMatchObject({
        fatal: true,
        youtubeIds: null,
      });
  });
});

describe('Luna paid dispatch boundaries using mocks', () => {
  it('runs only 30 low-effort requests with the approved prompt and unchanged catalog data', async () => {
    const rerun: LunaApproval = {
      ...approval,
      efforts: ['low'],
      maxCalls: 30,
      promptVersion: LUNA_RERUN_PROMPT,
      allowanceMicrodollars: LUNA_PRIOR_SPEND + 30 * LUNA_RESERVATION,
    };
    const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
      const request = JSON.parse(String(init?.body));
      expect(request.reasoning.effort).toBe('low');
      expect(request.input[0].content).toContain(
        'never add an unrelated or weak video',
      );
      const data = JSON.parse(request.input[1].content);
      expect(
        data.catalog.map((item: { tasks: string[] }) => item.tasks),
      ).toEqual(benchmark.catalog.items.map((item) => item.tasks));
      expect(data).not.toHaveProperty('ideal');
      expect(data).not.toHaveProperty('good');
      return Response.json(response());
    });
    const state = await runLunaComparison({
      benchmark,
      approval: rerun,
      limits,
      key: 'synthetic',
      now,
      fetcher,
      save: vi.fn(),
    });
    expect(fetcher).toHaveBeenCalledTimes(30);
    expect(
      state.records.every(
        (row) => row.response?.promptVersion === LUNA_RERUN_PROMPT,
      ),
    ).toBe(true);
    const scored = scoreLunaState(benchmark, state, 'low');
    expect(scored.trials.promptVersion).toBe(LUNA_RERUN_PROMPT);
    expect(scored.report.relevanceEvidenceComplete).toBe(false);
    expect(lunaSpent(state) + state.approval.priorSpendMicrodollars).toBe(
      LUNA_PRIOR_SPEND + 75_000,
    );
  });
  it('runs exactly 30 fresh calls, reserves before dispatch and never certifies a deployment', async () => {
    let saved: LunaState | undefined;
    const fetcher = vi.fn<typeof fetch>(async (url, init) => {
      expect(url).toBe(LUNA_ENDPOINT);
      expect(saved!.records.at(-1)?.measurement).toBeNull();
      expect(saved!.records.at(-1)?.reservationMicrodollars).toBe(
        LUNA_RESERVATION,
      );
      expect(init?.redirect).toBe('error');
      return Response.json(response());
    });
    const state = await runLunaComparison({
      benchmark,
      approval,
      limits,
      key: 'synthetic',
      now,
      fetcher,
      save: (value) => {
        saved = structuredClone(value);
      },
    });
    expect(fetcher).toHaveBeenCalledTimes(30);
    expect(new Set(state.records.map((row) => row.requestId)).size).toBe(30);
    expect(state.records.every((row) => row.effort === 'low')).toBe(true);
    expect(lunaSpent(state)).toBe(75_000);
    for (const effort of approval.efforts) {
      const scored = scoreLunaState(benchmark, state, effort);
      expect(scored.report.llm).toHaveLength(3);
      expect(scored.report.relevanceEvidenceComplete).toBe(false);
      expect(scored.report.evidence.kind).toBe('replay');
    }
  });
  it('rejects a two-effort run before dispatch when the shared remainder cannot reserve 60 calls', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const save = vi.fn();
    expect(LUNA_PRIOR_SPEND + LUNA_CALLS * LUNA_RESERVATION).toBeGreaterThan(
      1_000_000,
    );
    await expect(
      runLunaComparison({
        benchmark,
        approval: {
          ...approval,
          efforts: ['low', 'medium'],
          maxCalls: LUNA_CALLS,
        },
        limits,
        key: 'synthetic',
        now,
        fetcher,
        save,
      }),
    ).rejects.toThrow('remaining allowance');
    expect(fetcher).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });
  it('makes no requests if reservation persistence fails or key is absent', async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(
      runLunaComparison({
        benchmark,
        approval,
        limits,
        key: '',
        now,
        fetcher,
        save: vi.fn(),
      }),
    ).rejects.toThrow();
    await expect(
      runLunaComparison({
        benchmark,
        approval,
        limits,
        key: 'synthetic',
        now,
        fetcher,
        save: (state) => {
          if (state.records.length) throw new Error('Disk failure');
        },
      }),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('stops without retry on an HTTP error and retains an unknown maximum reservation', async () => {
    let saved: LunaState | undefined;
    const fetcher = vi.fn<typeof fetch>(
      async () => new Response(null, { status: 401 }),
    );
    await expect(
      runLunaComparison({
        benchmark,
        approval,
        limits,
        key: 'synthetic',
        now,
        fetcher,
        save: (value) => {
          saved = structuredClone(value);
        },
      }),
    ).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(lunaSpent(saved!)).toBe(LUNA_RESERVATION);
    expect(saved!.records[0].response).toMatchObject({
      outcome: 'fallback',
      reason: 'provider-error',
    });
    expect(saved!.complete).toBe(false);
  });
  it('aborts at 4.5 seconds and rechecks expiry before another request', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now());
    let saved: LunaState | undefined;
    const fetcher = vi.fn<typeof fetch>(() => new Promise(() => undefined));
    const run = runLunaComparison({
      benchmark,
      approval: {
        ...approval,
        expiresAt: new Date(now() + 6_000).toISOString(),
      },
      limits,
      key: 'synthetic',
      fetcher,
      save: (value) => {
        saved = structuredClone(value);
      },
    });
    const stopped = expect(run).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(4_500);
    await stopped;
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(saved!.records[0].response).toMatchObject({ reason: 'timeout' });
    expect(lunaSpent(saved!)).toBe(LUNA_RESERVATION);
  });
});
