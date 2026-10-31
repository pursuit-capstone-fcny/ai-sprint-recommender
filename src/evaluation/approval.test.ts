// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../fixtures/evaluation/draft-benchmark.json';
import { parseBenchmark, benchmarkFingerprint } from './benchmark';
import {
  LiveApprovalSchema,
  readCheckout,
  validateLiveApproval,
} from './approval';
import { runLiveTrials } from './live';
import { LUNA_PRIOR_SPEND } from './luna-ledger';

// Approval behavior must not assume the real, monotonically spent allowance
// still funds another run. Hashes and the actual balance are checked in luna-spend.test.ts.
vi.mock('./luna-ledger', () => ({ LUNA_PRIOR_SPEND: 700_000 }));

const benchmark = parseBenchmark(fixture);
benchmark.approval = {
  status: 'approved',
  approvedAt: '2026-10-20',
  approvedBy: 'Test reviewer',
  evidence: 'Synthetic test only',
};
const checkout = { sourceRevision: 'a'.repeat(40), dirty: false };
const approval = {
  approvedSourceRevision: checkout.sourceRevision,
  approvedWorkflowRunId: '123',
  approvedWorkflowRunAttempt: 1,
  expiresAt: '2026-10-22T00:00:00Z',
  benchmarkFingerprint: benchmarkFingerprint(benchmark),
  environment: 'test',
  endpoint:
    'https://ai-sprint-recommender-llm-test.jason-zeng151.workers.dev/api/recommendations',
  modelVersion: 'test-model',
  promptVersion: 'test-prompt',
  approvedBy: 'Test reviewer',
  approvedAt: '2026-10-20',
  runtimeDecision: 'Test only',
  privacyDecision: 'Test only',
  budgetDecision: 'Test only',
  allowanceMicrodollars: 340,
  maxRequestMicrodollars: 10,
};

describe('paid evaluation approval preflight', () => {
  it('requires Luna low to carry the additive allowance and exact test workflow', () => {
    vi.stubEnv('GITHUB_WORKFLOW', 'Validate Luna test deployment');
    const luna = {
      ...approval,
      modelVersion: 'gpt-6-luna',
      promptVersion: 'catalog-rank-luna-v15-fast',
      reasoningEffort: 'low',
      serviceTier: 'fast',
      priorSpendMicrodollars: LUNA_PRIOR_SPEND,
      totalAllowanceMicrodollars: 3000000,
      allowanceMicrodollars: 3000000 - LUNA_PRIOR_SPEND,
      maxRequestMicrodollars: 11000,
    };
    const now = Date.parse('2026-10-21T12:00:00Z');
    expect(validateLiveApproval(benchmark, luna, checkout, now, 34)).toEqual(
      luna,
    );
    for (const change of [
      { priorSpendMicrodollars: 0 },
      { allowanceMicrodollars: 1000000 },
      { reasoningEffort: 'medium' },
      { serviceTier: undefined },
      { serviceTier: 'default' },
      { totalAllowanceMicrodollars: 2000001 },
    ])
      expect(() =>
        validateLiveApproval(
          benchmark,
          { ...luna, ...change },
          checkout,
          now,
          34,
        ),
      ).toThrow();
    vi.stubEnv('GITHUB_WORKFLOW', 'Evaluate Anthropic test deployment');
    expect(() =>
      validateLiveApproval(benchmark, luna, checkout, now, 34),
    ).toThrow('workflow');
  });
  it('requires the Haiku rerun to spend the remaining comparison allowance without changing effort', () => {
    const haiku = {
      ...approval,
      modelVersion: 'claude-haiku-5-5',
      promptVersion: 'catalog-rank-haiku-v31',
      reasoningEffort: 'low',
      thinking: 'disabled',
      priorSpendMicrodollars: LUNA_PRIOR_SPEND,
      totalAllowanceMicrodollars: 3000000,
      allowanceMicrodollars: 3000000 - LUNA_PRIOR_SPEND,
      maxRequestMicrodollars: 6756,
    };
    const now = Date.parse('2026-10-21T12:00:00Z');
    expect(validateLiveApproval(benchmark, haiku, checkout, now, 34)).toEqual(
      haiku,
    );
    for (const change of [
      { priorSpendMicrodollars: 0 },
      { allowanceMicrodollars: 1000000 },
      { reasoningEffort: 'medium' },
      { reasoningEffort: undefined },
      { thinking: undefined },
      { maxRequestMicrodollars: 7000 },
      { serviceTier: 'fast' },
      { totalAllowanceMicrodollars: 1000000 },
      { promptVersion: 'catalog-rank-v10' },
    ])
      expect(() =>
        validateLiveApproval(
          benchmark,
          { ...haiku, ...change },
          checkout,
          now,
          34,
        ),
      ).toThrow();
    vi.stubEnv('GITHUB_WORKFLOW', 'Validate Luna test deployment');
    expect(() =>
      validateLiveApproval(benchmark, haiku, checkout, now, 34),
    ).toThrow('workflow');
  });
  beforeEach(() => {
    vi.stubEnv(
      'GITHUB_REPOSITORY',
      'pursuit-capstone-fcny/ai-sprint-recommender',
    );
    vi.stubEnv('GITHUB_WORKFLOW', 'Evaluate Anthropic test deployment');
    vi.stubEnv('GITHUB_RUN_ID', '123');
    vi.stubEnv('GITHUB_RUN_ATTEMPT', '1');
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });
  it.each([
    'https://deadbeef-ai-sprint-recommender-llm-test.jason-zeng151.workers.dev/api/recommendations',
    'https://ai-sprint-recommender-llm-test.other-account.workers.dev/api/recommendations',
  ])('rejects an endpoint the workflow does not deploy: %s', (endpoint) => {
    expect(
      LiveApprovalSchema.safeParse({ ...approval, endpoint }).success,
    ).toBe(false);
  });
  it('rejects reuse in another workflow run or retry attempt', () => {
    for (const [runId, attempt] of [
      ['999', '1'],
      ['123', '2'],
    ]) {
      vi.stubEnv('GITHUB_RUN_ID', runId);
      vi.stubEnv('GITHUB_RUN_ATTEMPT', attempt);
      expect(() =>
        validateLiveApproval(
          benchmark,
          approval,
          checkout,
          Date.parse('2026-10-21T12:00:00Z'),
        ),
      ).toThrow('workflow');
    }
  });
  it.each(['warmup', 'first-paid'])(
    'stops paid requests when approval expires during %s',
    async (phase) => {
      let now = Date.parse('2026-10-21T12:00:00Z');
      vi.spyOn(Date, 'now').mockImplementation(() => now);
      const shortApproval = {
        ...approval,
        expiresAt: new Date(now + 10_000).toISOString(),
      };
      const paidInputs: unknown[] = [];
      const fetcher: typeof fetch = async (_url, init) => {
        if (init?.method === 'GET') {
          if (phase === 'warmup') now += 15_000;
          return Response.json(benchmark.catalog);
        }
        const input = JSON.parse(String(init?.body));
        const cacheCheck = input.functionArea === '__evaluation_invalid_area__';
        if (!cacheCheck) {
          paidInputs.push(input);
          if (phase === 'first-paid') now += 15_000;
        }
        return Response.json(
          {
            outcome: 'fallback',
            reason: 'unavailable',
            catalogVersion: benchmark.catalog.catalogVersion,
            modelVersion: approval.modelVersion,
            promptVersion: approval.promptVersion,
          },
          {
            status: cacheCheck ? 400 : 200,
            headers: { 'x-recommendation-request-id': randomUUID() },
          },
        );
      };
      const progress = vi.fn(async () => {});
      await expect(
        runLiveTrials(
          benchmark,
          shortApproval,
          true,
          fetcher,
          progress,
          async () => {},
          checkout,
        ),
      ).rejects.toThrow('expired');
      expect(paidInputs).toHaveLength(phase === 'warmup' ? 0 : 1);
      expect(progress).toHaveBeenCalledTimes(paidInputs.length);
    },
  );
  it('accepts only the approved clean revision before its deadline', () => {
    const before = Date.parse('2026-10-21T23:59:59Z');
    expect(
      validateLiveApproval(benchmark, approval, checkout, before, 34),
    ).toEqual(approval);
    expect(() =>
      validateLiveApproval(
        benchmark,
        approval,
        { ...checkout, dirty: true },
        before,
      ),
    ).toThrow('clean');
    expect(() =>
      validateLiveApproval(
        benchmark,
        approval,
        { ...checkout, sourceRevision: 'b'.repeat(40) },
        before,
      ),
    ).toThrow('revision');
    expect(() =>
      validateLiveApproval(
        benchmark,
        approval,
        checkout,
        Date.parse(approval.expiresAt),
      ),
    ).toThrow('expired');
    expect(() =>
      validateLiveApproval(benchmark, approval, checkout, before, 35),
    ).toThrow('allowance');
    expect(
      LiveApprovalSchema.safeParse({
        ...approval,
        approvedSourceRevision: undefined,
      }).success,
    ).toBe(false);
    expect(
      LiveApprovalSchema.safeParse({ ...approval, expiresAt: undefined })
        .success,
    ).toBe(false);
  });
  it('stops an expired live run before any GET or POST', async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(
      runLiveTrials(
        benchmark,
        { ...approval, expiresAt: '2020-01-01T00:00:00Z' },
        true,
        fetcher,
        async () => {},
        async () => {},
        checkout,
      ),
    ).rejects.toThrow('expired');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('detects both tracked changes and untracked files in the actual checkout', () => {
    const directory = mkdtempSync(join(tmpdir(), 'evaluation-checkout-'));
    const git = (...args: string[]) =>
      execFileSync('git', args, { cwd: directory, stdio: 'pipe' });
    try {
      git('init');
      writeFileSync(join(directory, 'tracked'), 'initial');
      git('add', 'tracked');
      git(
        '-c',
        'user.name=Test',
        '-c',
        'user.email=test@example.invalid',
        'commit',
        '-m',
        'fixture',
      );
      expect(readCheckout(directory)).toEqual({
        sourceRevision: git('rev-parse', 'HEAD').toString().trim(),
        dirty: false,
      });
      writeFileSync(join(directory, 'untracked'), 'new');
      expect(readCheckout(directory).dirty).toBe(true);
      rmSync(join(directory, 'untracked'));
      writeFileSync(join(directory, 'tracked'), 'changed');
      expect(readCheckout(directory).dirty).toBe(true);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
