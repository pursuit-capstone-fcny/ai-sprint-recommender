import { z } from 'zod';
import { type PublicCatalog } from './publicCatalog';
export const MAX_RETAINED_USAGE_EVENTS = 100_000;

const uuid = z.uuid().transform((value) => value.toLowerCase());
const tag = z.string().min(1).max(120);
const tags = z
  .array(tag)
  .max(50)
  .refine((values) => new Set(values).size === values.length);
const version = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,79}$/);
const sources = [
  'website',
  'email',
  'session',
  'pilot',
  'team',
  'other',
] as const;

export const RecommendationVersionSchema = z.strictObject({
  modelVersion: version,
  promptVersion: version,
});

const common = {
  schemaVersion: z.literal(1),
  eventId: uuid,
  sessionId: uuid,
  searchId: uuid,
  time: z.iso.datetime(),
  mode: z.enum(['recommendations', 'topic', 'direct']),
  src: z
    .string()
    .default('website')
    .transform(
      (value) => sources.find((source) => source === value) ?? 'other',
    ),
  catalogVersion: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  recommendationEngine: z.enum(['llm', 'rules']).optional(),
  llmFallbackReason: z
    .enum([
      'none',
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
    ])
    .optional(),
  modelVersion: version.optional(),
  promptVersion: version.optional(),
};
const result = {
  youtubeId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
  rank: z.number().int().min(1).max(1000),
  matchType: z.enum([
    'strong',
    'weak',
    'semantic',
    'cross-area',
    'start-here',
    'direct',
  ]),
};

export const UsageEventSchema = z
  .discriminatedUnion('type', [
    z.strictObject({
      ...common,
      type: z.literal('search'),
      functionArea: tag.nullable(),
      functionAreas: tags.optional(),
      tools: tags,
      tasks: tags,
      resultCount: z.number().int().min(0).max(1000),
      strongMatchCount: z.number().int().min(0).max(1000),
      fallbackType: z.enum([
        'none',
        'cross-area',
        'start-here',
        'mixed',
        'unavailable',
      ]),
    }),
    z.strictObject({ ...common, ...result, type: z.literal('impression') }),
    z.strictObject({
      ...common,
      ...result,
      type: z.literal('click'),
      target: z.enum(['embed', 'youtube']),
    }),
    z.strictObject({
      ...common,
      ...result,
      schemaVersion: z.literal(2),
      type: z.literal('feedback'),
      helpful: z.boolean(),
      voteRevision: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    }),
  ])
  .superRefine((event, ctx) => {
    const invalid = () =>
      ctx.addIssue({ code: 'custom', message: 'Inconsistent usage event' });
    if (event.mode === 'recommendations') {
      if (!event.recommendationEngine || !event.llmFallbackReason) invalid();
      if (
        (event.recommendationEngine === 'llm' &&
          (event.llmFallbackReason !== 'none' || !event.modelVersion)) ||
        (event.recommendationEngine === 'rules' &&
          event.llmFallbackReason === 'none') ||
        Boolean(event.modelVersion) !== Boolean(event.promptVersion)
      ) {
        invalid();
      }
    } else if (
      event.recommendationEngine !== undefined ||
      event.llmFallbackReason !== undefined ||
      event.modelVersion !== undefined ||
      event.promptVersion !== undefined
    ) {
      invalid();
    }
    if (event.type === 'search') {
      if (
        event.functionAreas !== undefined &&
        (event.mode !== 'topic' ||
          event.functionArea !==
            (event.functionAreas.length === 1 ? event.functionAreas[0] : null))
      )
        invalid();
      if (event.mode === 'direct' || event.strongMatchCount > event.resultCount)
        invalid();
    } else if (
      (event.mode === 'direct') !== (event.matchType === 'direct') ||
      (event.matchType === 'semantic' && event.recommendationEngine !== 'llm')
    ) {
      invalid();
    }
  });

export type UsageEvent = z.infer<typeof UsageEventSchema>;
export type RecommendationVersion = z.infer<typeof RecommendationVersionSchema>;

// Both the future sender and doPost must check the same catalog allowlists.
export function hasUsageCatalogReferences(
  event: UsageEvent,
  catalog: PublicCatalog,
): boolean {
  if (event.catalogVersion !== catalog.catalogVersion) return false;
  if (event.type !== 'search')
    return catalog.items.some((item) => item.youtubeId === event.youtubeId);
  return (
    (event.functionAreas ?? []).every((value) =>
      catalog.functionAreas.includes(value),
    ) &&
    (event.functionArea === null ||
      catalog.functionAreas.includes(event.functionArea)) &&
    event.tools.every((value) => catalog.tools.includes(value)) &&
    event.tasks.every((value) => catalog.tasks.includes(value))
  );
}
