// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { RecommendationBudget, durableBudget } from './budget-object';
import { environment, TestStorage } from './test-helpers';
import type { Ledger } from './budget';

afterEach(() => vi.useRealTimers());
const burstEnv = {
  ...environment,
  LLM_QUEUE_ENABLED: 'true',
  LLM_MAX_CONCURRENCY: '32',
  LLM_REQUESTS_PER_MINUTE: '1000',
  LLM_CLIENT_REQUESTS_PER_MINUTE: '3',
  LLM_DAILY_MICRODOLLARS: '1000000',
  LLM_MONTHLY_MICRODOLLARS: '5000000',
};
function setup(env = burstEnv) {
  const storage = new TestStorage();
  const object = new RecommendationBudget({ storage }, env);
  const budget = durableBudget(
    { idFromName: () => 'test', get: () => object },
    'test',
    true,
  );
  return { storage, object, budget };
}

it('admits 1,000 simultaneous calls as slots and reservations settle, under unchanged caps', async () => {
  const { storage, budget } = setup();
  let inFlight = 0,
    peak = 0;
  const outcomes = await Promise.all(
    Array.from({ length: 1000 }, async (_, index) => {
      const id = crypto.randomUUID();
      const permission = await budget.reserve(
        id,
        index.toString(16).padStart(64, '0'),
        16_192,
        Date.now() + 299_000,
      );
      if (!permission.ok) return permission;
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight--;
      await budget.settle(id, 550);
      return permission;
    }),
  );
  expect(outcomes.every((result) => result.ok)).toBe(true);
  expect(peak).toBeLessThanOrEqual(32);
  const ledger = await storage.get<Ledger>('ledger');
  expect(ledger?.daily).toBe(550_000);
  expect(ledger?.monthly).toBe(550_000);
  expect(ledger?.reservations).toEqual({});
}, 30_000);

it('cancels waiting work without refunding an active reservation', async () => {
  const { storage, budget } = setup({ ...burstEnv, LLM_MAX_CONCURRENCY: '1' });
  const id = crypto.randomUUID();
  expect(
    await budget.reserve(id, 'a'.repeat(64), 100, Date.now() + 10_000),
  ).toEqual({ ok: true });
  const waiting = crypto.randomUUID();
  const result = budget.reserve(
    waiting,
    'b'.repeat(64),
    100,
    Date.now() + 10_000,
  );
  await new Promise((resolve) => setTimeout(resolve, 10));
  await budget.cancel?.(waiting);
  expect(await result).toEqual({ ok: false, reason: 'timeout' });
  expect((await storage.get<Ledger>('ledger'))?.daily).toBe(100);
  await budget.settle(id, 50);
});

it('fails permanently exhausted budget and never dispatches extra work', async () => {
  const { budget } = setup({ ...burstEnv, LLM_DAILY_MICRODOLLARS: '100' });
  const id = crypto.randomUUID();
  await budget.reserve(id, 'a'.repeat(64), 100, Date.now() + 10_000);
  await budget.settle(id, 100);
  expect(
    await budget.reserve(
      crypto.randomUUID(),
      'b'.repeat(64),
      1,
      Date.now() + 10_000,
    ),
  ).toEqual({ ok: false, reason: 'budget-exhausted' });
});

it('honors cancellation that arrives before the admission request', async () => {
  const { storage, budget } = setup();
  const id = crypto.randomUUID();
  await budget.cancel?.(id);
  expect(
    await budget.reserve(id, 'a'.repeat(64), 100, Date.now() + 10_000),
  ).toEqual({ ok: false, reason: 'timeout' });
  expect(await storage.get('ledger')).toBeUndefined();
});

it('expires uncertain reservations without refunding spend or granting waiting work', async () => {
  vi.useFakeTimers();
  vi.setSystemTime('2026-11-03T12:00:01Z');
  const { storage, object, budget } = setup({
    ...burstEnv,
    LLM_DAILY_MICRODOLLARS: '16192',
  });
  const active = crypto.randomUUID();
  await budget.reserve(active, 'a'.repeat(64), 16_192, Date.now() + 5000);
  await budget.settle(active, null);
  const waiting = budget.reserve(
    crypto.randomUUID(),
    'b'.repeat(64),
    16_192,
    Date.now() + 200_000,
  );
  await vi.advanceTimersByTimeAsync(60_000);
  await object.alarm();
  expect(await waiting).toEqual({ ok: false, reason: 'budget-exhausted' });
  expect((await storage.get<Ledger>('ledger'))?.daily).toBe(16_192);
});

it('bounds the waiting queue and rejects overflow without spending', async () => {
  const { budget } = setup({ ...burstEnv, LLM_MAX_CONCURRENCY: '1' });
  const active = crypto.randomUUID();
  await budget.reserve(active, 'a'.repeat(64), 100, Date.now() + 10_000);
  const ids = Array.from({ length: 1000 }, () => crypto.randomUUID());
  const pending = ids.map((id) =>
    budget.reserve(id, 'b'.repeat(64), 100, Date.now() + 10_000),
  );
  const overflow = budget.reserve(
    crypto.randomUUID(),
    'c'.repeat(64),
    100,
    Date.now() + 10_000,
  );
  expect(await overflow).toEqual({ ok: false, reason: 'rate-limited' });
  await Promise.all(ids.map((id) => budget.cancel?.(id)));
  expect((await Promise.all(pending)).every((result) => !result.ok)).toBe(true);
  await budget.settle(active, 0);
});
