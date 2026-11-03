import { z } from 'zod';
import {
  emptyLedger,
  expireLedger,
  reserve,
  settle,
  type Ledger,
  type Budget,
  type ReservationResult,
} from './budget';
import { readLimits, type Variables } from './config';

// The small interface uses documented Durable Object storage methods; no browser state is trusted.
export interface ObjectStorage {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  transaction<T>(callback: (storage: ObjectStorage) => Promise<T>): Promise<T>;
  setAlarm(time: number): Promise<void>;
}
interface ObjectState {
  storage: ObjectStorage;
}
export interface BudgetNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): { fetch(request: Request): Promise<Response> };
}
const reserveSchema = z.strictObject({
  id: z.uuid(),
  client: z.string().regex(/^[a-f0-9]{64}$/),
  amount: z.number().int().positive(),
  deadline: z.number().int().positive(),
  wait: z.boolean().optional(),
});
const settleSchema = z.strictObject({
  id: z.uuid(),
  actual: z.number().int().nonnegative().nullable(),
});

export class RecommendationBudget {
  private waiting = new Map<
    string,
    {
      input: z.infer<typeof reserveSchema>;
      finish: (result: ReservationResult) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private pumping = false;
  private wakeAgain = false;
  private cancelled = new Map<string, number>();

  constructor(
    private state: ObjectState,
    private env: Variables,
  ) {}

  async fetch(request: Request): Promise<Response> {
    const limits = readLimits(this.env);
    if (!limits || request.method !== 'POST')
      return Response.json({ ok: false }, { status: 503 });
    const action = new URL(request.url).pathname;
    for (const [id, expires] of this.cancelled)
      if (expires <= Date.now()) this.cancelled.delete(id);
    if (action === '/cancel') {
      const parsed = z
        .strictObject({ id: z.uuid() })
        .safeParse(await request.json());
      if (!parsed.success) return Response.json({ ok: false }, { status: 400 });
      if (this.cancelled.size < 1000)
        this.cancelled.set(parsed.data.id, Date.now() + 300_000);
      this.complete(parsed.data.id, { ok: false, reason: 'timeout' });
      return Response.json({ ok: true });
    }
    const parsed = (
      action === '/reserve' ? reserveSchema : settleSchema
    ).safeParse(await request.json());
    if (!parsed.success || !['/reserve', '/settle'].includes(action))
      return Response.json({ ok: false }, { status: 400 });
    if (action === '/reserve' && this.env.LLM_ENABLED !== 'true')
      return Response.json({ ok: false, reason: 'timeout' });
    if (
      'client' in parsed.data &&
      parsed.data.wait &&
      this.env.LLM_QUEUE_ENABLED === 'true'
    ) {
      const input = parsed.data;
      if (this.cancelled.has(input.id))
        return Response.json({ ok: false, reason: 'timeout' });
      if (this.waiting.size >= 1000 || this.waiting.has(input.id))
        return Response.json({ ok: false, reason: 'rate-limited' });
      const delay = Math.min(299_000, input.deadline - Date.now());
      if (delay <= 0) return Response.json({ ok: false, reason: 'timeout' });
      const result = new Promise<ReservationResult>((finish) => {
        const timer = setTimeout(() => {
          this.complete(input.id, { ok: false, reason: 'timeout' });
          void this.pump();
        }, delay);
        this.waiting.set(input.id, { input, finish, timer });
      });
      void this.pump();
      return Response.json(await result);
    }
    const result = await this.state.storage.transaction(async (storage) => {
      const ledger = (await storage.get<Ledger>('ledger')) ?? emptyLedger();
      let result: ReservationResult = { ok: true };
      if ('client' in parsed.data)
        result = reserve(
          ledger,
          limits,
          parsed.data.id,
          parsed.data.client,
          parsed.data.amount,
          parsed.data.deadline,
          Date.now(),
        );
      else settle(ledger, parsed.data.id, parsed.data.actual);
      await storage.put('ledger', ledger);
      return result;
    });
    // Per-minute hashes disappear without requiring another visitor.
    await this.state.storage.setAlarm(
      (Math.floor(Date.now() / 60_000) + 1) * 60_000,
    );
    if (action === '/settle') await this.pump();
    return Response.json(result);
  }

  private complete(id: string, result: ReservationResult) {
    const entry = this.waiting.get(id);
    if (!entry) return;
    this.waiting.delete(id);
    clearTimeout(entry.timer);
    entry.finish(result);
  }

  private async pump() {
    if (this.pumping) {
      this.wakeAgain = true;
      return;
    }
    this.pumping = true;
    try {
      for (const [id, entry] of this.waiting) {
        const result = await this.state.storage.transaction(async (storage) => {
          const ledger = (await storage.get<Ledger>('ledger')) ?? emptyLedger();
          const limits = readLimits(this.env);
          if (!limits || this.env.LLM_ENABLED !== 'true') {
            const permission: ReservationResult = {
              ok: false,
              reason: 'timeout',
            };
            return { permission, waiting: false };
          }
          const permission = reserve(
            ledger,
            limits,
            id,
            entry.input.client,
            entry.input.amount,
            entry.input.deadline,
            Date.now(),
          );
          await storage.put('ledger', ledger);
          const waiting =
            !permission.ok &&
            permission.reason !== 'timeout' &&
            !ledger.reservations[id] &&
            (ledger.clients[entry.input.client] ?? 0) <
              limits.LLM_CLIENT_REQUESTS_PER_MINUTE &&
            entry.input.amount <=
              Math.min(
                limits.LLM_DAILY_MICRODOLLARS,
                limits.LLM_MONTHLY_MICRODOLLARS,
              ) &&
            (permission.reason === 'rate-limited' ||
              Object.keys(ledger.reservations).length > 0);
          return { permission, waiting };
        });
        // Cancellation may have removed a waiter during the transaction. A
        // granted but unused reservation is refunded before dispatch is possible.
        if (!this.waiting.has(id) && result.permission.ok) {
          await this.state.storage.transaction(async (storage) => {
            const ledger =
              (await storage.get<Ledger>('ledger')) ?? emptyLedger();
            settle(ledger, id, 0);
            await storage.put('ledger', ledger);
          });
          continue;
        }
        if (result.waiting) {
          await this.state.storage.setAlarm(
            (Math.floor(Date.now() / 60_000) + 1) * 60_000,
          );
          break;
        }
        if (result.permission.ok)
          await this.state.storage.setAlarm(
            (Math.floor(Date.now() / 60_000) + 1) * 60_000,
          );
        this.complete(id, result.permission);
      }
    } catch {
      for (const id of this.waiting.keys())
        this.complete(id, { ok: false, reason: 'timeout' });
    } finally {
      this.pumping = false;
      if (this.wakeAgain) {
        this.wakeAgain = false;
        void this.pump();
      }
    }
  }

  async alarm(): Promise<void> {
    const active = await this.state.storage.transaction(async (storage) => {
      const ledger = (await storage.get<Ledger>('ledger')) ?? emptyLedger();
      expireLedger(ledger, Date.now());
      await storage.put('ledger', ledger);
      return Object.keys(ledger.reservations).length > 0;
    });
    if (active) await this.state.storage.setAlarm(Date.now() + 60_000);
    await this.pump();
  }
}

export function durableBudget(
  namespace: BudgetNamespace,
  environment: string,
  wait = false,
): Budget {
  const stub = namespace.get(namespace.idFromName(environment));
  return {
    async reserve(id, client, amount, deadline) {
      const response = await stub.fetch(
        new Request('https://budget/reserve', {
          method: 'POST',
          body: JSON.stringify({
            id,
            client,
            amount,
            deadline,
            ...(wait ? { wait: true } : {}),
          }),
        }),
      );
      const parsed = z
        .union([
          z.object({ ok: z.literal(true) }),
          z.object({
            ok: z.literal(false),
            reason: z.enum(['rate-limited', 'budget-exhausted', 'timeout']),
          }),
        ])
        .safeParse(await response.json());
      if (!response.ok || !parsed.success)
        throw new Error('Budget unavailable');
      return parsed.data;
    },
    async cancel(id) {
      await stub.fetch(
        new Request('https://budget/cancel', {
          method: 'POST',
          body: JSON.stringify({ id }),
        }),
      );
    },
    async settle(id, actual) {
      const response = await stub.fetch(
        new Request('https://budget/settle', {
          method: 'POST',
          body: JSON.stringify({ id, actual }),
        }),
      );
      if (!response.ok) throw new Error('Budget unavailable');
    },
  };
}
