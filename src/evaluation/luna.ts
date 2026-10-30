import {
  LUNA_MODEL,
  LUNA_ENDPOINT,
  LUNA_RESERVATION,
  LUNA_RERUN_PROMPT,
  LUNA_COMPACT_PROMPT,
  lunaBody,
  readLunaResponse,
} from '../../server/luna';
export {
  LUNA_MODEL,
  LUNA_ENDPOINT,
  LUNA_MAX_INPUT,
  LUNA_MAX_OUTPUT,
  LUNA_RESERVATION,
  LUNA_RERUN_PROMPT,
  LUNA_COMPACT_PROMPT,
  lunaBody,
  readLunaResponse,
} from '../../server/luna';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { providerBody } from '../../server/anthropic';
import { boundedJson } from '../../server/bounded-json';
import { readLimits } from '../../server/config';
import {
  RECOMMENDATION_PROMPT_VERSION,
  type RecommendationResponse,
} from '../contracts/recommendation';
import { assertApprovalWindow, type Checkout } from './approval';
import { benchmarkFingerprint, type Benchmark } from './benchmark';
import { evaluate, type Diagnostics, type Trials } from './report';

export const LUNA_BENCHMARK_PATH =
  'docs/evaluation/2026-10-28-task-tags/benchmark.json';
export const LUNA_FINGERPRINT =
  '298ffdb6199c3a8bdb9ef48063ccfc4e16ca5efda14267a240c93d42d20b6d09';
export const LUNA_DEADLINE_MS = 4_500;
export const LUNA_CALLS = 60;
import { LUNA_PRIOR_SPEND } from './luna-ledger';
export { LUNA_PRIOR_SPEND } from './luna-ledger';
export const LUNA_WORKFLOW = 'Compare GPT-6 Luna benchmark';
export const LUNA_REPOSITORY = 'pursuit-capstone-fcny/ai-sprint-recommender';
export const LunaApprovalSchema = z
  .strictObject({
    approvedBy: z.literal('Jason'),
    approvedAt: z.iso.date(),
    expiresAt: z.iso.datetime(),
    approvedSourceRevision: z.string().regex(/^[a-f0-9]{40}$/),
    approvedWorkflowRunId: z.string().regex(/^[1-9][0-9]*$/),
    approvedWorkflowRunAttempt: z.number().int().positive(),
    benchmarkFingerprint: z.literal(LUNA_FINGERPRINT),
    endpoint: z.literal(LUNA_ENDPOINT),
    model: z.literal(LUNA_MODEL),
    efforts: z.union([
      z.tuple([z.literal('low')]),
      z.tuple([z.literal('low'), z.literal('medium')]),
    ]),
    promptVersion: z.enum([
      RECOMMENDATION_PROMPT_VERSION,
      LUNA_RERUN_PROMPT,
      LUNA_COMPACT_PROMPT,
    ]),
    priorSpendMicrodollars: z.literal(LUNA_PRIOR_SPEND),
    allowanceMicrodollars: z
      .number()
      .int()
      .min(LUNA_PRIOR_SPEND + LUNA_RESERVATION * 30)
      .max(1_000_000),
    maxCalls: z.union([z.literal(30), z.literal(LUNA_CALLS)]),
    runtime: z.literal('isolated-github-provider-comparison'),
    data: z.literal('unchanged-labels-public-catalog-task-tags'),
  })
  .refine(
    (approval) =>
      approval.maxCalls === approval.efforts.length * 30 &&
      approval.priorSpendMicrodollars + approval.maxCalls * LUNA_RESERVATION <=
        approval.allowanceMicrodollars,
    'The remaining allowance must cover every maximum request reservation.',
  );
export type LunaApproval = z.infer<typeof LunaApprovalSchema>;
type Effort = LunaApproval['efforts'][number];

export function validateLunaApproval(
  benchmark: Benchmark,
  value: unknown,
  checkout: Checkout,
  environment: Record<string, string | undefined>,
  now = Date.now(),
) {
  const approval = LunaApprovalSchema.parse(value);
  if (
    benchmark.approval.status !== 'approved' ||
    benchmarkFingerprint(benchmark) !== approval.benchmarkFingerprint ||
    checkout.dirty ||
    checkout.sourceRevision !== approval.approvedSourceRevision ||
    environment.GITHUB_REPOSITORY !== LUNA_REPOSITORY ||
    environment.GITHUB_WORKFLOW !== LUNA_WORKFLOW ||
    environment.GITHUB_RUN_ID !== approval.approvedWorkflowRunId ||
    environment.GITHUB_RUN_ATTEMPT !==
      String(approval.approvedWorkflowRunAttempt)
  )
    throw new Error(
      'Luna approval does not match benchmark, clean source or workflow attempt.',
    );
  assertApprovalWindow(approval, now, LUNA_DEADLINE_MS);
  return approval;
}

type Measurement = ReturnType<typeof readLunaResponse>;
export interface LunaRecord {
  requestId: string;
  effort: Effort;
  trial: number;
  profileId: string;
  startedAt: string;
  latencyMs: number | null;
  reservationMicrodollars: number;
  measurement: Measurement | null;
  response: RecommendationResponse | null;
  httpStatus: number | null;
}
export interface LunaState {
  kind: 'live-provider-comparison';
  approval: LunaApproval;
  productionEnablement: 'not-evaluated';
  complete: boolean;
  records: LunaRecord[];
}

// Callers must persist state before dispatch. A pending/unknown request consumes
// its full reservation, even after a timeout or cancellation.
export function lunaSpent(state: LunaState) {
  return state.records.reduce(
    (total, row) =>
      total +
      (row.measurement?.costMicrodollars ?? row.reservationMicrodollars),
    0,
  );
}

export async function runLunaComparison(options: {
  benchmark: Benchmark;
  approval: LunaApproval;
  limits: Parameters<typeof readLimits>[0];
  key: string;
  save: (state: LunaState) => void;
  fetcher?: typeof fetch;
  now?: () => number;
}) {
  const { benchmark, key, save } = options;
  const approval = LunaApprovalSchema.parse(options.approval);
  if (
    benchmark.approval.status !== 'approved' ||
    benchmarkFingerprint(benchmark) !== approval.benchmarkFingerprint
  )
    throw new Error('Frozen benchmark mismatch.');
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? Date.now;
  if (!key) throw new Error('Add OPENAI_API_KEY before starting.');
  const limits = readLimits({
    ...options.limits,
    LLM_MODEL: LUNA_MODEL,
  });
  if (!limits) throw new Error('Invalid frozen test limits.');
  // Validate current config here; lunaBody retains the isolated protocol's
  // own 2,000-token output cap and original maximum reservation.
  // Precompute every request without labels before spending anything.
  const bodies = benchmark.profiles.map((profile) =>
    providerBody(
      { ...profile.input, catalogVersion: benchmark.catalog.catalogVersion },
      benchmark.catalog,
      limits,
    ),
  );
  for (const effort of approval.efforts)
    for (const body of bodies) lunaBody(body, effort, approval.promptVersion);
  const state: LunaState = {
    kind: 'live-provider-comparison',
    approval,
    productionEnablement: 'not-evaluated',
    complete: false,
    records: [],
  };
  save(state);
  // Interleave efforts, reversing their order in trial two to reduce time-order bias.
  for (let trial = 1; trial <= 3; trial++) {
    for (const [index, profile] of benchmark.profiles.entries()) {
      const efforts =
        trial % 2 === 0 ? [...approval.efforts].reverse() : approval.efforts;
      for (const effort of efforts) {
        assertApprovalWindow(approval, now(), LUNA_DEADLINE_MS);
        if (
          state.records.length >= approval.maxCalls ||
          approval.priorSpendMicrodollars +
            lunaSpent(state) +
            LUNA_RESERVATION >
            approval.allowanceMicrodollars
        )
          throw new Error('Luna allowance exhausted.');
        const started = now();
        const record: LunaRecord = {
          requestId: randomUUID(),
          effort,
          trial,
          profileId: profile.id,
          startedAt: new Date(started).toISOString(),
          latencyMs: null,
          reservationMicrodollars: LUNA_RESERVATION,
          measurement: null,
          response: null,
          httpStatus: null,
        };
        state.records.push(record);
        save(state);
        const version = {
          modelVersion: LUNA_MODEL,
          promptVersion: approval.promptVersion,
          catalogVersion: benchmark.catalog.catalogVersion,
        };
        const fallback = (
          reason: 'timeout' | 'provider-error' | 'invalid-response',
        ): RecommendationResponse => ({
          outcome: 'fallback',
          reason,
          ...version,
        });
        const controller = new AbortController();
        let fatal = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          await Promise.race([
            (async () => {
              const response = await fetcher(LUNA_ENDPOINT, {
                method: 'POST',
                signal: controller.signal,
                redirect: 'error',
                headers: {
                  'content-type': 'application/json',
                  Authorization: `Bearer ${key}`,
                },
                body: JSON.stringify(
                  lunaBody(bodies[index], effort, approval.promptVersion),
                ),
              });
              if (controller.signal.aborted) return;
              record.httpStatus = response.status;
              if (!response.ok) {
                fatal = true; // A configuration/access/rate error stops the run without retries.
                throw new Error('Provider HTTP failure.');
              }
              const measurement = readLunaResponse(
                await boundedJson(response, 262_144),
                bodies[index].catalogIds,
              );
              if (controller.signal.aborted) return;
              record.measurement = measurement;
              fatal = measurement.fatal;
              record.response =
                now() - started >= LUNA_DEADLINE_MS
                  ? fallback('timeout')
                  : measurement.youtubeIds === null
                    ? fallback('invalid-response')
                    : {
                        outcome: 'success',
                        youtubeIds: measurement.youtubeIds,
                        ...version,
                      };
            })(),
            new Promise<never>((_, reject) => {
              timer = setTimeout(() => {
                controller.abort();
                reject(new Error('Deadline'));
              }, LUNA_DEADLINE_MS);
            }),
          ]);
        } catch {
          record.response = fallback(
            controller.signal.aborted ? 'timeout' : 'provider-error',
          );
        } finally {
          clearTimeout(timer);
          record.latencyMs = now() - started;
          save(state);
        }
        if (fatal)
          throw new Error(
            'Provider configuration or usage mismatch; partial evidence saved.',
          );
      }
    }
  }
  state.complete = true;
  save(state);
  return state;
}

export function scoreLunaState(
  benchmark: Benchmark,
  state: LunaState,
  effort: Effort,
) {
  const records = state.records.filter((row) => row.effort === effort);
  if (
    !state.complete ||
    records.length !== 30 ||
    records.some((row) => row.response === null || row.latencyMs === null)
  )
    throw new Error('Incomplete provider comparison.');
  const trials: Trials = {
    kind: 'live',
    benchmarkFingerprint: benchmarkFingerprint(benchmark),
    modelVersion: LUNA_MODEL,
    promptVersion: state.approval.promptVersion,
    trials: [1, 2, 3].map((trial) => ({
      startedAt: records.find((row) => row.trial === trial)!.startedAt,
      calls: records
        .filter((row) => row.trial === trial)
        .map((row) => ({
          profileId: row.profileId,
          response: row.response!,
          requestId: row.requestId,
          latencyMs: row.latencyMs!,
        })),
    })),
  };
  const diagnostics: Diagnostics = records.map((row) => ({
    requestId: row.requestId,
    environment: 'test',
    outcome:
      row.response!.outcome === 'success' ? 'success' : row.response!.reason,
    latencyMs: row.latencyMs!,
    modelVersion: LUNA_MODEL,
    promptVersion: state.approval.promptVersion,
    catalogVersion: benchmark.catalog.catalogVersion,
    reservedMicrodollars: row.reservationMicrodollars,
    ...(row.measurement
      ? {
          inputTokens: row.measurement.inputTokens,
          outputTokens: row.measurement.outputTokens,
          costMicrodollars: row.measurement.costMicrodollars,
        }
      : {}),
  }));
  // Score captured provider responses with the existing browser selector. This is
  // deliberately ineligible as fresh deployed-endpoint evidence for #19.
  return {
    trials,
    diagnostics,
    report: evaluate(benchmark, {
      sourceRevision: state.approval.approvedSourceRevision,
      trials,
      diagnostics,
    }),
  };
}
