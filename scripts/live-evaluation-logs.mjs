import { z } from 'zod';

const version = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,79}$/);
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const DiagnosticSchema = z.strictObject({
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
  inputTokens: count.optional(),
  outputTokens: count.optional(),
  costMicrodollars: count.optional(),
  reservedMicrodollars: count.optional(),
  catalogVersion: z
    .string()
    .regex(/^sha256:[a-f0-9]{64}$/)
    .optional(),
  modelVersion: version.optional(),
  promptVersion: version.optional(),
});
const allowedKeys = Object.keys(DiagnosticSchema.shape);

export function diagnosticsFromEnvelope(envelope) {
  if (!envelope || !Array.isArray(envelope.logs)) return [];
  const diagnostics = [];
  for (const log of envelope.logs) {
    if (log?.level !== 'info' || !Array.isArray(log.message)) continue;
    for (const message of log.message) {
      if (typeof message !== 'string' || message.length > 4_096) continue;
      try {
        const candidate = JSON.parse(message);
        if (
          !candidate ||
          typeof candidate !== 'object' ||
          Array.isArray(candidate)
        )
          continue;
        // Never copy a tail envelope, request, header, exception or unknown log field.
        const projected = Object.fromEntries(
          allowedKeys
            .filter((key) => Object.hasOwn(candidate, key))
            .map((key) => [key, candidate[key]]),
        );
        const parsed = DiagnosticSchema.safeParse(projected);
        if (parsed.success) diagnostics.push(parsed.data);
      } catch {
        // Raw messages and parse errors must not reach the console or disk.
      }
    }
  }
  return diagnostics;
}

// Wrangler emits concatenated, pretty-printed JSON objects, not one JSON per line.
export function createDiagnosticStream(
  onDiagnostic,
  maxRecordChars = 1_048_576,
) {
  let record = '';
  let depth = 0;
  let quoted = false;
  let escaped = false;
  return {
    push(chunk) {
      for (const character of chunk) {
        if (depth === 0) {
          if (character !== '{') continue;
          record = '{';
          depth = 1;
          quoted = false;
          escaped = false;
          continue;
        }
        record += character;
        if (record.length > maxRecordChars) {
          record = '';
          depth = 0;
          throw new Error('Tail record exceeded the bounded parser limit.');
        }
        if (quoted) {
          if (escaped) escaped = false;
          else if (character === '\\') escaped = true;
          else if (character === '"') quoted = false;
        } else if (character === '"') quoted = true;
        else if (character === '{' || character === '[') depth += 1;
        else if (character === '}' || character === ']') depth -= 1;
        if (depth === 0) {
          let diagnostics = [];
          try {
            diagnostics = diagnosticsFromEnvelope(JSON.parse(record));
          } catch {
            /* Discard malformed envelopes. */
          }
          record = '';
          for (const diagnostic of diagnostics) onDiagnostic(diagnostic);
        }
      }
    },
  };
}
