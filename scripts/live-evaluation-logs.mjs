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
  inputTokens: count.optional(),
  outputTokens: count.optional(),
  reasoningTokens: count.optional(),
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
const allowedKeys = Object.keys(DiagnosticSchema.shape);

export function hasReadyDiagnostic(observed, probeIds, expectedOutcome) {
  return [...probeIds].some(
    (id) => observed.get(id)?.outcome === expectedOutcome,
  );
}

function increment(counts, key, amount = 1) {
  if (counts) counts[key] = Math.min(1_000_000_000, counts[key] + amount);
}

function valueType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return ['string', 'object', 'number', 'boolean', 'undefined'].includes(
    typeof value,
  )
    ? typeof value
    : 'other';
}

export function diagnosticsFromEnvelope(envelope, counts) {
  if (!envelope || !Array.isArray(envelope.logs)) return [];
  const diagnostics = [];
  for (const log of envelope.logs) {
    increment(counts, 'logs');
    if (counts) {
      increment(
        counts.logLevels,
        Object.hasOwn(counts.logLevels, log?.level) ? log.level : 'other',
      );
      increment(counts.messageContainers, valueType(log?.message));
      if (Array.isArray(log?.message))
        for (const message of log.message)
          increment(counts.messageValues, valueType(message));
    }
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
  const types = () => ({
    string: 0,
    object: 0,
    array: 0,
    number: 0,
    boolean: 0,
    null: 0,
    undefined: 0,
    other: 0,
  });
  const counts = {
    stdoutBytes: 0,
    envelopes: 0,
    malformedEnvelopes: 0,
    acceptedDiagnostics: 0,
    logs: 0,
    logLevels: { info: 0, log: 0, warn: 0, error: 0, debug: 0, other: 0 },
    messageContainers: types(),
    messageValues: types(),
  };
  return {
    snapshot() {
      return structuredClone(counts);
    },
    push(chunk) {
      increment(counts, 'stdoutBytes', Buffer.byteLength(chunk, 'utf8'));
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
            const envelope = JSON.parse(record);
            increment(counts, 'envelopes');
            diagnostics = diagnosticsFromEnvelope(envelope, counts);
          } catch {
            increment(counts, 'malformedEnvelopes');
          }
          record = '';
          increment(counts, 'acceptedDiagnostics', diagnostics.length);
          for (const diagnostic of diagnostics) onDiagnostic(diagnostic);
        }
      }
    },
  };
}
