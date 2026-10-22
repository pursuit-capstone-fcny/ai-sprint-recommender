import { z } from 'zod';
import { isDeepStrictEqual } from 'node:util';
import type { Benchmark, BenchmarkProfile } from './benchmark';
import { benchmarkFingerprint, BenchmarkSchema } from './benchmark';
import {
  RecommendationResponseSchema,
  RecommendationFallbackReasonSchema,
} from '../contracts/recommendation';
import { RecommendationVersionSchema } from '../contracts/usageEvent';
import { toCatalogItem } from '../contracts/catalogItem';
import {
  selectRecommendations,
  selectRulesResults,
} from '../recommendations/selectRecommendations';

export const TrialsSchema = z.strictObject({
  kind: z.enum(['mock', 'live']),
  benchmarkFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  ...RecommendationVersionSchema.shape,
  trials: z
    .array(
      z.strictObject({
        startedAt: z.iso.datetime(),
        calls: z
          .array(
            z.strictObject({
              profileId: z.string(),
              response: RecommendationResponseSchema,
              requestId: z.uuid().nullable(),
              latencyMs: z.number().nonnegative(),
            }),
          )
          .length(10),
      }),
    )
    .length(3),
});
export type Trials = z.infer<typeof TrialsSchema>;

export const DiagnosticsSchema = z
  .array(
    z.strictObject({
      requestId: z.uuid(),
      environment: z.literal('test'),
      outcome: z.string().min(1).max(80),
      latencyMs: z.number().nonnegative(),
      inputTokens: z.number().int().nonnegative().optional(),
      outputTokens: z.number().int().nonnegative().optional(),
      costMicrodollars: z.number().int().nonnegative().optional(),
      reservedMicrodollars: z.number().int().nonnegative().optional(),
      validationFailure: z
        .enum([
          'max-tokens',
          'refusal',
          'stop-reason',
          'content',
          'json',
          'schema',
          'duplicate',
          'out-of-range',
        ])
        .optional(),
      contentBlockCount: z.number().int().min(0).max(100).optional(),
      selectionCount: z.number().int().min(0).max(100).optional(),
      invalidSelectionCount: z.number().int().min(0).max(100).optional(),
      duplicateCount: z.number().int().min(0).max(100).optional(),
      outOfRangeCount: z.number().int().min(0).max(100).optional(),
      catalogVersion: z.string().optional(),
      modelVersion: z.string().optional(),
      promptVersion: z.string().optional(),
    }),
  )
  .refine(
    (rows) => new Set(rows.map((row) => row.requestId)).size === rows.length,
  );
export type Diagnostics = z.infer<typeof DiagnosticsSchema>;

function intake(profile: BenchmarkProfile) {
  return {
    ...profile.input,
    goalWords: profile.input.goal.trim().split(/\s+/).filter(Boolean),
  };
}

export function scorePicks(profile: BenchmarkProfile, ids: string[]) {
  const good = new Set(
    [...profile.ideal, ...profile.good].map((pick) => pick.youtubeId),
  );
  const displayedIds = ids.slice(0, 3);
  const hits = new Set(displayedIds.filter((id) => good.has(id))).size;
  return {
    profileId: profile.id,
    displayedIds,
    hits,
    misses: 3 - hits,
    passed: hits >= 2,
  };
}

export function evaluate(
  benchmark: Benchmark,
  options: {
    sourceRevision: string;
    trials?: Trials;
    diagnostics?: Diagnostics;
  },
) {
  const fingerprint = benchmarkFingerprint(benchmark);
  const trials = options.trials && TrialsSchema.parse(options.trials);
  if (trials && trials.benchmarkFingerprint !== fingerprint)
    throw new Error('Trials use a different benchmark.');
  const diagnostics = DiagnosticsSchema.parse(options.diagnostics ?? []);
  const metrics = new Map(diagnostics.map((row) => [row.requestId, row]));
  const usedRequests = new Set<string>();
  const catalog = benchmark.catalog.items.map(toCatalogItem);
  const rules = benchmark.profiles.map((profile) =>
    scorePicks(
      profile,
      selectRulesResults(catalog, intake(profile), 3).map(
        (match) => match.item.youtubeId,
      ),
    ),
  );
  const llm =
    trials?.trials.map((trial, index) => {
      if (new Set(trial.calls.map((call) => call.profileId)).size !== 10)
        throw new Error('Duplicate profile in trial.');
      const profiles = benchmark.profiles.map((profile) => {
        const call = trial.calls.find(
          (entry) => entry.profileId === profile.id,
        );
        if (!call) throw new Error('Missing profile in trial.');
        if (call.requestId) {
          if (usedRequests.has(call.requestId))
            throw new Error('Trials must use fresh requests.');
          usedRequests.add(call.requestId);
        }
        const response = call.response;
        if (
          response.modelVersion &&
          (response.modelVersion !== trials.modelVersion ||
            response.promptVersion !== trials.promptVersion)
        )
          throw new Error('Trial configuration changed.');
        const selection = selectRecommendations(
          catalog,
          intake(profile),
          benchmark.catalog.catalogVersion,
          response,
        );
        const score = scorePicks(
          profile,
          selection.results.map((match) => match.item.youtubeId),
        );
        const metric = call.requestId ? metrics.get(call.requestId) : undefined;
        const complete =
          metric !== undefined &&
          metric.outcome ===
            (response.outcome === 'success' ? 'success' : response.reason) &&
          metric.catalogVersion === benchmark.catalog.catalogVersion &&
          metric.modelVersion === trials.modelVersion &&
          metric.promptVersion === trials.promptVersion &&
          metric.inputTokens !== undefined &&
          metric.outputTokens !== undefined &&
          metric.costMicrodollars !== undefined;
        return {
          ...score,
          passed: score.passed && selection.recommendationEngine === 'llm',
          engine: selection.recommendationEngine,
          fallbackReason: selection.llmFallbackReason,
          requestId: call.requestId,
          latencyMs: call.latencyMs,
          inputTokens: metric?.inputTokens ?? null,
          outputTokens: metric?.outputTokens ?? null,
          costMicrodollars: metric?.costMicrodollars ?? null,
          reservedMicrodollars: metric?.reservedMicrodollars ?? null,
          metricsComplete: complete,
        };
      });
      const passedProfiles = profiles.filter(
        (profile) => profile.passed,
      ).length;
      return {
        trial: index + 1,
        startedAt: trial.startedAt,
        passedProfiles,
        passed: passedProfiles >= 8,
        fallbackCount: profiles.filter((profile) => profile.engine === 'rules')
          .length,
        profiles,
      };
    }) ?? [];
  const rulesPassed = rules.filter((profile) => profile.passed).length;
  const warnings = [
    ...(benchmark.approval.status === 'draft'
      ? ['Draft synthetic labels are not approved quality evidence.']
      : []),
    ...(rulesPassed < 8
      ? [`Rules reached ${rulesPassed}/10 profiles; target is 8/10.`]
      : []),
    ...(trials?.kind !== 'live'
      ? ['Three fresh live trials have not been recorded.']
      : []),
    ...(llm.some((trial) => !trial.passed)
      ? ['At least one LLM trial missed the 8/10 target.']
      : []),
    ...(llm.length === 0 ||
    llm.some((trial) =>
      trial.profiles.some((profile) => !profile.metricsComplete),
    )
      ? ['Measured usage or cost evidence is incomplete.']
      : []),
  ];
  return {
    schemaVersion: 1 as const,
    benchmarkId: benchmark.id,
    benchmarkFingerprint: fingerprint,
    catalogVersion: benchmark.catalog.catalogVersion,
    sourceRevision: options.sourceRevision,
    approval: benchmark.approval,
    modelVersion: trials?.modelVersion ?? null,
    promptVersion: trials?.promptVersion ?? null,
    trialKind: trials?.kind ?? null,
    rules: {
      passedProfiles: rulesPassed,
      passed: rulesPassed >= 8,
      profiles: rules,
    },
    llm,
    variation: benchmark.profiles.map((profile) => ({
      profileId: profile.id,
      distinctResults: new Set(
        llm.map((trial) =>
          JSON.stringify(
            trial.profiles.find((row) => row.profileId === profile.id)
              ?.displayedIds,
          ),
        ),
      ).size,
    })),
    warnings,
    relevanceEvidenceComplete: warnings.length === 0,
    productionEnablement: 'pending-owner-review' as const,
  };
}
export type EvaluationReport = ReturnType<typeof evaluate>;

const scoreSchema = z.strictObject({
  profileId: z.string().regex(/^[a-z0-9-]+$/),
  displayedIds: z
    .array(z.string().regex(/^[A-Za-z0-9_-]{11}$/))
    .max(3)
    .refine((ids) => new Set(ids).size === ids.length),
  hits: z.number().int().min(0).max(3),
  misses: z.number().int().min(0).max(3),
  passed: z.boolean(),
});
const llmScoreSchema = scoreSchema.extend({
  engine: z.enum(['llm', 'rules']),
  fallbackReason: z.union([
    z.literal('none'),
    RecommendationFallbackReasonSchema,
  ]),
  requestId: z.uuid().nullable(),
  latencyMs: z.number().nonnegative(),
  inputTokens: z.number().int().nonnegative().nullable(),
  outputTokens: z.number().int().nonnegative().nullable(),
  costMicrodollars: z.number().int().nonnegative().nullable(),
  reservedMicrodollars: z.number().int().nonnegative().nullable(),
  metricsComplete: z.boolean(),
});
export const EvaluationReportSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    benchmarkId: z.string().regex(/^[a-z0-9-]+$/),
    benchmarkFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    catalogVersion: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    sourceRevision: z.string().min(1),
    approval: BenchmarkSchema.shape.approval,
    modelVersion: RecommendationVersionSchema.shape.modelVersion.nullable(),
    promptVersion: RecommendationVersionSchema.shape.promptVersion.nullable(),
    trialKind: z.enum(['mock', 'live']).nullable(),
    rules: z.strictObject({
      passedProfiles: z.number().int().min(0).max(10),
      passed: z.boolean(),
      profiles: z.array(scoreSchema).length(10),
    }),
    llm: z
      .array(
        z.strictObject({
          trial: z.number().int().min(1).max(3),
          startedAt: z.iso.datetime(),
          passedProfiles: z.number().int().min(0).max(10),
          passed: z.boolean(),
          fallbackCount: z.number().int().min(0).max(10),
          profiles: z.array(llmScoreSchema).length(10),
        }),
      )
      .refine((trials) => trials.length === 0 || trials.length === 3),
    variation: z
      .array(
        z.strictObject({
          profileId: z.string(),
          distinctResults: z.number().int().min(0).max(3),
        }),
      )
      .length(10),
    warnings: z.array(z.string()),
    relevanceEvidenceComplete: z.boolean(),
    productionEnablement: z.literal('pending-owner-review'),
  })
  .superRefine((report, ctx) => {
    const invalid = () =>
      ctx.addIssue({
        code: 'custom',
        message: 'Inconsistent evaluation report.',
      });
    const ids = report.rules.profiles.map((row) => row.profileId);
    const sameIds = (rows: { profileId: string }[]) =>
      new Set(rows.map((row) => row.profileId)).size === 10 &&
      rows.every((row) => ids.includes(row.profileId));
    if (!sameIds(report.rules.profiles) || !sameIds(report.variation))
      invalid();
    const summaries = [report.rules, ...report.llm];
    for (const summary of summaries) {
      if (
        !sameIds(summary.profiles) ||
        summary.passedProfiles !==
          summary.profiles.filter((row) => row.passed).length ||
        summary.passed !== summary.passedProfiles >= 8
      )
        invalid();
      for (const row of summary.profiles) {
        const eligible = !('engine' in row) || row.engine === 'llm';
        if (
          row.hits + row.misses !== 3 ||
          row.hits > row.displayedIds.length ||
          row.passed !== (row.hits >= 2 && eligible)
        )
          invalid();
      }
    }
    const requestIds = new Set<string>();
    report.llm.forEach((trial, index) => {
      if (
        trial.trial !== index + 1 ||
        trial.fallbackCount !==
          trial.profiles.filter((row) => row.engine === 'rules').length
      )
        invalid();
      for (const row of trial.profiles) {
        if ((row.engine === 'llm') !== (row.fallbackReason === 'none'))
          invalid();
        if (row.requestId) {
          if (requestIds.has(row.requestId)) invalid();
          requestIds.add(row.requestId);
        }
        if (
          row.metricsComplete &&
          (!row.requestId ||
            row.inputTokens === null ||
            row.outputTokens === null ||
            row.costMicrodollars === null)
        )
          invalid();
      }
    });
    for (const row of report.variation) {
      const count = new Set(
        report.llm.map((trial) =>
          JSON.stringify(
            trial.profiles.find(
              (profile) => profile.profileId === row.profileId,
            )?.displayedIds,
          ),
        ),
      ).size;
      if (row.distinctResults !== count) invalid();
    }
    if (
      (report.llm.length === 0) !== (report.trialKind === null) ||
      (report.llm.length === 0) !== (report.modelVersion === null) ||
      (report.llm.length === 0) !== (report.promptVersion === null) ||
      report.relevanceEvidenceComplete !== (report.warnings.length === 0)
    )
      invalid();
    if (
      report.relevanceEvidenceComplete &&
      (report.approval.status !== 'approved' ||
        report.trialKind !== 'live' ||
        !report.rules.passed ||
        report.llm.some(
          (trial) =>
            !trial.passed || trial.profiles.some((row) => !row.metricsComplete),
        ))
    )
      invalid();
  });

export function parseEvaluationReport(
  value: unknown,
  benchmark: Benchmark,
): EvaluationReport {
  const report = EvaluationReportSchema.parse(value);
  if (
    report.benchmarkFingerprint !== benchmarkFingerprint(benchmark) ||
    report.benchmarkId !== benchmark.id ||
    report.catalogVersion !== benchmark.catalog.catalogVersion ||
    !isDeepStrictEqual(report.approval, benchmark.approval)
  )
    throw new Error('Baseline must use identical frozen data and labels.');
  const active = new Set(benchmark.catalog.items.map((item) => item.youtubeId));
  for (const summary of [report.rules, ...report.llm]) {
    for (const row of summary.profiles) {
      const profile = benchmark.profiles.find(
        (profile) => profile.id === row.profileId,
      );
      if (!profile || row.displayedIds.some((id) => !active.has(id)))
        throw new Error('Baseline contains unknown profile or catalog IDs.');
      const expected = scorePicks(profile, row.displayedIds);
      if (row.hits !== expected.hits || row.misses !== expected.misses)
        throw new Error('Baseline scores differ from frozen labels.');
    }
  }
  return report;
}

export function renderReport(
  report: EvaluationReport,
  baseline?: EvaluationReport,
): string {
  EvaluationReportSchema.parse(report);
  if (baseline) EvaluationReportSchema.parse(baseline);
  if (baseline && baseline.benchmarkFingerprint !== report.benchmarkFingerprint)
    throw new Error(
      'Before/after reports must use identical frozen data and labels.',
    );
  const lines = [
    '# Recommendation evaluation',
    '',
    `Benchmark: ${report.benchmarkId}. Labels: ${report.approval.status}.`,
    `Catalog: ${report.catalogVersion}`,
    `Code: ${report.sourceRevision}`,
    `Model: ${report.modelVersion ?? 'not run'}. Prompt: ${report.promptVersion ?? 'not run'}. Trials: ${report.trialKind ?? 'none'}.`,
    '',
    `Rules: ${report.rules.passedProfiles}/10 profiles reached two good picks.`,
    ...report.llm.map(
      (trial) =>
        `LLM trial ${trial.trial}: ${trial.passedProfiles}/10; ${trial.fallbackCount} fallbacks.`,
    ),
    '',
    '| Profile | Before rules hits | Rules hits / 3 | Before LLM hits by trial | LLM hits / 3 by trial | Distinct trial results |',
    '| --- | --- | --- | --- | --- | --- |',
  ];
  for (const profile of report.rules.profiles) {
    const before = baseline?.rules.profiles.find(
      (row) => row.profileId === profile.profileId,
    );
    const beforeLlm = baseline?.llm
      .map((trial) => {
        const row = trial.profiles.find(
          (entry) => entry.profileId === profile.profileId,
        )!;
        return row.engine === 'llm'
          ? String(row.hits)
          : `fallback (${row.fallbackReason})`;
      })
      .join(', ');
    const results = report.llm.map((trial) => {
      const row = trial.profiles.find(
        (entry) => entry.profileId === profile.profileId,
      )!;
      return row.engine === 'llm'
        ? String(row.hits)
        : `fallback (${row.fallbackReason}; ${row.hits} rules hits)`;
    });
    lines.push(
      `| ${profile.profileId} | ${before?.hits ?? 'not run'} | ${profile.hits} | ${beforeLlm || 'not run'} | ${results.join(', ') || 'not run'} | ${report.variation.find((row) => row.profileId === profile.profileId)!.distinctResults} |`,
    );
  }
  lines.push(
    '',
    'JSON includes displayed IDs, misses, latency, tokens, cost and reservations for each request.',
    '',
    ...report.warnings.map((warning) => `- ${warning}`),
    '',
    'Production enablement remains pending owner review of this report, runtime/privacy/budget approvals, two semantic examples, weakest profiles, held-out wording, preview failures, rules-only switch and demo evidence.',
  );
  return `${lines.join('\n')}\n`;
}
