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
});
const settleSchema = z.strictObject({
  id: z.uuid(),
  actual: z.number().int().nonnegative().nullable(),
});

export class RecommendationBudget {
  constructor(
    private state: ObjectState,
    private env: Variables,
  ) {}

  async fetch(request: Request): Promise<Response> {
    const limits = readLimits(this.env);
    if (!limits || request.method !== 'POST')
      return Response.json({ ok: false }, { status: 503 });
    const action = new URL(request.url).pathname;
    if (
      action === '/summary' &&
      limits.LLM_ENVIRONMENT === 'test' &&
      limits.LLM_ALLOWANCE_MICRODOLLARS !== undefined
    ) {
      const ledger = await this.state.storage.get<Ledger>('ledger');
      return Response.json({
        allowanceMicrodollars: limits.LLM_ALLOWANCE_MICRODOLLARS,
        spentMicrodollars: Math.max(
          ledger?.total ?? 0,
          limits.LLM_PRIOR_MICRODOLLARS ?? 0,
        ),
      });
    }
    const parsed = (
      action === '/reserve' ? reserveSchema : settleSchema
    ).safeParse(await request.json());
    if (!parsed.success || !['/reserve', '/settle'].includes(action))
      return Response.json({ ok: false }, { status: 400 });
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
    return Response.json(result);
  }

  async alarm(): Promise<void> {
    const active = await this.state.storage.transaction(async (storage) => {
      const ledger = (await storage.get<Ledger>('ledger')) ?? emptyLedger();
      expireLedger(ledger, Date.now());
      await storage.put('ledger', ledger);
      return Object.keys(ledger.reservations).length > 0;
    });
    if (active) await this.state.storage.setAlarm(Date.now() + 60_000);
  }
}

export function durableBudget(
  namespace: BudgetNamespace,
  environment: string,
): Budget {
  const stub = namespace.get(namespace.idFromName(environment));
  return {
    async reserve(id, client, amount, deadline) {
      const response = await stub.fetch(
        new Request('https://budget/reserve', {
          method: 'POST',
          body: JSON.stringify({ id, client, amount, deadline }),
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
