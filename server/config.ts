import { libraryOrigin } from '../src/library/catalog';
import { z } from 'zod';

const positive = z.coerce
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER);
export const CatalogSourceSchema = z
  .url()
  .refine((value) => {
    try {
      return libraryOrigin(value) === value.replace(/\/$/, '');
    } catch {
      return false;
    }
  })
  .transform(libraryOrigin);
const schema = z.object({
  LLM_ENVIRONMENT: z.enum(['test', 'production']),
  LLM_MODEL: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/),
  LIBRARY_ORIGIN: CatalogSourceSchema,
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
