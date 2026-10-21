import { z } from 'zod';
import type { Benchmark } from './benchmark';
import { benchmarkFingerprint } from './benchmark';
import type { Trials } from './report';
import {
  RecommendationResponseSchema,
  RECOMMENDATION_DEADLINE_MS,
  type RecommendationRequest,
  type RecommendationResponse,
} from '../contracts/recommendation';
import { RecommendationVersionSchema } from '../contracts/usageEvent';

interface Observation {
  response: RecommendationResponse;
  requestId: string | null;
  latencyMs: number;
}
export interface Warmup extends Observation {
  trial: number;
  phase: 'catalog-load' | 'cache-check';
  status: number | null;
}

async function requestRecommendation(
  endpoint: string,
  input: RecommendationRequest,
  fetcher: typeof fetch,
  deadlineMs = RECOMMENDATION_DEADLINE_MS,
  expectedStatus?: number,
): Promise<Observation & { status: number | null }> {
  const started = performance.now();
  let response: RecommendationResponse;
  let requestId: string | null = null;
  let status: number | null = null;
  try {
    const result = await fetcher(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'cache-control': 'no-cache',
      },
      body: JSON.stringify(input),
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      signal: AbortSignal.timeout(deadlineMs),
    });
    status = result.status;
    const parsedId = z
      .uuid()
      .safeParse(result.headers.get('X-Recommendation-Request-Id'));
    requestId = parsedId.success ? parsedId.data : null;
    const parsed = RecommendationResponseSchema.safeParse(await result.json());
    response =
      (expectedStatus === undefined
        ? result.ok
        : result.status === expectedStatus) && parsed.success
        ? parsed.data
        : { outcome: 'fallback', reason: 'invalid-response' };
  } catch (error) {
    response = {
      outcome: 'fallback',
      reason:
        (error instanceof Error || error instanceof DOMException) &&
        (error.name === 'TimeoutError' || error.name === 'AbortError')
          ? 'timeout'
          : 'provider-error',
    };
  }
  return {
    response,
    requestId,
    status,
    latencyMs: Math.round(performance.now() - started),
  };
}

export const LiveApprovalSchema = z
  .strictObject({
    benchmarkFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    environment: z.literal('test'),
    endpoint: z.url().refine((value) => {
      const url = new URL(value);
      return (
        url.protocol === 'https:' &&
        /^(?:[a-f0-9]{8}-)?ai-sprint-recommender-llm-test\.[a-z0-9-]+\.workers\.dev$/.test(
          url.hostname,
        ) &&
        url.pathname === '/api/recommendations' &&
        !url.search &&
        !url.hash &&
        !url.username &&
        !url.password &&
        !url.port
      );
    }),
    ...RecommendationVersionSchema.shape,
    approvedBy: z.string().trim().min(1),
    approvedAt: z.iso.date(),
    runtimeDecision: z.string().trim().min(1),
    privacyDecision: z.string().trim().min(1),
    budgetDecision: z.string().trim().min(1),
    allowanceMicrodollars: z.number().int().positive(),
    maxRequestMicrodollars: z.number().int().positive(),
  })
  .refine(
    (value) => value.maxRequestMicrodollars * 30 <= value.allowanceMicrodollars,
  );

// No provider credentials: this exercises only the approved preview endpoint.
// Server limits remain authoritative. Reserve room for all thirty requests first.
export async function runLiveTrials(
  benchmark: Benchmark,
  approvalValue: unknown,
  allowPaid: boolean,
  fetcher: typeof fetch = fetch,
  saveProgress: (progress: Trials) => Promise<void> = async () => {},
  saveWarmups: (warmups: Warmup[]) => Promise<void> = async () => {},
): Promise<Trials> {
  if (!allowPaid || benchmark.approval.status !== 'approved')
    throw new Error(
      'Live calls require explicit opt-in and approved profiles.',
    );
  const approval = LiveApprovalSchema.parse(approvalValue);
  const fingerprint = benchmarkFingerprint(benchmark);
  if (approval.benchmarkFingerprint !== fingerprint)
    throw new Error('Live approval does not match this benchmark.');
  const trials: Trials['trials'] = [];
  const warmups: Warmup[] = [];
  const wrongVersion = `sha256:${(benchmark.catalog.catalogVersion === `sha256:${'0'.repeat(64)}` ? 'f' : '0').repeat(64)}`;
  for (let index = 0; index < 3; index += 1) {
    // Version mismatch fetches and validates the trusted catalog before provider dispatch.
    // Warm it once per trial; no timeout/error retry and no paid trial without confirmation.
    const warmup: Warmup = {
      trial: index + 1,
      phase: 'catalog-load',
      ...(await requestRecommendation(
        approval.endpoint,
        { ...benchmark.profiles[0].input, catalogVersion: wrongVersion },
        fetcher,
        10_000,
        200,
      )),
    };
    warmups.push(warmup);
    await saveWarmups(warmups);
    if (
      !warmup.requestId ||
      warmup.response.outcome !== 'fallback' ||
      warmup.response.reason !== 'catalog-mismatch' ||
      warmup.response.catalogVersion !== benchmark.catalog.catalogVersion ||
      warmup.response.modelVersion !== approval.modelVersion ||
      warmup.response.promptVersion !== approval.promptVersion
    ) {
      throw new Error(
        'Catalog warmup did not confirm the approved catalog and configuration. No trial retry was attempted.',
      );
    }
    // A canonical-area rejection happens after reading the catalog and before reservation.
    // This proves the deployed cache is fast enough without spending a provider call.
    const cacheCheck: Warmup = {
      trial: index + 1,
      phase: 'cache-check',
      ...(await requestRecommendation(
        approval.endpoint,
        {
          functionArea: '__evaluation_invalid_area__',
          goal: '',
          tools: [],
          catalogVersion: benchmark.catalog.catalogVersion,
        },
        fetcher,
        10_000,
        400,
      )),
    };
    warmups.push(cacheCheck);
    await saveWarmups(warmups);
    if (
      !cacheCheck.requestId ||
      cacheCheck.status !== 400 ||
      cacheCheck.latencyMs >= 1_000 ||
      cacheCheck.response.outcome !== 'fallback' ||
      cacheCheck.response.reason !== 'unavailable' ||
      cacheCheck.response.catalogVersion !== benchmark.catalog.catalogVersion ||
      cacheCheck.response.modelVersion !== approval.modelVersion ||
      cacheCheck.response.promptVersion !== approval.promptVersion
    ) {
      throw new Error(
        'Catalog cache check failed or took at least one second. No trial retry was attempted.',
      );
    }
    const trial: Trials['trials'][number] = {
      startedAt: new Date().toISOString(),
      calls: [],
    };
    trials.push(trial);
    for (const profile of benchmark.profiles) {
      const observation = await requestRecommendation(
        approval.endpoint,
        { ...profile.input, catalogVersion: benchmark.catalog.catalogVersion },
        fetcher,
      );
      const { response } = observation;
      trial.calls.push({
        profileId: profile.id,
        response,
        requestId: observation.requestId,
        latencyMs: observation.latencyMs,
      });
      await saveProgress({
        kind: 'live',
        benchmarkFingerprint: fingerprint,
        modelVersion: approval.modelVersion,
        promptVersion: approval.promptVersion,
        trials,
      });
      // A version mismatch would spend the remaining allowance on the wrong candidate.
      if (
        response.modelVersion &&
        (response.modelVersion !== approval.modelVersion ||
          response.promptVersion !== approval.promptVersion)
      ) {
        throw new Error(
          'Preview configuration differs from the approved candidate. Stop and inspect server diagnostics.',
        );
      }
    }
  }
  return {
    kind: 'live',
    benchmarkFingerprint: fingerprint,
    modelVersion: approval.modelVersion,
    promptVersion: approval.promptVersion,
    trials,
  };
}
