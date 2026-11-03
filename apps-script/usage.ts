import { z } from 'zod';
import { type PublicCatalog } from '../src/contracts/publicCatalog';
import {
  hasUsageCatalogReferences,
  MAX_RETAINED_USAGE_EVENTS,
  RecommendationVersionSchema,
  UsageEventSchema,
  type UsageEvent,
} from '../src/contracts/usageEvent';

export const MAX_USAGE_BYTES = 16 * 1024;
export const MAX_USAGE_ROWS = MAX_RETAINED_USAGE_EVENTS;
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

function usageWindow(records: UsageRecord[], now: Date) {
  const nowMs = now.getTime();
  const today = now.toISOString().slice(0, 10);
  const ids = new Set(records.map((row) => row.eventId));
  let count = records.length;
  let daily = records.filter((row) => row.receivedAt.startsWith(today)).length;
  const recent = records
    .map((row) => Date.parse(row.receivedAt))
    .filter((time) => time > nowMs - 60_000)
    .sort((a, b) => a - b);
  return {
    check(event: UsageEvent, policy: UsagePolicy): string | null {
      const eventMs = Date.parse(event.time);
      if (eventMs <= nowMs - MAX_EVENT_AGE_MS || eventMs > nowMs + 5 * 60_000)
        return usageError('USAGE_INVALID_TIME');
      if (ids.has(event.eventId))
        return JSON.stringify({ ok: true, status: 'duplicate' });
      if (count >= policy.maxRows) return usageError('USAGE_FULL');
      let retryAt =
        daily >= policy.maxPerDay
          ? Date.parse(`${today}T00:00:00.000Z`) + DAY_MS
          : 0;
      if (recent.length >= policy.maxPerMinute)
        retryAt = Math.max(
          retryAt,
          recent[recent.length - policy.maxPerMinute] + 60_000,
        );
      return retryAt
        ? JSON.stringify({
            error: {
              code: 'USAGE_RATE_LIMITED',
              retryAfterMs: Math.min(DAY_MS, Math.max(1, retryAt - nowMs)),
            },
          })
        : null;
    },
    add(event: UsageEvent) {
      ids.add(event.eventId);
      count++;
      daily++;
      let at = recent.length;
      while (at > 0 && recent[at - 1] > nowMs) at--;
      recent.splice(at, 0, nowMs);
    },
  };
}

function ingest(
  event: UsageEvent,
  ports: UsagePorts,
  policy: UsagePolicy,
  now: Date,
  window: ReturnType<typeof usageWindow>,
): string {
  if (event.type === 'feedback' && !ports.feedbackEnabled)
    return usageError('FEEDBACK_DISABLED');
  const stop = window.check(event, policy);
  if (stop) return stop;
  if (
    event.modelVersion &&
    !policy.recommendationVersions.some(
      (row) =>
        row.modelVersion === event.modelVersion &&
        row.promptVersion === event.promptVersion,
    )
  )
    return usageError('USAGE_INVALID_EVENT');
  if (!hasUsageCatalogReferences(event, ports.catalog()))
    return usageError('USAGE_INVALID_REFERENCE');
  ports.append(event, now.toISOString());
  window.add(event);
  return JSON.stringify({ ok: true, status: 'accepted' });
}

export type UsageBatchPorts = Omit<UsagePorts, 'append'> & {
  appendBatch(rows: { event: UsageEvent; receivedAt: string }[]): void;
};
const batchSchema = z.strictObject({
  batchVersion: z.literal(1),
  key: z.string().min(32).max(256),
  events: z.array(UsageEventSchema).min(1).max(50),
});
export function isUsageBatch(request?: UsageRequest): boolean {
  try {
    return (
      !!request?.contents &&
      usageBodyBytes(request.contents) <= 65_536 &&
      'batchVersion' in JSON.parse(request.contents)
    );
  } catch {
    return false;
  }
}
export function receiveUsageBatch(
  request: UsageRequest | undefined,
  ports: UsageBatchPorts,
  secret: string | null,
): string {
  if (!ports.enabled) return usageError('USAGE_DISABLED');
  if (!secret || secret.length < 32) return usageError('USAGE_INVALID_CONFIG');
  if (request?.type?.split(';')[0].trim().toLowerCase() !== 'text/plain')
    return usageError('USAGE_INVALID_CONTENT_TYPE');
  if (!request.contents || usageBodyBytes(request.contents) > 65_536)
    return usageError('USAGE_INVALID_SIZE');
  let locked = false;
  try {
    const parsed = batchSchema.safeParse(JSON.parse(request.contents));
    if (!parsed.success) return usageError('USAGE_INVALID_EVENT');
    if (
      parsed.data.events.some(
        (event) => usageBodyBytes(JSON.stringify(event)) > MAX_USAGE_BYTES,
      )
    )
      return usageError('USAGE_INVALID_SIZE');
    let mismatch = parsed.data.key.length ^ secret.length;
    for (let i = 0; i < secret.length; i++)
      mismatch |= secret.charCodeAt(i) ^ (parsed.data.key.charCodeAt(i) || 0);
    if (mismatch) return usageError('USAGE_INVALID_EVENT');
    const policy = UsagePolicySchema.parse(ports.policy());
    locked = ports.lock.tryLock(1500);
    if (!locked) return usageError('USAGE_BUSY');
    const now = ports.now();
    const window = usageWindow(ports.records(), now);
    const catalog = ports.catalog();
    const rows: { event: UsageEvent; receivedAt: string }[] = [];
    const receipts = parsed.data.events.map((event) => ({
      eventId: event.eventId,
      ...JSON.parse(
        ingest(
          event,
          {
            ...ports,
            catalog: () => catalog,
            append: (event, receivedAt) => rows.push({ event, receivedAt }),
          },
          policy,
          now,
          window,
        ),
      ),
    }));
    if (rows.length) ports.appendBatch(rows);
    return JSON.stringify({ ok: true, receipts });
  } catch {
    return usageError('USAGE_UNAVAILABLE');
  } finally {
    if (locked) ports.lock.releaseLock();
  }
}

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
    const records = ports.records();
    return ingest(event, ports, policy, now, usageWindow(records, now));
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
