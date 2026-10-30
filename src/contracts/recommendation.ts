import { z } from 'zod';
import { RecommendationVersionSchema } from './usageEvent';

export const MAX_RECOMMENDATIONS = 8;
export const RECOMMENDATION_PATH = '/api/recommendations';
export const RECOMMENDATION_DEADLINE_MS = 5_000;
export const RECOMMENDATION_PROMPT_VERSION = 'catalog-rank-v10';

const catalogVersion = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const tag = z.string().min(1).max(120);

export const RecommendationRequestSchema = z.strictObject({
  functionArea: tag.nullable(),
  goal: z.string().trim().max(500),
  tools: z
    .array(tag)
    .max(50)
    .refine((values) => new Set(values).size === values.length),
  catalogVersion,
});

export const RecommendationFallbackReasonSchema = z.enum([
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
]);

export const RecommendationIdsSchema = z
  .array(z.string().regex(/^[A-Za-z0-9_-]{11}$/))
  .max(MAX_RECOMMENDATIONS)
  .refine((ids) => new Set(ids).size === ids.length);

export const RecommendationResponseSchema = z.discriminatedUnion('outcome', [
  z.strictObject({
    outcome: z.literal('success'),
    youtubeIds: RecommendationIdsSchema,
    catalogVersion,
    ...RecommendationVersionSchema.shape,
  }),
  z
    .strictObject({
      outcome: z.literal('fallback'),
      reason: RecommendationFallbackReasonSchema,
      catalogVersion: catalogVersion.optional(),
      modelVersion: RecommendationVersionSchema.shape.modelVersion.optional(),
      promptVersion: RecommendationVersionSchema.shape.promptVersion.optional(),
    })
    .refine(
      (value) => Boolean(value.modelVersion) === Boolean(value.promptVersion),
    ),
]);

export type RecommendationRequest = z.infer<typeof RecommendationRequestSchema>;
export type RecommendationResponse = z.infer<
  typeof RecommendationResponseSchema
>;
export type RecommendationFallbackReason = z.infer<
  typeof RecommendationFallbackReasonSchema
>;
