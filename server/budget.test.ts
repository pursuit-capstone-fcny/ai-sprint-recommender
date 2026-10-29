// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  emptyLedger,
  reserve,
  settle,
  expireLedger,
  type Ledger,
} from './budget';
import { RecommendationBudget } from './budget-object';
import { readLimits } from './config';
import { environment, TestStorage } from './test-helpers';
const limits = readLimits(environment)!;
afterEach(() => vi.useRealTimers());
describe('atomic spend reservations', () => {
  it('carries the lifetime floor and unknown spend across month changes without resetting or double refunds', () => {
    const ledger = emptyLedger();
    const constrained = {
      ...limits,
      LLM_ALLOWANCE_MICRODOLLARS: 1000,
      LLM_PRIOR_MICRODOLLARS: 800,
    };
    const now = Date.parse('2026-10-31T23:59:59Z');
    expect(
      reserve(ledger, constrained, 'known', 'a', 100, now + 5000, now).ok,
    ).toBe(true);
    settle(ledger, 'known', 50);
    settle(ledger, 'known', 0);
    expect(ledger.total).toBe(850);
    expect(
      reserve(ledger, constrained, 'unknown', 'a', 100, now + 5000, now).ok,
    ).toBe(true);
    settle(ledger, 'unknown', null);
    expireLedger(ledger, now + 120000);
    settle(ledger, 'unknown', 0);
    expect(ledger.total).toBe(950);
    expect(
      reserve(
        ledger,
        { ...constrained, LLM_PRIOR_MICRODOLLARS: 0 },
        'new',
        'a',
        100,
        now + 125000,
        now + 120000,
      ),
    ).toEqual({ ok: false, reason: 'budget-exhausted' });
    expect(ledger.total).toBe(950);
  });
  it('serializes concurrent reservations before allowing dispatch', async () => {
    const storage = new TestStorage();
    const object = new RecommendationBudget(
      { storage },
      {
        ...environment,
        LLM_DAILY_MICRODOLLARS: '100',
        LLM_MONTHLY_MICRODOLLARS: '100',
      },
    );
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        object
          .fetch(
            new Request('https://budget/reserve', {
              method: 'POST',
              body: JSON.stringify({
                id: crypto.randomUUID(),
                client: 'a'.repeat(64),
                amount: 60,
                deadline: Date.now() + 5_000,
              }),
            }),
          )
          .then((response) => response.json()),
      ),
    );
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect((await storage.get<Ledger>('ledger'))?.daily).toBe(60);
  });
  it('reconciles actual cost once and prevents duplicate settlement refunds', () => {
    const ledger = emptyLedger();
    const now = Date.now();
    reserve(ledger, limits, 'one', 'a', 500, now + 1_000, now);
    settle(ledger, 'one', 80);
    settle(ledger, 'one', 0);
    expect(ledger.daily).toBe(80);
    expect(ledger.monthly).toBe(80);
  });
  it('charges unknown outcomes and expires concurrency without refunding spend', () => {
    const ledger = emptyLedger();
    const now = Date.now();
    reserve(ledger, limits, 'one', 'a', 500, now + 1_000, now);
    settle(ledger, 'one', null);
    expect(Object.keys(ledger.reservations)).toHaveLength(1);
    expireLedger(ledger, now + 60_001);
    expect(ledger.daily).toBe(500);
    expect(ledger.reservations).toEqual({});
    settle(ledger, 'one', 0);
    expect(ledger.daily).toBe(500);
  });
  it('does not refund a prior day/month reservation into the current bucket', () => {
    const ledger = emptyLedger();
    const before = Date.parse('2026-10-31T23:59:59Z');
    reserve(ledger, limits, 'old', 'a', 500, before + 5_000, before);
    reserve(ledger, limits, 'new', 'b', 100, before + 5_000, before + 2_000);
    settle(ledger, 'old', 50);
    expect(ledger.daily).toBe(100);
    expect(ledger.monthly).toBe(100);
  });
  it('enforces request, client, concurrency, and monthly limits', () => {
    const now = Date.now();
    for (const override of [
      { LLM_REQUESTS_PER_MINUTE: 1 },
      { LLM_CLIENT_REQUESTS_PER_MINUTE: 1 },
      { LLM_MAX_CONCURRENCY: 1 },
      { LLM_MONTHLY_MICRODOLLARS: 500 },
    ]) {
      const ledger = emptyLedger();
      const constrained = { ...limits, ...override };
      expect(
        reserve(ledger, constrained, 'one', 'a', 500, now + 5_000, now).ok,
      ).toBe(true);
      expect(
        reserve(ledger, constrained, 'two', 'a', 500, now + 5_000, now).ok,
      ).toBe(false);
    }
  });
  it('clears short-lived rate hashes on an alarm without more traffic', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-20T12:00:01Z'));
    const storage = new TestStorage();
    const object = new RecommendationBudget({ storage }, environment);
    await object.fetch(
      new Request('https://budget/reserve', {
        method: 'POST',
        body: JSON.stringify({
          id: crypto.randomUUID(),
          client: 'a'.repeat(64),
          amount: 60,
          deadline: Date.now() + 5_000,
        }),
      }),
    );
    vi.setSystemTime(new Date('2026-10-20T12:01:02Z'));
    await object.alarm();
    expect((await storage.get<Ledger>('ledger'))?.clients).toEqual({});
  });
});
