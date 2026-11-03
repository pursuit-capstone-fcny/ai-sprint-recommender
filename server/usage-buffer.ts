import { z } from 'zod';
import { UsageBatchSchema } from '../src/contracts/usageBatch';
import {
  hasUsageCatalogReferences,
  type UsageEvent,
} from '../src/contracts/usageEvent';
import { boundedJson } from './bounded-json';
import {
  defaultCatalogCache,
  readSharedCatalogSnapshot,
} from './catalog-cache';
import { CatalogSourceSchema, type Variables } from './config';
import type { BudgetNamespace, ObjectStorage } from './budget-object';
import {
  CATALOG_SCORING_MODEL,
  CATALOG_SCORING_PROMPT,
} from './full-catalog-scoring';

export interface BufferStorage extends ObjectStorage {
  list<T>(options: {
    prefix: string;
    limit: number;
    startAfter?: string;
  }): Promise<Map<string, T>>;
  delete(key: string | string[]): Promise<unknown>;
}
export interface UsageBufferEnv extends Variables {
  USAGE_BUFFER?: BudgetNamespace;
}
type Entry = { event: UsageEvent; expires: number };
type Meta = {
  count: number;
  failures: number;
  nextAlarm: number;
  nextExpiry?: number;
  blockedUntil?: number;
};
const LIMIT = 4000; // Eight shards hold at most 32,000 pending events.
const HOUR = 3_600_000;
const receiptSchema = z.strictObject({
  ok: z.literal(true),
  receipts: z
    .array(
      z.object({
        eventId: z.uuid(),
        ok: z.literal(true).optional(),
        status: z.enum(['accepted', 'duplicate']).optional(),
        error: z
          .object({
            code: z.string(),
            retryAfterMs: z.number().int().positive().optional(),
          })
          .optional(),
      }),
    )
    .max(50),
});
const upstreamConfig = (env: Variables) => {
  const url =
    typeof env.USAGE_UPSTREAM_URL === 'string' ? env.USAGE_UPSTREAM_URL : '';
  const key =
    typeof env.USAGE_BATCH_SECRET === 'string' ? env.USAGE_BATCH_SECRET : '';
  return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(
    url,
  ) &&
    key.length >= 32 &&
    key.length <= 256
    ? { url, key }
    : null;
};
const failure = (code: string, status = 503) =>
  Response.json(
    { error: { code } },
    {
      status,
      headers: {
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      },
    },
  );

export async function bufferUsage(
  request: Request,
  env: UsageBufferEnv,
  deps: { fetcher?: typeof fetch } = {},
): Promise<Response> {
  if (env.USAGE_BUFFER_ENABLED !== 'true') return failure('USAGE_DISABLED');
  if (request.method !== 'POST') return failure('USAGE_INVALID_EVENT', 405);
  if (
    request.headers.get('Origin') &&
    request.headers.get('Origin') !== new URL(request.url).origin
  )
    return failure('USAGE_INVALID_EVENT', 403);
  if (
    !request.headers.get('Content-Type')?.toLowerCase().startsWith('text/plain')
  )
    return failure('USAGE_INVALID_CONTENT_TYPE', 400);
  if (!env.USAGE_BUFFER || !upstreamConfig(env))
    return failure('USAGE_INVALID_CONFIG');
  const source = CatalogSourceSchema.safeParse(env.LIBRARY_ORIGIN);
  if (!source.success) return failure('USAGE_INVALID_CONFIG');
  try {
    const parsed = UsageBatchSchema.safeParse(
      await boundedJson(request, 16_384),
    );
    if (!parsed.success) return failure('USAGE_INVALID_EVENT', 400);
    const first = parsed.data.events[0];
    const catalog = await readSharedCatalogSnapshot({
      origin: new URL(request.url).origin,
      source: `${source.data}/catalog/current.json`,
      requestedVersion: first.catalogVersion,
      signal: request.signal,
      fetcher: deps.fetcher ?? fetch,
      cache: defaultCatalogCache(),
    });
    const now = Date.now();
    if (
      parsed.data.events.some(
        (event) =>
          !hasUsageCatalogReferences(event, catalog) ||
          Date.parse(event.time) <= now - HOUR ||
          Date.parse(event.time) > now + 300_000 ||
          (event.modelVersion &&
            (event.modelVersion !== CATALOG_SCORING_MODEL ||
              event.promptVersion !== CATALOG_SCORING_PROMPT)),
      )
    )
      return failure('USAGE_INVALID_REFERENCE', 400);
    if (request.signal.aborted) return failure('USAGE_UNAVAILABLE');
    const shard = parseInt(first.sessionId.slice(0, 8), 16) % 8;
    const namespace = env.USAGE_BUFFER;
    const object = namespace.get(
      namespace.idFromName(`${env.LLM_ENVIRONMENT}:usage:${shard}`),
    );
    return await object.fetch(
      new Request('https://usage/enqueue', {
        method: 'POST',
        body: JSON.stringify(parsed.data),
      }),
    );
  } catch {
    return failure('USAGE_UNAVAILABLE');
  }
}

export class UsageBuffer {
  private fetcher: typeof fetch;
  private now: () => number;
  constructor(
    private state: { storage: BufferStorage },
    private env: Variables,
    deps: { fetcher?: typeof fetch; now?: () => number } = {},
  ) {
    this.fetcher = deps.fetcher ?? ((...args) => fetch(...args));
    this.now = deps.now ?? (() => Date.now());
  }
  async fetch(request: Request): Promise<Response> {
    if (this.env.USAGE_BUFFER_ENABLED !== 'true')
      return failure('USAGE_DISABLED');
    if (!upstreamConfig(this.env)) return failure('USAGE_INVALID_CONFIG');
    if (
      request.method !== 'POST' ||
      new URL(request.url).pathname !== '/enqueue'
    )
      return failure('USAGE_INVALID_EVENT', 400);
    try {
      const parsed = UsageBatchSchema.safeParse(
        await boundedJson(request, 16_384),
      );
      if (!parsed.success) return failure('USAGE_INVALID_EVENT', 400);
      const now = this.now();
      const result = await this.state.storage.transaction(async (storage) => {
        const meta = (await storage.get<Meta>('meta')) ?? {
          count: 0,
          failures: 0,
          nextAlarm: 0,
        };
        const fresh: UsageEvent[] = [];
        for (const event of parsed.data.events) {
          if (
            !(await storage.get(`event:${event.eventId}`)) &&
            !fresh.some((row) => row.eventId === event.eventId)
          )
            fresh.push(event);
        }
        if (meta.count + fresh.length > LIMIT) return false;
        for (const event of fresh) {
          const expires = Math.min(now + HOUR, Date.parse(event.time) + HOUR);
          await storage.put(`event:${event.eventId}`, {
            event,
            expires,
          } satisfies Entry);
          meta.nextExpiry = Math.min(meta.nextExpiry || Infinity, expires);
        }
        meta.count += fresh.length;
        // Scheduling participates in the transaction, so an enqueue receipt
        // cannot survive without a durable future drain.
        if (
          meta.count &&
          (!meta.nextAlarm ||
            meta.nextAlarm <= now ||
            (meta.nextExpiry ?? Infinity) < meta.nextAlarm)
        ) {
          meta.nextAlarm = Math.min(now + 1000, meta.nextExpiry ?? Infinity);
          await storage.setAlarm(meta.nextAlarm);
        }
        await storage.put('meta', meta);
        return true;
      });
      return result
        ? Response.json(
            { ok: true, status: 'queued' },
            { headers: { 'cache-control': 'no-store' } },
          )
        : failure('USAGE_FULL');
    } catch {
      return failure('USAGE_UNAVAILABLE');
    }
  }

  async alarm(): Promise<void> {
    const storage = this.state.storage;
    const config = upstreamConfig(this.env);
    if (this.env.USAGE_BUFFER_ENABLED !== 'true' || !config) {
      // The asynchronous storage API accepts at most 128 keys per delete.
      // Page the disabled purge too, so a full shard can always be erased.
      for (let offset = 0; offset < LIMIT; offset += 128) {
        const page = await storage.list<Entry>({
          prefix: 'event:',
          limit: 128,
        });
        if (!page.size) break;
        await storage.delete([...page.keys()]);
      }
      await storage.put('meta', { count: 0, failures: 0, nextAlarm: 0 });
      return;
    }
    // A long upstream outage must not leave expired events behind a 50-row
    // delivery page. Scan only when the earliest expiry is due, in bounded pages.
    const paused = await storage.transaction(async (tx) => {
      const meta = await tx.get<Meta>('meta');
      if (!meta?.count) return false;
      if (!meta.nextExpiry || meta.nextExpiry <= this.now()) {
        let after: string | undefined;
        let nextExpiry = Infinity;
        let removed = 0;
        for (let page = 0; page < Math.ceil(LIMIT / 100); page++) {
          const entries = await storage.list<Entry>({
            prefix: 'event:',
            limit: 100,
            startAfter: after,
          });
          for (const [key, row] of entries) {
            after = key;
            if (row.expires <= this.now()) {
              await storage.delete(key);
              removed++;
            } else nextExpiry = Math.min(nextExpiry, row.expires);
          }
          if (entries.size < 100) break;
        }
        meta.count -= removed;
        meta.nextExpiry = Number.isFinite(nextExpiry) ? nextExpiry : 0;
        await tx.put('meta', meta);
      }
      if (meta.blockedUntil && meta.blockedUntil > this.now()) {
        meta.nextAlarm = meta.count
          ? Math.min(meta.blockedUntil, meta.nextExpiry || Infinity)
          : 0;
        if (meta.nextAlarm) await storage.setAlarm(meta.nextAlarm);
        await tx.put('meta', meta);
        return true;
      }
      return false;
    });
    if (paused) return;
    const batch = await storage.list<Entry>({ prefix: 'event:', limit: 50 });
    const now = this.now();
    const remove = new Set<string>();
    const unexpired = [...batch].filter(([key, row]) => {
      if (row.expires <= now) {
        remove.add(key);
        return false;
      }
      return true;
    });
    const active: typeof unexpired = [];
    for (const row of unexpired) {
      if (
        new TextEncoder().encode(
          JSON.stringify({
            batchVersion: 1,
            key: config.key,
            events: [...active, row].map(([, entry]) => entry.event),
          }),
        ).byteLength > 65_536
      )
        break;
      active.push(row);
    }
    let retry = 1000;
    let temporary = false;
    if (active.length) {
      try {
        const signal = AbortSignal.timeout(10_000);
        let response = await this.fetcher(config.url, {
          method: 'POST',
          body: JSON.stringify({
            batchVersion: 1,
            key: config.key,
            events: active.map(([, row]) => row.event),
          }),
          redirect: 'manual',
          signal,
        });
        if ([301, 302, 303].includes(response.status)) {
          const location = new URL(
            response.headers.get('Location') ?? '',
            config.url,
          );
          if (
            location.protocol !== 'https:' ||
            location.hostname !== 'script.googleusercontent.com' ||
            location.username ||
            location.password ||
            location.port ||
            !location.pathname.startsWith('/macros/')
          )
            throw new Error('Untrusted collector redirect');
          // Apps Script ContentService redirects its response. Fetch it with no
          // body or shared secret; never forward a POST through a 307/308.
          await response.body?.cancel();
          response = await this.fetcher(location, {
            method: 'GET',
            redirect: 'error',
            signal,
            credentials: 'omit',
          });
        }
        if (!response.ok) throw new Error('Collector unavailable');
        const decoded = receiptSchema.safeParse(
          await boundedJson(response, 16_384),
        );
        if (!decoded.success || decoded.data.receipts.length !== active.length)
          throw new Error('Invalid receipt');
        const receipts = new Map(
          decoded.data.receipts.map((row) => [row.eventId, row]),
        );
        if (
          receipts.size !== active.length ||
          active.some(([, row]) => !receipts.has(row.event.eventId))
        )
          throw new Error('Incomplete receipt');
        for (const [key, row] of active) {
          const receipt = receipts.get(row.event.eventId)!;
          if (receipt.ok && receipt.status) remove.add(key);
          else if (
            receipt.error &&
            ['USAGE_BUSY', 'USAGE_UNAVAILABLE', 'USAGE_RATE_LIMITED'].includes(
              receipt.error.code,
            )
          ) {
            temporary = true;
            retry = Math.max(retry, receipt.error.retryAfterMs ?? 2000);
          } else if (receipt.error) remove.add(key);
          else throw new Error('Invalid event receipt');
        }
      } catch {
        temporary = true;
        retry = 2000;
      }
    }
    await storage.transaction(async (tx) => {
      const meta = (await tx.get<Meta>('meta')) ?? {
        count: 0,
        failures: 0,
        nextAlarm: 0,
      };
      // Only this alarm removes entries; concurrent enqueue is serialized by
      // the transaction and cannot have its count overwritten by this drain.
      for (const key of remove) await storage.delete(key);
      meta.count = Math.max(0, meta.count - remove.size);
      meta.failures = temporary ? Math.min(6, meta.failures + 1) : 0;
      const delay = Math.max(
        retry,
        temporary ? Math.min(60_000, 1000 * 2 ** meta.failures) : 1000,
      );
      meta.blockedUntil = temporary ? this.now() + delay : 0;
      meta.nextAlarm = meta.count
        ? Math.min(this.now() + delay, meta.nextExpiry || Infinity)
        : 0;
      if (!meta.count) meta.nextExpiry = 0;
      if (meta.nextAlarm) await storage.setAlarm(meta.nextAlarm);
      await tx.put('meta', meta);
    });
    console.info(
      'usage-buffer',
      JSON.stringify({ removed: remove.size, retrying: temporary }),
    );
  }
}
