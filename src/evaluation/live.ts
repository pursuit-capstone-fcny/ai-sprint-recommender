import { z } from 'zod';
import type { Benchmark } from './benchmark';
import { benchmarkFingerprint } from './benchmark';
import type { Trials } from './report';
import {
  RecommendationResponseSchema,
  RECOMMENDATION_DEADLINE_MS,
} from '../contracts/recommendation';
import { RecommendationVersionSchema } from '../contracts/usageEvent';

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
  for (let index = 0; index < 3; index += 1) {
    const trial: Trials['trials'][number] = {
      startedAt: new Date().toISOString(),
      calls: [],
    };
    trials.push(trial);
    for (const profile of benchmark.profiles) {
      const started = performance.now();
      let response: Trials['trials'][number]['calls'][number]['response'];
      let requestId: string | null = null;
      try {
        const result = await fetcher(approval.endpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'cache-control': 'no-cache',
          },
          body: JSON.stringify({
            ...profile.input,
            catalogVersion: benchmark.catalog.catalogVersion,
          }),
          cache: 'no-store',
          credentials: 'omit',
          redirect: 'error',
          signal: AbortSignal.timeout(RECOMMENDATION_DEADLINE_MS),
        });
        const parsedId = z
          .uuid()
          .safeParse(result.headers.get('X-Recommendation-Request-Id'));
        requestId = parsedId.success ? parsedId.data : null;
        const parsed = RecommendationResponseSchema.safeParse(
          await result.json(),
        );
        response =
          result.ok && parsed.success
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
      trial.calls.push({
        profileId: profile.id,
        response,
        requestId,
        latencyMs: Math.round(performance.now() - started),
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
