import { z } from 'zod';
import type { Benchmark, BenchmarkProfile } from './benchmark';
import { benchmarkFingerprint } from './benchmark';
import { RecommendationResponseSchema } from '../contracts/recommendation';
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

export function renderReport(
  report: EvaluationReport,
  baseline?: EvaluationReport,
): string {
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
