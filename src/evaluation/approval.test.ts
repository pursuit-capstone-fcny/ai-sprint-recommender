// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import fixture from '../../fixtures/evaluation/draft-benchmark.json';
import { parseBenchmark, benchmarkFingerprint } from './benchmark';
import {
  LiveApprovalSchema,
  readCheckout,
  validateLiveApproval,
} from './approval';
import { runLiveTrials } from './live';

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
  expiresAt: '2026-10-22T00:00:00Z',
  benchmarkFingerprint: benchmarkFingerprint(benchmark),
  environment: 'test',
  endpoint:
    'https://ai-sprint-recommender-llm-test.example.workers.dev/api/recommendations',
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
