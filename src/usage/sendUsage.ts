import type { PublicCatalog } from '../contracts/publicCatalog';
import {
  hasUsageCatalogReferences,
  UsageEventSchema,
} from '../contracts/usageEvent';

export const USAGE_TIMEOUT_MS = 10_000;
export const USAGE_QUEUE_LIMIT = 32;
const MAX_BYTES = 16_384;
const QUEUE_LIFETIME_MS = 60_000;

type Outcome = 'accepted' | 'duplicate' | 'dropped';
type Attempt = Outcome | 'busy' | 'stopped';
type Pending = {
  body: string;
  queuedAt: number;
  resolve: (outcome: Outcome) => void;
};

async function post(url: string, body: string): Promise<Attempt> {
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
      const response = await fetch(url, {
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
          if (
            ['USAGE_DISABLED', 'USAGE_RATE_LIMITED', 'USAGE_FULL'].includes(
              String(error.code),
            )
          )
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
export function createUsageSender(url: string) {
  const queue: Pending[] = [];
  let running = false;
  let stopped = false;

  async function drain() {
    if (running) return;
    running = true;
    try {
      let next: Pending | undefined;
      while ((next = queue.shift())) {
        let outcome: Attempt = 'dropped';
        if (!stopped && Date.now() - next.queuedAt < QUEUE_LIFETIME_MS) {
          outcome = await post(url, next.body);
          // Only an explicit lock-contention response gets one retry, same ID.
          if (outcome === 'busy') outcome = await post(url, next.body);
          if (outcome === 'stopped') stopped = true;
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
    send(value: unknown, catalog: PublicCatalog): Promise<Outcome> {
      const parsed = UsageEventSchema.safeParse(value);
      if (
        stopped ||
        queue.length >= USAGE_QUEUE_LIMIT ||
        !parsed.success ||
        !hasUsageCatalogReferences(parsed.data, catalog)
      )
        return Promise.resolve('dropped');
      const body = JSON.stringify(parsed.data);
      if (new TextEncoder().encode(body).byteLength > MAX_BYTES)
        return Promise.resolve('dropped');
      return new Promise((resolve) => {
        queue.push({ body, queuedAt: Date.now(), resolve });
        void drain();
      });
    },
  };
}

export type UsageSender = ReturnType<typeof createUsageSender>;
