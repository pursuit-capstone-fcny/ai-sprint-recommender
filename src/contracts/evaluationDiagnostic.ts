import { z } from 'zod';

const version = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,79}$/);
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const DiagnosticSchema = z.strictObject({
  requestId: z.uuid(),
  environment: z.literal('test'),
  outcome: z.enum([
    'success',
    'not-requested',
    'disabled',
    'rate-limited',
    'budget-exhausted',
    'timeout',
    'provider-error',
    'invalid-response',
    'catalog-mismatch',
    'insufficient-results',
    'catalog-too-large',
    'unavailable',
  ]),
  latencyMs: z.number().nonnegative().max(600_000),
  providerDispatched: z.boolean().optional(),
  requestedCatalogVersion: z
    .string()
    .regex(/^sha256:[a-f0-9]{64}$/)
    .optional(),
  accountingFinal: z.boolean().optional(),
  phase: z
    .enum(['request', 'catalog', 'budget', 'provider', 'validation'])
    .optional(),
  catalogMs: z.number().nonnegative().max(600_000).optional(),
  budgetMs: z.number().nonnegative().max(600_000).optional(),
  providerMs: z.number().nonnegative().max(600_000).optional(),
  providerHttpStatus: z.number().int().min(300).max(599).optional(),
  providerHeadersMs: z.number().nonnegative().max(600_000).optional(),
  providerBodyMs: z.number().nonnegative().max(600_000).optional(),
  providerCallCount: z.number().int().min(0).max(2).optional(),
  reviewCandidateCount: z.number().int().min(0).max(26).optional(),
  draftInputTokens: count.optional(),
  draftOutputTokens: count.optional(),
  reviewInputTokens: count.optional(),
  reviewOutputTokens: count.optional(),
  reviewDecision: z
    .enum(['reviewed', 'single', 'empty', 'invalid', 'aborted'])
    .optional(),
  inputTokens: count.optional(),
  outputTokens: count.optional(),
  reasoningTokens: count.optional(),
  serviceTier: z.enum(['default', 'priority', 'fast']).optional(),
  costMicrodollars: count.optional(),
  reservedMicrodollars: count.optional(),
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
      'candidate-or-usage-mismatch',
    ])
    .optional(),
  messageCount: z.number().int().min(0).max(100).optional(),
  contentBlockCount: z.number().int().min(0).max(100).optional(),
  selectionCount: z.number().int().min(0).max(100).optional(),
  invalidSelectionCount: z.number().int().min(0).max(100).optional(),
  duplicateCount: z.number().int().min(0).max(100).optional(),
  outOfRangeCount: z.number().int().min(0).max(100).optional(),
  catalogVersion: z
    .string()
    .regex(/^sha256:[a-f0-9]{64}$/)
    .optional(),
  modelVersion: version.optional(),
  promptVersion: version.optional(),
});
export const EVALUATION_DIAGNOSTIC_HEADER = 'x-evaluation-diagnostic';
export type EvaluationDiagnostic = z.infer<typeof DiagnosticSchema>;

export const EVALUATION_REQUEST_HEADER = 'x-evaluation-request-id';
