import { execFileSync } from 'node:child_process';
import { z } from 'zod';
import { benchmarkFingerprint, type Benchmark } from './benchmark';
import { RecommendationVersionSchema } from '../contracts/usageEvent';
import { LUNA_PRIOR_SPEND } from './luna-ledger';

export const TEST_EVALUATION_ENDPOINT =
  'https://ai-sprint-recommender-llm-test.jason-zeng151.workers.dev/api/recommendations';

export const LiveApprovalSchema = z
  .strictObject({
    approvedSourceRevision: z.string().regex(/^[a-f0-9]{40}$/),
    approvedWorkflowRunId: z.string().regex(/^[1-9][0-9]*$/),
    approvedWorkflowRunAttempt: z.number().int().positive(),
    expiresAt: z.iso.datetime(),
    benchmarkFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    environment: z.literal('test'),
    endpoint: z.literal(TEST_EVALUATION_ENDPOINT),
    ...RecommendationVersionSchema.shape,
    approvedBy: z.string().trim().min(1),
    approvedAt: z.iso.date(),
    runtimeDecision: z.string().trim().min(1),
    privacyDecision: z.string().trim().min(1),
    budgetDecision: z.string().trim().min(1),
    allowanceMicrodollars: z.number().int().positive(),
    maxRequestMicrodollars: z.number().int().positive(),
    reasoningEffort: z.enum(['low', 'medium']).optional(),
    thinking: z.literal('disabled').optional(),
    priorSpendMicrodollars: z.number().int().nonnegative().optional(),
    totalAllowanceMicrodollars: z.literal(1_000_000).optional(),
  })
  .refine(
    (value) => value.maxRequestMicrodollars * 30 <= value.allowanceMicrodollars,
  );

export interface Checkout {
  sourceRevision: string;
  dirty: boolean;
}

export function assertApprovalWindow(
  approval: Pick<
    z.infer<typeof LiveApprovalSchema>,
    'approvedAt' | 'expiresAt'
  >,
  now = Date.now(),
  requestDeadlineMs = 0,
) {
  if (
    Date.parse(approval.expiresAt) <= now + requestDeadlineMs ||
    Date.parse(approval.approvedAt) > now
  )
    throw new Error(
      'Live approval is expired or cannot cover the next request.',
    );
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
  const luna = approval.modelVersion === 'gpt-6-luna';
  const haiku = approval.modelVersion === 'claude-haiku-5-5';
  if (
    (luna || haiku) &&
    (approval.reasoningEffort !== 'low' ||
      (haiku && approval.thinking !== 'disabled') ||
      approval.priorSpendMicrodollars !== LUNA_PRIOR_SPEND ||
      approval.totalAllowanceMicrodollars !== 1_000_000 ||
      approval.allowanceMicrodollars !== 1_000_000 - LUNA_PRIOR_SPEND ||
      approval.maxRequestMicrodollars !== (luna ? 7_000 : 6_756) ||
      approval.promptVersion !== 'catalog-rank-v7')
  )
    throw new Error(
      'Model comparison must preserve the candidate and remaining allowance.',
    );
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
  assertApprovalWindow(approval, now);
  // GitHub gives each relabeling a new run ID and each rerun a new attempt.
  // Only this workflow dispatches once per attempt; local paid entry points fail closed.
  if (
    process.env.GITHUB_REPOSITORY !==
      'pursuit-capstone-fcny/ai-sprint-recommender' ||
    process.env.GITHUB_WORKFLOW !==
      (luna
        ? 'Validate Luna test deployment'
        : 'Evaluate Anthropic test deployment') ||
    process.env.GITHUB_RUN_ID !== approval.approvedWorkflowRunId ||
    process.env.GITHUB_RUN_ATTEMPT !==
      String(approval.approvedWorkflowRunAttempt)
  )
    throw new Error(
      'Live approval does not match this workflow run and attempt.',
    );
  if (
    !Number.isInteger(requestCount) ||
    requestCount < 0 ||
    approval.maxRequestMicrodollars * requestCount >
      approval.allowanceMicrodollars
  )
    throw new Error('Live approval has insufficient allowance.');
  return approval;
}
