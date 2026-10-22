import { execFileSync } from 'node:child_process';
import { z } from 'zod';
import { benchmarkFingerprint, type Benchmark } from './benchmark';
import { RecommendationVersionSchema } from '../contracts/usageEvent';

export const LiveApprovalSchema = z
  .strictObject({
    approvedSourceRevision: z.string().regex(/^[a-f0-9]{40}$/),
    expiresAt: z.iso.datetime(),
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

export interface Checkout {
  sourceRevision: string;
  dirty: boolean;
}

export function readCheckout(cwd = process.cwd()): Checkout {
  return {
    sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd,
      encoding: 'utf8',
    }).trim(),
    dirty:
      execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {
        cwd,
        encoding: 'utf8',
      }).trim() !== '',
  };
}

// This check performs no network access. External approval files can pin a clean SHA.
export function validateLiveApproval(
  benchmark: Benchmark,
  value: unknown,
  checkout: Checkout = readCheckout(),
  now = Date.now(),
  requestCount = 30,
) {
  const approval = LiveApprovalSchema.parse(value);
  if (
    benchmark.approval.status !== 'approved' ||
    approval.benchmarkFingerprint !== benchmarkFingerprint(benchmark)
  )
    throw new Error(
      'Live approval does not match approved benchmark profiles.',
    );
  if (
    checkout.dirty ||
    checkout.sourceRevision !== approval.approvedSourceRevision
  )
    throw new Error(
      'Live approval requires the exact clean approved source revision.',
    );
  if (
    Date.parse(approval.expiresAt) <= now ||
    Date.parse(approval.approvedAt) > now
  )
    throw new Error('Live approval is expired or not yet effective.');
  if (
    !Number.isInteger(requestCount) ||
    requestCount < 0 ||
    approval.maxRequestMicrodollars * requestCount >
      approval.allowanceMicrodollars
  )
    throw new Error('Live approval has insufficient allowance.');
  return approval;
}
