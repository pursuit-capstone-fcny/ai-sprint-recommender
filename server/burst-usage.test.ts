// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { UsageBuffer, bufferUsage } from './usage-buffer';
import { TestStorage } from './test-helpers';
import { catalogFixture } from './scoring-test-helpers';
import {
  CATALOG_SCORING_MODEL,
  CATALOG_SCORING_PROMPT,
} from './full-catalog-scoring';
import { catalogDataJson } from '../src/library/catalog';
import { toCatalogItem } from '../src/contracts/catalogItem';
import { UsageEventSchema, type UsageEvent } from '../src/contracts/usageEvent';
import { createRecommendationUsage } from '../src/usage/usageContext';
import {
  buildAnalyticsReport,
  type AcceptedUsage,
} from '../src/analytics/report';
import { receiveUsageBatch, type UsageRecord } from '../apps-script/usage';

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
function setup() {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  const catalog = catalogFixture(8);
  catalog.catalogVersion = `sha256:${createHash('sha256').update(catalogDataJson(catalog)).digest('hex')}`;
  let clock = Date.now();
  const accepted: AcceptedUsage[] = [];
  const records: UsageRecord[] = [];
  const key = 'fixture-only-buffer-key-'.repeat(2);
  const policy = {
    retentionDays: 1,
    maxPerMinute: 20_000,
    maxPerDay: 100_000,
    maxRows: 100_000,
    recommendationVersions: [
      {
        modelVersion: CATALOG_SCORING_MODEL,
        promptVersion: CATALOG_SCORING_PROMPT,
      },
    ],
  };
  let loseReceipt = false;
  const appendBatch = vi.fn((rows: AcceptedUsage[]) => {
    accepted.push(...rows);
    records.push(
      ...rows.map(({ event, receivedAt }) => ({
        eventId: event.eventId,
        receivedAt,
      })),
    );
  });
  const upstream = vi.fn<typeof fetch>(async (_url, init) => {
    const body = receiveUsageBatch(
      { type: 'text/plain', contents: String(init?.body) },
      {
        enabled: true,
        policy: () => policy,
        now: () => new Date(clock),
        catalog: () => catalog,
        records: () => records,
        appendBatch,
        lock: { tryLock: () => true, releaseLock() {} },
      },
      key,
    );
    if (loseReceipt) {
      loseReceipt = false;
      throw new Error('Lost acknowledgment');
    }
    return new Response(body);
  });
  const storage = new Map<string, TestStorage>();
  const objects = new Map<string, UsageBuffer>();
  const env = {
    USAGE_BUFFER_ENABLED: 'true',
    LLM_ENVIRONMENT: 'test',
    LIBRARY_ORIGIN: 'https://library.example.test',
    USAGE_UPSTREAM_URL: 'https://script.google.com/macros/s/fixture/exec',
    USAGE_BATCH_SECRET: key,
    USAGE_BUFFER: {
      idFromName: (name: string) => name,
      get: (id: unknown) => {
        const name = String(id);
        let object = objects.get(name);
        if (!object) {
          const store = storage.get(name) ?? new TestStorage();
          storage.set(name, store);
          object = new UsageBuffer({ storage: store }, env, {
            fetcher: upstream,
            now: () => clock,
          });
          objects.set(name, object);
        }
        return object;
      },
    },
  };
  const catalogFetch = vi.fn<typeof fetch>(async (url) =>
    String(url).endsWith('/current.json')
      ? Response.json({
          schemaVersion: 1,
          catalogVersion: catalog.catalogVersion,
          publishedAt: new Date(clock).toISOString(),
        })
      : Response.json(catalog),
  );
  const enqueue = (events: UsageEvent[]) =>
    bufferUsage(
      new Request('https://app.example/api/usage', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({ events }),
      }),
      env,
      { fetcher: catalogFetch },
    );
  const eventsFor = (llm = false) => {
    const events: UsageEvent[] = [];
    const results = catalog.items.map((item) => ({
      item: toCatalogItem(item),
      reason: 'Synthetic match',
      matchType: llm ? ('semantic' as const) : ('strong' as const),
    }));
    const context = createRecommendationUsage(
      {
        sessionId: crypto.randomUUID(),
        src: 'website',
        sender: {
          send(value) {
            events.push(UsageEventSchema.parse(value));
            return Promise.resolve('accepted');
          },
        },
      },
      catalog,
      { functionArea: null, tools: [], goalWords: [] },
      results,
      true,
      llm
        ? {
            recommendationEngine: 'llm',
            llmFallbackReason: 'none',
            modelVersion: CATALOG_SCORING_MODEL,
            promptVersion: CATALOG_SCORING_PROMPT,
          }
        : undefined,
    );
    context.display(results);
    context.click(results[0], 0, 'embed');
    return events;
  };
  return {
    catalog,
    accepted,
    records,
    objects,
    storage,
    env,
    upstream,
    appendBatch,
    enqueue,
    eventsFor,
    catalogFetch,
    advance(ms: number) {
      clock += ms;
    },
    loseNextReceipt() {
      loseReceipt = true;
    },
  };
}

it.each(['rules', 'llm'])(
  'durably drains 1,000 simultaneous %s searches to 10,000 accepted events and reconciled reporting',
  async (engine) => {
    // Exercise the UTC/New York date boundary without depending on the CI clock.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-04T01:00:00Z'));
    const test = setup();
    const responses = await Promise.all(
      Array.from({ length: 1000 }, () =>
        test.enqueue(test.eventsFor(engine === 'llm')),
      ),
    );
    expect(responses.every((response) => response.ok)).toBe(true);
    expect(test.catalogFetch.mock.calls.length).toBeLessThanOrEqual(4);
    // A new object instance sees the durable queue after eviction/restart.
    test.objects.clear();
    test.loseNextReceipt();
    for (let round = 0; round < 50; round++) {
      test.advance(2000);
      for (const name of test.storage.keys())
        await test.env.USAGE_BUFFER.get(name).alarm();
      const counts = await Promise.all(
        [...test.storage.values()].map((store) =>
          store.get<{ count: number }>('meta'),
        ),
      );
      if (counts.every((meta) => meta?.count === 0)) break;
    }
    expect(test.accepted).toHaveLength(10_000);
    expect(new Set(test.accepted.map((row) => row.event.eventId)).size).toBe(
      10_000,
    );
    expect(test.appendBatch.mock.calls.length).toBeLessThanOrEqual(208);
    const day = '2026-11-03'; // Receipts are reported in America/New_York.
    const report = buildAnalyticsReport({
      current: test.catalog,
      records: test.accepted,
      filter: { startDate: day, endDate: day },
    });
    expect(report.videos.reduce((sum, row) => sum + row.appearances, 0)).toBe(
      8000,
    );
    expect(report.videos.reduce((sum, row) => sum + row.embedClicks, 0)).toBe(
      1000,
    );
    expect(
      test.accepted.filter((row) => row.event.type === 'search'),
    ).toHaveLength(1000);
  },
  20_000,
);

it('deduplicates queued retries and expires undelivered data without an upstream write', async () => {
  const test = setup();
  const events = test.eventsFor();
  await test.enqueue(events);
  await test.enqueue(events);
  expect(
    (await [...test.storage.values()][0].get<{ count: number }>('meta'))?.count,
  ).toBe(10);
  test.advance(3_600_000);
  for (const object of test.objects.values()) await object.alarm();
  expect(test.upstream).not.toHaveBeenCalled();
  expect(
    (await [...test.storage.values()][0].list({ prefix: 'event:', limit: 100 }))
      .size,
  ).toBe(0);
});

it('preserves acknowledged queued events through both production deployment steps', async () => {
  const workflow = readFileSync(
    new URL('../.github/workflows/deploy.yml', import.meta.url),
    'utf8',
  );
  const commands = workflow
    .split('\n')
    .filter((line) =>
      line.includes('command: deploy --config wrangler.library.jsonc'),
    );
  expect(commands).toHaveLength(2);
  const test = setup();
  for (const [index, command] of commands.entries()) {
    await test.enqueue(test.eventsFor());
    const overrides = Object.fromEntries(
      [...command.matchAll(/--var\s+([A-Z_]+):([^\s]+)/g)].map((match) => [
        match[1],
        match[2],
      ]),
    );
    const nextEnv = { ...test.env, ...overrides };
    for (const store of test.storage.values()) {
      const restarted = new UsageBuffer({ storage: store }, nextEnv, {
        fetcher: test.upstream,
      });
      await restarted.alarm();
    }
    expect(test.accepted).toHaveLength((index + 1) * 10);
  }
});

it('purges every expired event after an outage, beyond one delivery page', async () => {
  const test = setup();
  await Promise.all(
    Array.from({ length: 100 }, () => test.enqueue(test.eventsFor())),
  );
  test.advance(3_600_001);
  for (const object of test.objects.values()) await object.alarm();
  expect(test.upstream).not.toHaveBeenCalled();
  for (const store of test.storage.values())
    expect((await store.list({ prefix: 'event:', limit: 4000 })).size).toBe(0);
});

it.each(['disabled', 'invalid-config'])(
  'erases a full shard with bounded storage deletes when %s',
  async (stop) => {
    const test = setup();
    for (let batch = 0; batch < 400; batch++) {
      const events = test.eventsFor().map((event) => ({
        ...event,
        sessionId: '00000000-0000-4000-8000-000000000001',
      }));
      expect((await test.enqueue(events)).ok).toBe(true);
    }
    expect(test.storage.size).toBe(1);
    const store = [...test.storage.values()][0];
    expect((await store.get<{ count: number }>('meta'))?.count).toBe(4000);
    const remove = store.delete.bind(store);
    const deletes = vi
      .spyOn(store, 'delete')
      .mockImplementation(async (keys) => {
        if (Array.isArray(keys) && keys.length > 128)
          throw new Error('Platform delete limit exceeded');
        return remove(keys);
      });
    if (stop === 'disabled') test.env.USAGE_BUFFER_ENABLED = 'false';
    else test.env.USAGE_UPSTREAM_URL = '';
    for (const object of test.objects.values()) await object.alarm();
    expect(test.upstream).not.toHaveBeenCalled();
    expect((await store.list({ prefix: 'event:', limit: 4000 })).size).toBe(0);
    expect(await store.get('meta')).toEqual({
      count: 0,
      failures: 0,
      nextAlarm: 0,
    });
    expect(
      deletes.mock.calls.every(
        ([keys]) => !Array.isArray(keys) || keys.length <= 128,
      ),
    ).toBe(true);
  },
);

it('does not forward the batch secret through an untrusted redirect', async () => {
  const test = setup();
  await test.enqueue(test.eventsFor());
  test.upstream.mockResolvedValue(
    new Response(null, {
      status: 302,
      headers: { Location: 'https://untrusted.example/collect' },
    }),
  );
  for (const object of test.objects.values()) await object.alarm();
  expect(test.upstream).toHaveBeenCalledTimes(1);
  expect(test.upstream.mock.calls[0][1]?.redirect).toBe('manual');
  expect(
    (await [...test.storage.values()][0].get<{ count: number }>('meta'))?.count,
  ).toBe(10);
});

it('follows the Apps Script response redirect using GET without the secret or event body', async () => {
  const test = setup();
  const events = test.eventsFor();
  await test.enqueue(events);
  test.upstream
    .mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: {
          Location:
            'https://script.googleusercontent.com/macros/echo?fixture=1',
        },
      }),
    )
    .mockResolvedValueOnce(
      Response.json({
        ok: true,
        receipts: events.map((event) => ({
          eventId: event.eventId,
          ok: true,
          status: 'accepted',
        })),
      }),
    );
  for (const object of test.objects.values()) await object.alarm();
  expect(test.upstream).toHaveBeenCalledTimes(2);
  expect(test.upstream.mock.calls[1][1]).toMatchObject({
    method: 'GET',
    redirect: 'error',
    credentials: 'omit',
  });
  expect(test.upstream.mock.calls[1][1]?.body).toBeUndefined();
  expect(
    (await [...test.storage.values()][0].get<{ count: number }>('meta'))?.count,
  ).toBe(0);
});

it('honors a collector cooldown while still deleting expired queued events', async () => {
  const test = setup();
  const events = test.eventsFor();
  await test.enqueue(events);
  test.upstream.mockResolvedValue(
    Response.json({
      ok: true,
      receipts: events.map((event) => ({
        eventId: event.eventId,
        error: { code: 'USAGE_RATE_LIMITED', retryAfterMs: 86_400_000 },
      })),
    }),
  );
  for (const object of test.objects.values()) await object.alarm();
  test.advance(60_000);
  for (const object of test.objects.values()) await object.alarm();
  expect(test.upstream).toHaveBeenCalledTimes(1);
  test.advance(3_600_000);
  for (const object of test.objects.values()) await object.alarm();
  expect(test.upstream).toHaveBeenCalledTimes(1);
  expect(
    (await [...test.storage.values()][0].get<{ count: number }>('meta'))?.count,
  ).toBe(0);
});

it('rejects invalid references and unknown private fields before durable storage', async () => {
  const test = setup();
  const events = test.eventsFor();
  expect(
    (
      await test.enqueue([
        { ...events[0], catalogVersion: `sha256:${'0'.repeat(64)}` },
      ])
    ).status,
  ).toBe(400);
  const response = await bufferUsage(
    new Request('https://app.example/api/usage', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        events: [{ ...events[0], rawGoal: 'not permitted' }],
      }),
    }),
    test.env,
    { fetcher: test.catalogFetch },
  );
  expect(response.status).toBe(400);
  expect(test.storage.size).toBe(0);
  expect(test.upstream).not.toHaveBeenCalled();
});
