import type { Limits } from './config';

export interface Reservation {
  amount: number;
  day: string;
  month: string;
  expires: number;
}
export interface Ledger {
  day: string;
  month: string;
  daily: number;
  monthly: number;
  // Lifetime allowance never rolls over with the daily/monthly counters.
  total?: number;
  minute: number;
  requests: number;
  clients: Record<string, number>;
  reservations: Record<string, Reservation>;
}
export type ReservationResult =
  | { ok: true }
  | { ok: false; reason: 'rate-limited' | 'budget-exhausted' | 'timeout' };
export interface Budget {
  reserve(
    id: string,
    client: string,
    amount: number,
    deadline: number,
  ): Promise<ReservationResult>;
  settle(id: string, actual: number | null): Promise<void>;
}

export function emptyLedger(): Ledger {
  return {
    day: '',
    month: '',
    daily: 0,
    monthly: 0,
    minute: 0,
    requests: 0,
    clients: {},
    reservations: {},
  };
}

export function expireLedger(ledger: Ledger, now: number): void {
  const day = new Date(now).toISOString().slice(0, 10);
  const month = day.slice(0, 7);
  if (ledger.day !== day) {
    ledger.day = day;
    ledger.daily = 0;
  }
  if (ledger.month !== month) {
    ledger.month = month;
    ledger.monthly = 0;
  }
  const minute = Math.floor(now / 60_000);
  if (ledger.minute !== minute) {
    ledger.minute = minute;
    ledger.requests = 0;
    ledger.clients = {};
  }
  for (const [id, entry] of Object.entries(ledger.reservations)) {
    // An interrupted call can still be billed. Expiry releases concurrency, never spend.
    if (entry.expires <= now) delete ledger.reservations[id];
  }
}

export function reserve(
  ledger: Ledger,
  limits: Limits,
  id: string,
  client: string,
  amount: number,
  deadline: number,
  now: number,
): ReservationResult {
  expireLedger(ledger, now);
  if (limits.LLM_ALLOWANCE_MICRODOLLARS !== undefined)
    ledger.total = Math.max(
      ledger.total ?? 0,
      limits.LLM_PRIOR_MICRODOLLARS ?? 0,
    );
  if (now >= deadline) return { ok: false, reason: 'timeout' };
  if (ledger.reservations[id]) return { ok: false, reason: 'rate-limited' };
  if (
    ledger.requests >= limits.LLM_REQUESTS_PER_MINUTE ||
    (ledger.clients[client] ?? 0) >= limits.LLM_CLIENT_REQUESTS_PER_MINUTE ||
    Object.keys(ledger.reservations).length >= limits.LLM_MAX_CONCURRENCY
  )
    return { ok: false, reason: 'rate-limited' };
  if (
    !Number.isSafeInteger(amount) ||
    amount < 1 ||
    ledger.daily + amount > limits.LLM_DAILY_MICRODOLLARS ||
    ledger.monthly + amount > limits.LLM_MONTHLY_MICRODOLLARS ||
    (limits.LLM_ALLOWANCE_MICRODOLLARS !== undefined &&
      (ledger.total ?? 0) + amount > limits.LLM_ALLOWANCE_MICRODOLLARS)
  )
    return { ok: false, reason: 'budget-exhausted' };
  ledger.requests++;
  ledger.clients[client] = (ledger.clients[client] ?? 0) + 1;
  ledger.daily += amount;
  ledger.monthly += amount;
  if (ledger.total !== undefined) ledger.total += amount;
  ledger.reservations[id] = {
    amount,
    day: ledger.day,
    month: ledger.month,
    expires: now + 60_000,
  };
  return { ok: true };
}

export function settle(
  ledger: Ledger,
  id: string,
  actual: number | null,
): void {
  const entry = ledger.reservations[id];
  if (!entry) return;
  // Unknown usage remains fully charged and holds concurrency until the lease expires.
  if (actual === null) return;
  if (!Number.isSafeInteger(actual) || actual < 0) return;
  if (ledger.day === entry.day) ledger.daily += actual - entry.amount;
  if (ledger.month === entry.month) ledger.monthly += actual - entry.amount;
  if (ledger.total !== undefined) ledger.total += actual - entry.amount;
  delete ledger.reservations[id];
}
