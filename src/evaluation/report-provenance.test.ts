// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../fixtures/evaluation/draft-benchmark.json';
import { parseBenchmark, benchmarkFingerprint } from './benchmark';
import {
  evaluate,
  renderReport,
  TrialsSchema,
  EvaluationReportSchema,
  type Diagnostics,
  type Trials,
} from './report';
import { main } from './cli';

const revision = 'a'.repeat(40);
function passingInputs() {
  const benchmark = parseBenchmark(structuredClone(fixture));
  benchmark.approval = {
    status: 'approved',
    approvedBy: 'Synthetic test reviewer',
    approvedAt: '2026-10-20',
    evidence: 'Test only',
  };
  const diagnostics: Diagnostics = [];
  const trials: Trials = {
    kind: 'live',
    benchmarkFingerprint: benchmarkFingerprint(benchmark),
    modelVersion: 'test-model',
    promptVersion: 'test-prompt',
    trials: Array.from({ length: 3 }, () => ({
      startedAt: '2026-10-21T00:00:00Z',
      calls: benchmark.profiles.map((profile) => {
        const requestId = randomUUID();
        diagnostics.push({
          requestId,
          environment: 'test',
          outcome: 'success',
          latencyMs: 100,
          inputTokens: 10,
          outputTokens: 5,
          costMicrodollars: 1,
          catalogVersion: benchmark.catalog.catalogVersion,
          modelVersion: 'test-model',
          promptVersion: 'test-prompt',
        });
        return {
          profileId: profile.id,
          requestId,
          latencyMs: 100,
          response: {
            outcome: 'success' as const,
            youtubeIds: [...profile.ideal, ...profile.good].map(
              (pick) => pick.youtubeId,
            ),
            catalogVersion: benchmark.catalog.catalogVersion,
            modelVersion: 'test-model',
            promptVersion: 'test-prompt',
          },
        };
      }),
    })),
  };
  return { benchmark, trials, diagnostics };
}

afterEach(() => vi.restoreAllMocks());
describe('saved trial provenance', () => {
  it('does not certify self-declared live files as fresh evidence', () => {
    const { benchmark, trials, diagnostics } = passingInputs();
    const report = evaluate(benchmark, {
      sourceRevision: revision,
      trials,
      diagnostics,
    });
    expect(report.rules.passed).toBe(true);
    expect(report.llm.every((trial) => trial.passed)).toBe(true);
    expect(
      report.llm.every((trial) =>
        trial.profiles.every((row) => row.metricsComplete),
      ),
    ).toBe(true);
    expect(report.relevanceEvidenceComplete).toBe(false);
    expect(report.sourceRevision).toBe('unknown');
    expect(report.warnings).toContain(
      'Saved-input replay cannot establish fresh live relevance.',
    );
  });

  it('counts a verified pre-dispatch fallback as zero, while preserving unknown dispatched usage', () => {
    const { benchmark, trials, diagnostics } = passingInputs();
    trials.trials[0].calls[0].response = {
      outcome: 'fallback',
      reason: 'timeout',
    };
    const row = diagnostics[0];
    Object.assign(row, {
      outcome: 'timeout',
      providerDispatched: false,
      accountingFinal: true,
      requestedCatalogVersion: benchmark.catalog.catalogVersion,
      inputTokens: 0,
      outputTokens: 0,
      costMicrodollars: 0,
    });
    delete row.catalogVersion;
    const measured = () =>
      evaluate(benchmark, { sourceRevision: revision, trials, diagnostics })
        .llm[0].profiles[0];
    expect(measured().metricsComplete).toBe(true);
    row.providerDispatched = true;
    delete row.costMicrodollars;
    expect(measured().metricsComplete).toBe(false);
    expect(measured().costMicrodollars).toBeNull();
    Object.assign(row, {
      providerDispatched: false,
      costMicrodollars: 0,
      requestedCatalogVersion: 'sha256:' + 'f'.repeat(64),
    });
    expect(measured().metricsComplete).toBe(false);
    Object.assign(row, {
      requestedCatalogVersion: benchmark.catalog.catalogVersion,
      accountingFinal: false,
    });
    expect(measured().metricsComplete).toBe(false);
  });
  it('keeps CLI saved inputs replay-only even with complete synthetic metrics', async () => {
    const { benchmark, trials, diagnostics } = passingInputs();
    const directory = await mkdtemp(join(tmpdir(), 'evaluation-replay-'));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const fetcher = vi.spyOn(globalThis, 'fetch');
    try {
      for (const [name, value] of Object.entries({
        benchmark,
        trials,
        diagnostics,
      }))
        await writeFile(join(directory, `${name}.json`), JSON.stringify(value));
      await main([
        '--benchmark',
        join(directory, 'benchmark.json'),
        '--trials',
        join(directory, 'trials.json'),
        '--diagnostics',
        join(directory, 'diagnostics.json'),
        '--output',
        join(directory, 'report'),
      ]);
      const report = JSON.parse(
        await readFile(join(directory, 'report/report.json'), 'utf8'),
      );
      expect(report.relevanceEvidenceComplete).toBe(false);
      expect(report.sourceRevision).toBe('unknown');
      expect(fetcher).not.toHaveBeenCalled();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  it('requires explicit matching execution provenance to certify fresh results', () => {
    const { benchmark, trials, diagnostics } = passingInputs();
    const evidence = {
      kind: 'fresh' as const,
      sourceRevision: revision,
      runId: '12345',
      runAttempt: 2,
    };
    const report = evaluate(benchmark, {
      sourceRevision: revision,
      trials,
      diagnostics,
      evidence,
    });
    expect(report.relevanceEvidenceComplete).toBe(true);
    expect(report.evidence).toEqual(evidence);
    expect(report.sourceRevision).toBe(revision);
    expect(renderReport(report)).toContain('GitHub run 12345, attempt 2');
    expect(() =>
      evaluate(benchmark, {
        sourceRevision: 'b'.repeat(40),
        trials,
        diagnostics,
        evidence,
      }),
    ).toThrow('candidate');
    expect(() =>
      evaluate(benchmark, {
        sourceRevision: revision,
        trials: { ...trials, kind: 'mock' },
        diagnostics,
        evidence,
      }),
    ).toThrow('candidate');
    expect(() => TrialsSchema.parse({ ...trials, evidence })).toThrow();
    expect(() =>
      EvaluationReportSchema.parse({ ...report, evidence: { kind: 'replay' } }),
    ).toThrow();
  });
});
