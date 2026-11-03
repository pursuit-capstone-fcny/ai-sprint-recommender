import { afterEach, expect, it, vi } from 'vitest';
import fixture from '../../fixtures/public-catalog.json';
import { searchEvent } from '../../fixtures/usage-events';
import { parsePublicCatalog } from '../contracts/publicCatalog';
import {
  receiveUsage,
  type UsagePorts,
  type UsageRecord,
} from '../../apps-script/usage';
import { createUsageSender } from './sendUsage';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it.each(['minute', 'day'])(
  'AC-16.9: resumes fresh actions after the real collector %s cap expires without replaying blocked events',
  async (window) => {
    vi.useFakeTimers();
    vi.setSystemTime('2026-10-20T12:00:00.000Z');
    const catalog = parsePublicCatalog(fixture);
    const records: UsageRecord[] = [];
    const ports: UsagePorts = {
      enabled: true,
      policy: () => ({
        retentionDays: 1,
        maxPerMinute: 20,
        maxPerDay: window === 'day' ? 20 : 1000,
        maxRows: 1000,
        recommendationVersions: [],
      }),
      now: () => new Date(),
      lock: { tryLock: () => true, releaseLock: () => {} },
      catalog: () => catalog,
      records: () => records,
      append: (event, receivedAt) => {
        records.push({ eventId: event.eventId, receivedAt });
      },
    };
    const fetcher = vi.fn<typeof fetch>(
      async (_url, init) =>
        new Response(
          receiveUsage(
            { type: 'text/plain', contents: String(init?.body) },
            ports,
          ),
          { headers: { 'content-type': 'application/json' } },
        ),
    );
    vi.stubGlobal('fetch', fetcher);
    const sender = createUsageSender(
      'https://script.google.com/macros/s/test/exec',
    );
    const event = () => ({
      ...searchEvent,
      eventId: crypto.randomUUID(),
      time: new Date().toISOString(),
    });
    for (let i = 0; i < 20; i++)
      expect(await sender.send(event(), catalog)).toBe('accepted');
    const blocked = event();
    expect(await sender.send(blocked, catalog)).toBe('dropped');
    const delay = window === 'day' ? 12 * 60 * 60 * 1000 : 60_000;
    await vi.advanceTimersByTimeAsync(delay - 1);
    expect(await sender.send(event(), catalog)).toBe('dropped');
    expect(fetcher).toHaveBeenCalledTimes(21);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetcher).toHaveBeenCalledTimes(21);
    const fresh = event();
    expect(await sender.send(fresh, catalog)).toBe('accepted');
    expect(fetcher).toHaveBeenCalledTimes(22);
    expect(records).toHaveLength(21);
    expect(records.some((row) => row.eventId === blocked.eventId)).toBe(false);
    expect(records.at(-1)?.eventId).toBe(fresh.eventId);
  },
);
