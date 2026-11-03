import type { PublicCatalog } from '../contracts/publicCatalog';
import {
  hasUsageCatalogReferences,
  UsageEventSchema,
  type UsageEvent,
} from '../contracts/usageEvent';
import { USAGE_BUFFER_PATH } from '../contracts/usageBatch';
import {
  createUsageSender,
  type UsageSender,
  USAGE_TIMEOUT_MS,
} from './sendUsage';

// Feedback uses the existing direct collector and requires its accepted receipt.
// Automatic events receive a distinct durable-enqueue acknowledgment.
export function createBufferedUsageSender(
  url: string,
  automaticUsageEnabled: boolean,
  fetcher: typeof fetch = (...args) => fetch(...args),
): UsageSender {
  const direct = createUsageSender(url, { automaticUsageEnabled: false });
  const queue: {
    event: UsageEvent;
    queuedAt: number;
    finish: (outcome: 'queued' | 'dropped') => void;
  }[] = [];
  let running = false;
  let stopped = false;
  async function drain() {
    if (running) return;
    running = true;
    try {
      while (queue.length) {
        if (stopped) {
          queue.splice(0).forEach((row) => row.finish('dropped'));
          break;
        }
        const batch: typeof queue = [];
        while (queue.length && batch.length < 20) {
          const next = queue[0];
          if (Date.now() - next.queuedAt >= 60_000) {
            queue.shift()!.finish('dropped');
            continue;
          }
          if (
            batch.length &&
            (next.event.catalogVersion !== batch[0].event.catalogVersion ||
              next.event.sessionId !== batch[0].event.sessionId)
          )
            break;
          const bytes = new TextEncoder().encode(
            JSON.stringify({
              events: [...batch, next].map((row) => row.event),
            }),
          ).byteLength;
          if (bytes > 16_384) {
            if (!batch.length) queue.shift()!.finish('dropped');
            break;
          }
          batch.push(queue.shift()!);
        }
        if (!batch.length) continue;
        let outcome: 'queued' | 'dropped' = 'dropped';
        for (let attempt = 0; attempt < 2; attempt++) {
          const abort = new AbortController();
          let timer: ReturnType<typeof setTimeout> | undefined;
          let retryable = true;
          try {
            const timeout = new Promise<never>((_, reject) => {
              timer = setTimeout(() => {
                abort.abort();
                reject(new Error('Usage timeout'));
              }, USAGE_TIMEOUT_MS);
            });
            const deliver = async () => {
              const response = await fetcher(USAGE_BUFFER_PATH, {
                method: 'POST',
                body: JSON.stringify({ events: batch.map((row) => row.event) }),
                credentials: 'omit',
                referrerPolicy: 'no-referrer',
                cache: 'no-store',
                keepalive: true,
                signal: abort.signal,
              });
              const text = await response.text();
              if (text.length > 1024) return false;
              const value = JSON.parse(text);
              const code = value?.error?.code;
              if (code === 'USAGE_DISABLED' || code === 'USAGE_FULL')
                stopped = true;
              if (
                stopped ||
                code === 'USAGE_INVALID_CONFIG' ||
                (response.status >= 400 && response.status < 500)
              )
                retryable = false;
              return (
                response.ok && value?.ok === true && value?.status === 'queued'
              );
            };
            if (await Promise.race([deliver(), timeout])) outcome = 'queued';
          } catch {
            /* A missing receipt is never called queued or delivered. */
          } finally {
            clearTimeout(timer);
          }
          if (outcome === 'queued' || !retryable || attempt === 1) break;
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        batch.forEach((row) => row.finish(outcome));
      }
    } finally {
      running = false;
    }
  }
  return {
    send(value: unknown, catalog: PublicCatalog, options) {
      if (options?.explicitFeedback)
        return direct.send(value, catalog, options);
      const parsed = UsageEventSchema.safeParse(value);
      if (
        !automaticUsageEnabled ||
        stopped ||
        queue.length >= 32 ||
        !parsed.success ||
        parsed.data.type === 'feedback' ||
        !hasUsageCatalogReferences(parsed.data, catalog)
      )
        return Promise.resolve('dropped');
      return new Promise((finish) => {
        queue.push({ event: parsed.data, queuedAt: Date.now(), finish });
        queueMicrotask(() => {
          void drain();
        });
      });
    },
  };
}
