import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readLunaPriorSpend, deployedLunaSpend } from './luna-spend';
import { LUNA_PRIOR_SPEND } from './luna-ledger';
import {
  LUNA_BENCHMARK_PATH,
  LUNA_ENDPOINT,
  LUNA_FINGERPRINT,
  LUNA_MODEL,
  lunaSpent,
  runLunaComparison,
} from './luna';
import { parseBenchmark } from './benchmark';
import { validateLiveApproval } from './approval';
import {
  LUNA_DEPLOYED_PROMPT,
  LUNA_TOTAL_ALLOWANCE,
  LUNA_DEPLOYED_RESERVATION,
} from '../../server/luna-policy';

afterEach(() => vi.unstubAllEnvs());

describe('shared evaluation allowance evidence', () => {
  it('adds the new grant without resetting earlier charges or repricing old records', () => {
    const record = {
      kind: 'deployed-luna-budget',
      allowanceMicrodollars: 2000000,
      priorSpendMicrodollars: 861150,
      spentMicrodollars: 862150,
      additionalMicrodollars: 1000,
      remainingMicrodollars: 1137850,
    };
    expect(deployedLunaSpend(record, 861150, 2_000_000)).toBe(1000);
    expect(() => deployedLunaSpend(record, 861150)).toThrow('allowance');
    expect(() =>
      deployedLunaSpend(
        { ...record, priorSpendMicrodollars: 0 },
        861150,
        LUNA_TOTAL_ALLOWANCE,
      ),
    ).toThrow();
  });
  it('rejects a deployed budget that resets prior spend or refunds unknown charges', () => {
    const record = {
      kind: 'deployed-luna-budget',
      allowanceMicrodollars: 1000000,
      priorSpendMicrodollars: 337635,
      spentMicrodollars: 344635,
      additionalMicrodollars: 7000,
      remainingMicrodollars: 655365,
    };
    expect(deployedLunaSpend(record, 337635)).toBe(7000);
    for (const change of [
      { priorSpendMicrodollars: 0 },
      { spentMicrodollars: 337635 },
      { remainingMicrodollars: 1000000 },
      { additionalMicrodollars: -1 },
    ])
      expect(() =>
        deployedLunaSpend({ ...record, ...change }, 337635),
      ).toThrow();
  });
  it('carries every completed run and unknown reservation into the remaining allowance', () => {
    const paths = [
      'docs/evaluation/2026-10-28-dedup/runs/40804527443-2/capture.json',
      'docs/evaluation/2026-10-28-task-tags/runs/40794821513-2/capture.json',
      'docs/evaluation/2026-10-26-luna/runs/40445851804-2/capture.json',
      'docs/evaluation/2026-10-27-luna-low/runs/40545682960-2/capture.json',
      'docs/evaluation/2026-10-27-luna-low/runs/40547083724-2/capture.json',
    ];
    const prior = paths.reduce(
      (sum, path) => sum + lunaSpent(JSON.parse(readFileSync(path, 'utf8'))),
      0,
    );
    expect(prior).toBe(337_635);
    expect(readLunaPriorSpend()).toBe(LUNA_PRIOR_SPEND);
    expect(1_000_000 - prior).toBe(662_365);
  });

  it('rejects paid runs whose maximum reservations exceed the current balance', async () => {
    const remaining = LUNA_TOTAL_ALLOWANCE - readLunaPriorSpend();
    const captured = JSON.parse(
      readFileSync(
        'docs/evaluation/2026-10-30-luna-compact/runs/41085742178-2/approval.json',
        'utf8',
      ),
    );
    vi.stubEnv(
      'GITHUB_REPOSITORY',
      'pursuit-capstone-fcny/ai-sprint-recommender',
    );
    vi.stubEnv('GITHUB_WORKFLOW', 'Validate Luna test deployment');
    vi.stubEnv('GITHUB_RUN_ID', captured.approvedWorkflowRunId);
    vi.stubEnv(
      'GITHUB_RUN_ATTEMPT',
      String(captured.approvedWorkflowRunAttempt),
    );
    const benchmark = parseBenchmark(
      JSON.parse(readFileSync(LUNA_BENCHMARK_PATH, 'utf8')),
    );
    expect(() =>
      validateLiveApproval(
        benchmark,
        {
          ...captured,
          serviceTier: 'fast',
          totalAllowanceMicrodollars: LUNA_TOTAL_ALLOWANCE,
          promptVersion: LUNA_DEPLOYED_PROMPT,
          maxRequestMicrodollars: LUNA_DEPLOYED_RESERVATION,
          priorSpendMicrodollars: LUNA_PRIOR_SPEND,
          allowanceMicrodollars: remaining,
        },
        { sourceRevision: captured.approvedSourceRevision, dirty: false },
        Date.parse('2026-10-30T16:10:00Z'),
        Math.floor(remaining / LUNA_DEPLOYED_RESERVATION) + 1,
      ),
    ).toThrow();
    const fetcher = vi.fn<typeof fetch>();
    const save = vi.fn();
    await expect(
      runLunaComparison({
        benchmark: parseBenchmark(
          JSON.parse(readFileSync(LUNA_BENCHMARK_PATH, 'utf8')),
        ),
        approval: {
          approvedBy: 'Jason',
          approvedAt: '2026-10-30',
          expiresAt: '2026-10-30T18:00:00Z',
          approvedSourceRevision: 'a'.repeat(40),
          approvedWorkflowRunId: '123',
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
        },
        limits: JSON.parse(readFileSync('wrangler.luna-test.json', 'utf8'))
          .vars,
        key: 'synthetic',
        now: () => Date.parse('2026-10-30T17:00:00Z'),
        fetcher,
        save,
      }),
    ).rejects.toThrow('remaining allowance');
    expect(fetcher).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });
});
