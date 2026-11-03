import type { PublicCatalog } from '../contracts/publicCatalog';
import {
  hasUsageCatalogReferences,
  UsageEventSchema,
} from '../contracts/usageEvent';

export const USAGE_TIMEOUT_MS = 10_000;
export const USAGE_QUEUE_LIMIT = 32;
const MAX_BYTES = 16_384;
const QUEUE_LIFETIME_MS = 60_000;

type Outcome = 'accepted' | 'duplicate' | 'dropped' | 'queued';
type Attempt = Outcome | 'busy' | 'stopped' | { rateLimitedUntil: number };
type Pending = {
  body: string;
  queuedAt: number;
  explicitFeedback: boolean;
  resolve: (outcome: Outcome) => void;
};

async function post(
  url: string,
  body: string,
  fetcher: typeof fetch,
  now: () => number,
): Promise<Attempt> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error('Usage timeout'));
      }, USAGE_TIMEOUT_MS);
    });
    const request = async (): Promise<Attempt> => {
      const response = await fetcher(url, {
        method: 'POST',
        body,
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        redirect: 'follow',
        keepalive: true,
        signal: controller.signal,
      });
      if (!response.ok || response.type === 'opaque') return 'dropped';
      const value: unknown = await response.json();
      if (!value || typeof value !== 'object') return 'dropped';
      if ('ok' in value && value.ok === true && 'status' in value) {
        if (value.status === 'accepted' || value.status === 'duplicate')
          return value.status;
      }
      if ('error' in value && value.error && typeof value.error === 'object') {
        const error = value.error;
        if ('code' in error) {
          if (error.code === 'USAGE_BUSY') return 'busy';
          if (error.code === 'USAGE_RATE_LIMITED') {
            const delay =
              'retryAfterMs' in error ? error.retryAfterMs : undefined;
            return {
              rateLimitedUntil:
                typeof delay === 'number' &&
                Number.isSafeInteger(delay) &&
                delay >= 1 &&
                delay <= 86_400_000
                  ? now() + delay
                  : Infinity,
            };
          }
          if (['USAGE_DISABLED', 'USAGE_FULL'].includes(String(error.code)))
            return 'stopped';
        }
      }
      return 'dropped';
    };
    return await Promise.race([request(), deadline]);
  } catch {
    return 'dropped';
  } finally {
    clearTimeout(timer);
  }
}

// Serialize writes to avoid contending with this page's own Apps Script lock.
// Nothing is persisted, and a missing acknowledgment is never called delivered.
export function createUsageSender(
  url: string,
  {
    automaticUsageEnabled = true,
    fetcher = (...args) => fetch(...args),
    now = () => Date.now(),
  }: {
    automaticUsageEnabled?: boolean;
    fetcher?: typeof fetch;
    now?: () => number;
  } = {},
) {
  const queue: Pending[] = [];
  let running = false;
  let stopped = false;
  let rateLimitedUntil = 0;

  async function drain() {
    if (running) return;
    running = true;
    try {
      let next: Pending | undefined;
      while ((next = queue.shift())) {
        let outcome: Attempt = 'dropped';
        if (
          !stopped &&
          (next.explicitFeedback ||
            (now() >= rateLimitedUntil && next.queuedAt >= rateLimitedUntil)) &&
          now() - next.queuedAt < QUEUE_LIFETIME_MS
        ) {
          outcome = await post(url, next.body, fetcher, now);
          // Only an explicit lock-contention response gets one retry, same ID.
          if (outcome === 'busy')
            outcome = await post(url, next.body, fetcher, now);
          if (outcome === 'stopped') stopped = true;
          if (typeof outcome === 'object')
            rateLimitedUntil = Math.max(
              rateLimitedUntil,
              outcome.rateLimitedUntil,
            );
        }
        next.resolve(
          outcome === 'accepted' || outcome === 'duplicate'
            ? outcome
            : 'dropped',
        );
      }
    } finally {
      running = false;
    }
  }

  return {
    send(
      value: unknown,
      catalog: PublicCatalog,
      options?: { explicitFeedback?: boolean },
    ): Promise<Outcome> {
      const parsed = UsageEventSchema.safeParse(value);
      // Only a learner action may try feedback again after a temporary limit.
      // Automatic usage waits for a valid cooldown; disabled/full stay stopped.
      const explicitFeedback =
        options?.explicitFeedback === true &&
        parsed.success &&
        parsed.data.type === 'feedback';
      if (
        (!automaticUsageEnabled && !explicitFeedback) ||
        stopped ||
        (now() < rateLimitedUntil && !explicitFeedback) ||
        queue.length >= USAGE_QUEUE_LIMIT ||
        !parsed.success ||
        (!explicitFeedback &&
          Date.parse(parsed.data.time) < rateLimitedUntil) ||
        !hasUsageCatalogReferences(parsed.data, catalog)
      )
        return Promise.resolve('dropped');
      const body = JSON.stringify(parsed.data);
      if (new TextEncoder().encode(body).byteLength > MAX_BYTES)
        return Promise.resolve('dropped');
      return new Promise((resolve) => {
        queue.push({ body, queuedAt: now(), explicitFeedback, resolve });
        void drain();
      });
    },
  };
}

export type UsageSender = ReturnType<typeof createUsageSender>;
