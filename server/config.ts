import { z } from 'zod';

const positive = z.coerce
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER);
export const CatalogSourceSchema = z.url().refine((value) => {
  const url = new URL(value);
  return (
    url.protocol === 'https:' &&
    url.hostname === 'script.google.com' &&
    /^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname) &&
    !url.search &&
    !url.hash &&
    !url.port &&
    !url.username &&
    !url.password
  );
});
const schema = z.object({
  LLM_PROVIDER: z.enum(['anthropic', 'openai']).default('anthropic'),
  LLM_REASONING_EFFORT: z.literal('low').optional(),
  LLM_ALLOWANCE_MICRODOLLARS: positive.max(1_000_000).optional(),
  LLM_PRIOR_MICRODOLLARS: z.coerce
    .number()
    .int()
    .nonnegative()
    .max(1_000_000)
    .optional(),
  LLM_ENVIRONMENT: z.enum(['test', 'production']),
  LLM_MODEL: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/),
  LLM_CATALOG_URL: CatalogSourceSchema,
  LLM_MAX_INPUT_TOKENS: positive.max(200_000),
  LLM_MAX_OUTPUT_TOKENS: positive.max(2_000),
  LLM_REQUESTS_PER_MINUTE: positive.max(10_000),
  LLM_CLIENT_REQUESTS_PER_MINUTE: positive.max(100),
  LLM_MAX_CONCURRENCY: positive.max(100),
  LLM_DAILY_MICRODOLLARS: positive,
  LLM_MONTHLY_MICRODOLLARS: positive,
  LLM_INPUT_MICRODOLLARS_PER_MILLION: positive,
  LLM_OUTPUT_MICRODOLLARS_PER_MILLION: positive,
});

export type Limits = z.infer<typeof schema>;
export type Variables = Record<string, unknown>;

export function readLimits(env: Variables): Limits | null {
  const result = schema.safeParse(env);
  if (!result.success) return null;
  const limits = result.data;
  const boundedComparison =
    limits.LLM_ALLOWANCE_MICRODOLLARS !== undefined ||
    limits.LLM_PRIOR_MICRODOLLARS !== undefined;
  if (
    boundedComparison &&
    (limits.LLM_ENVIRONMENT !== 'test' ||
      limits.LLM_ALLOWANCE_MICRODOLLARS === undefined ||
      limits.LLM_PRIOR_MICRODOLLARS === undefined ||
      limits.LLM_PRIOR_MICRODOLLARS > limits.LLM_ALLOWANCE_MICRODOLLARS ||
      (limits.LLM_PROVIDER === 'anthropic' &&
        (limits.LLM_MODEL !== 'claude-haiku-5-5' ||
          limits.LLM_REASONING_EFFORT !== 'low' ||
          limits.LLM_MAX_INPUT_TOKENS !== 65_000 ||
          limits.LLM_MAX_OUTPUT_TOKENS !== 512 ||
          limits.LLM_INPUT_MICRODOLLARS_PER_MILLION !== 100_000 ||
          limits.LLM_OUTPUT_MICRODOLLARS_PER_MILLION !== 500_000)))
  )
    return null;
  // Luna is approved only for the bounded test candidate. No production opt-in.
  if (
    limits.LLM_PROVIDER === 'openai' &&
    (limits.LLM_ENVIRONMENT !== 'test' ||
      limits.LLM_MODEL !== 'gpt-6-luna' ||
      limits.LLM_REASONING_EFFORT !== 'low' ||
      limits.LLM_MAX_INPUT_TOKENS !== 60_000 ||
      limits.LLM_MAX_OUTPUT_TOKENS !== 2_000 ||
      limits.LLM_INPUT_MICRODOLLARS_PER_MILLION !== 100_000 ||
      limits.LLM_OUTPUT_MICRODOLLARS_PER_MILLION !== 500_000 ||
      limits.LLM_ALLOWANCE_MICRODOLLARS === undefined ||
      limits.LLM_PRIOR_MICRODOLLARS === undefined ||
      limits.LLM_PRIOR_MICRODOLLARS > limits.LLM_ALLOWANCE_MICRODOLLARS)
  )
    return null;
  if (
    limits.LLM_DAILY_MICRODOLLARS > limits.LLM_MONTHLY_MICRODOLLARS ||
    !Number.isSafeInteger(
      callCost(
        limits,
        limits.LLM_MAX_INPUT_TOKENS,
        limits.LLM_MAX_OUTPUT_TOKENS,
      ),
    )
  )
    return null;
  return limits;
}

export function callCost(
  limits: Limits,
  inputTokens: number,
  outputTokens: number,
): number {
  const input = inputTokens * limits.LLM_INPUT_MICRODOLLARS_PER_MILLION;
  const output = outputTokens * limits.LLM_OUTPUT_MICRODOLLARS_PER_MILLION;
  if (![input, output, input + output].every(Number.isSafeInteger)) return NaN;
  return Math.ceil((input + output) / 1_000_000);
}

// Keep the existing object name: changing it would reset the approved comparison
// allowance. Haiku reruns now spend from the same remaining $1 as Luna.
export function budgetKey(limits: Limits): string {
  return limits.LLM_ENVIRONMENT === 'test' &&
    limits.LLM_ALLOWANCE_MICRODOLLARS !== undefined
    ? 'test:gpt-6-luna'
    : limits.LLM_ENVIRONMENT;
}
