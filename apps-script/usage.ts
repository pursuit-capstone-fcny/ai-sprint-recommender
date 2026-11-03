import { z } from 'zod';
import { type PublicCatalog } from '../src/contracts/publicCatalog';
import {
  hasUsageCatalogReferences,
  RecommendationVersionSchema,
  UsageEventSchema,
  type UsageEvent,
} from '../src/contracts/usageEvent';

export const MAX_USAGE_BYTES = 16 * 1024;
export const MAX_USAGE_ROWS = 10_000;
const DAY_MS = 86_400_000;
const MAX_EVENT_AGE_MS = 3_600_000;

export const UsagePolicySchema = z
  .strictObject({
    retentionDays: z.number().int().min(1).max(365),
    maxPerMinute: z.number().int().min(1).max(MAX_USAGE_ROWS),
    maxPerDay: z.number().int().min(1).max(MAX_USAGE_ROWS),
    maxRows: z.number().int().min(1).max(MAX_USAGE_ROWS),
    recommendationVersions: z.array(RecommendationVersionSchema).max(20),
  })
  .refine(
    (policy) =>
      policy.maxPerMinute <= policy.maxPerDay &&
      policy.maxPerDay <= policy.maxRows,
  );
export type UsagePolicy = z.infer<typeof UsagePolicySchema>;
export type UsageRecord = { eventId: string; receivedAt: string };
export type UsagePorts = {
  enabled: boolean;
  feedbackEnabled?: boolean;
  policy: () => UsagePolicy;
  now: () => Date;
  lock: { tryLock: (milliseconds: number) => boolean; releaseLock: () => void };
  catalog: () => PublicCatalog;
  records: () => UsageRecord[];
  append: (event: UsageEvent, receivedAt: string) => void;
};
export type UsageRequest = { contents?: string; type?: string };
export const usageError = (code: string) => JSON.stringify({ error: { code } });

// Apps Script V8 has no TextEncoder. Count UTF-8 bytes, including surrogate pairs.
export function usageBodyBytes(body: string): number {
  let bytes = 0;
  for (const character of body) {
    const point = character.codePointAt(0)!;
    bytes += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
  }
  return bytes;
}

export function receiveUsage(
  request: UsageRequest | undefined,
  ports: UsagePorts,
): string {
  if (!ports.enabled) return usageError('USAGE_DISABLED');
  if (request?.type?.split(';')[0].trim().toLowerCase() !== 'text/plain')
    return usageError('USAGE_INVALID_CONTENT_TYPE');
  const body = request.contents;
  if (
    typeof body !== 'string' ||
    body.length > MAX_USAGE_BYTES ||
    usageBodyBytes(body) > MAX_USAGE_BYTES
  ) {
    return usageError('USAGE_INVALID_SIZE');
  }
  let event: UsageEvent;
  try {
    event = UsageEventSchema.parse(JSON.parse(body));
  } catch {
    return usageError('USAGE_INVALID_EVENT');
  }
  if (event.type === 'feedback' && !ports.feedbackEnabled)
    return usageError('FEEDBACK_DISABLED');
  let locked = false;
  try {
    const parsedPolicy = UsagePolicySchema.safeParse(ports.policy());
    if (!parsedPolicy.success) return usageError('USAGE_INVALID_CONFIG');
    const policy = parsedPolicy.data;
    locked = ports.lock.tryLock(1500);
    if (!locked) return usageError('USAGE_BUSY');
    const now = ports.now();
    const nowMs = now.getTime();
    const eventMs = Date.parse(event.time);
    // Delivery expires before the minimum retention period. A retry cannot
    // recreate a purged event; allow modest forward clock skew.
    if (eventMs <= nowMs - MAX_EVENT_AGE_MS || eventMs > nowMs + 5 * 60_000) {
      return usageError('USAGE_INVALID_TIME');
    }
    const records = ports.records();
    if (records.some((record) => record.eventId === event.eventId))
      return JSON.stringify({ ok: true, status: 'duplicate' });
    if (records.length >= policy.maxRows) return usageError('USAGE_FULL');
    const today = now.toISOString().slice(0, 10);
    let retryAt = 0;
    if (
      records.filter((record) => record.receivedAt.startsWith(today)).length >=
      policy.maxPerDay
    )
      retryAt = Date.parse(`${today}T00:00:00.000Z`) + DAY_MS;
    const recent = records
      .map((record) => Date.parse(record.receivedAt))
      .filter((time) => time > nowMs - 60_000)
      .sort((a, b) => a - b);
    // Enough receipts must expire to leave fewer than the current cap.
    if (recent.length >= policy.maxPerMinute)
      retryAt = Math.max(
        retryAt,
        recent[recent.length - policy.maxPerMinute] + 60_000,
      );
    if (retryAt) {
      return JSON.stringify({
        error: {
          code: 'USAGE_RATE_LIMITED',
          retryAfterMs: Math.min(DAY_MS, Math.max(1, retryAt - nowMs)),
        },
      });
    }
    if (
      event.modelVersion &&
      !policy.recommendationVersions.some(
        (entry) =>
          entry.modelVersion === event.modelVersion &&
          entry.promptVersion === event.promptVersion,
      )
    ) {
      return usageError('USAGE_INVALID_EVENT');
    }
    if (!hasUsageCatalogReferences(event, ports.catalog()))
      return usageError('USAGE_INVALID_REFERENCE');
    // The adapter flushes before releasing the shared lock.
    ports.append(event, now.toISOString());
    return JSON.stringify({ ok: true, status: 'accepted' });
  } catch {
    return usageError('USAGE_UNAVAILABLE');
  } finally {
    if (locked) ports.lock.releaseLock();
  }
}

export function expiredUsageRows(
  records: UsageRecord[],
  now: Date,
  retentionDays: number,
): number[] {
  const cutoff = now.getTime() - retentionDays * DAY_MS;
  // Delete from the bottom so row numbers remain valid, retaining the header.
  return records
    .flatMap((record, index) =>
      Date.parse(record.receivedAt) <= cutoff ? [index + 2] : [],
    )
    .reverse();
}
