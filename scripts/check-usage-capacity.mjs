import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { z } from 'zod';

const ActionSchema = z
  .strictObject({
    atMs: z.number().int().min(0).max(86_400_000),
    client: z.number().int().min(0).max(999),
    mode: z.enum(['rules', 'llm', 'topic']),
    cards: z.number().int().min(0).max(1000),
    clicks: z.number().int().min(0).max(100).default(0),
    clients: z.number().int().min(1).max(1000).default(1),
  })
  .refine((action) => action.client + action.clients <= 1000);

export async function loadCapacityApp() {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const { outputFiles } = await build({
    stdin: {
      resolveDir: root,
      contents: `
export { UsagePolicySchema, receiveUsage } from './apps-script/usage';
export { createUsageSender } from './src/usage/sendUsage';
export { createBufferedUsageSender } from './src/usage/bufferedUsage';
export { deterministicSelection } from './src/recommendations/deterministicSelection';
export { createRecommendationUsage } from './src/usage/usageContext';
export { createTopicUsage } from './src/usage/topicUsage';
export { toCatalogItem } from './src/contracts/catalogItem';
export { buildAnalyticsReport } from './src/analytics/report';
export { catalogFixture } from './server/scoring-test-helpers';
export { CATALOG_SCORING_MODEL, CATALOG_SCORING_PROMPT, prepareCatalogScoring } from './server/full-catalog-scoring';
export { readLimits, callCost } from './server/config';
export { emptyLedger, reserve } from './server/budget';`,
    },
    bundle: true,
    platform: 'node',
    format: 'esm',
    write: false,
    define: { 'import.meta.env': '{}' },
  });
  return import(
    `data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`
  );
}

// The real producers, sender, collector and report use an in-memory transport
// and clock. No live endpoint or global fetch/clock replacement is needed.
export async function checkUsageCapacity(input, app) {
  app ??= await loadCapacityApp();
  const config = z
    .strictObject({
      policy: app.UsagePolicySchema,
      ai: z
        .strictObject({
          requests: z.number().int().min(1).max(10_000),
          limits: z.unknown(),
        })
        .optional(),
      startTime: z.iso.datetime().default('2026-10-20T12:00:00.000Z'),
      actions: z
        .array(ActionSchema)
        .min(1)
        .max(5000)
        .refine(
          (actions) =>
            actions.reduce((sum, row) => sum + row.clients, 0) <= 5000,
        )
        .transform((actions) =>
          actions.flatMap(({ clients, ...action }) =>
            Array.from({ length: clients }, (_, index) => ({
              ...action,
              client: action.client + index,
            })),
          ),
        ),
      retained: z
        .array(
          z.strictObject({
            ageMs: z
              .number()
              .int()
              .min(0)
              .max(365 * 86_400_000),
            count: z.number().int().min(1).max(10_000),
          }),
        )
        .max(100)
        .default([]),
    })
    .parse(input);
  const generated = config.actions.reduce(
    (sum, action) => sum + 1 + action.cards + action.clicks,
    0,
  );
  if (
    generated > 50_000 ||
    config.retained.reduce((sum, row) => sum + row.count, 0) > 10_000 ||
    config.actions.some(
      (action) =>
        (action.mode !== 'topic' && action.cards > 8) ||
        (!action.cards && action.clicks),
    )
  )
    throw new Error('Scenario exceeds simulation bounds');
  let aiBurst;
  if (config.ai) {
    const limits = app.readLimits(config.ai.limits);
    if (!limits || limits.LLM_MODEL !== app.CATALOG_SCORING_MODEL)
      throw new Error('Invalid full-catalog AI limits');
    const reservationCeiling = app.callCost(
      limits,
      limits.LLM_MAX_INPUT_TOKENS,
      limits.LLM_MAX_OUTPUT_TOKENS,
    );
    const ledger = app.emptyLedger();
    const rejected = {};
    let admitted = 0;
    for (let i = 0; i < config.ai.requests; i++) {
      const result = app.reserve(
        ledger,
        limits,
        String(i),
        String(i),
        reservationCeiling,
        60_000,
        0,
      );
      if (result.ok) admitted++;
      else rejected[result.reason] = (rejected[result.reason] ?? 0) + 1;
    }
    aiBurst = {
      scope: 'Admission only; all calls held in flight, no provider execution',
      collectorVersionPermitted: config.policy.recommendationVersions.some(
        (row) =>
          row.modelVersion === app.CATALOG_SCORING_MODEL &&
          row.promptVersion === app.CATALOG_SCORING_PROMPT,
      ),
      requests: config.ai.requests,
      admitted,
      rejected,
      configuredRequestsPerMinute: limits.LLM_REQUESTS_PER_MINUTE,
      configuredConcurrency: limits.LLM_MAX_CONCURRENCY,
      dailyMicrodollars: limits.LLM_DAILY_MICRODOLLARS,
      monthlyMicrodollars: limits.LLM_MONTHLY_MICRODOLLARS,
      reservationCeilingMicrodollars: reservationCeiling,
      fullBurstCeilingMicrodollars: reservationCeiling * config.ai.requests,
    };
  }

  const catalog = app.catalogFixture(
    Math.max(1, ...config.actions.map((action) => action.cards)),
  );
  const start = Date.parse(config.startTime);
  let clock = start;
  const accepted = [];
  const records = config.retained.flatMap((row) =>
    Array.from({ length: row.count }, () => ({
      eventId: crypto.randomUUID(),
      receivedAt: new Date(start - row.ageMs).toISOString(),
    })),
  );
  const errors = {};
  const byType = {};
  const sessions = new Map();
  let posts = 0;
  const ports = {
    enabled: true,
    policy: () => config.policy,
    now: () => new Date(clock),
    lock: { tryLock: () => true, releaseLock() {} },
    catalog: () => catalog,
    records: () => records,
    append(event, receivedAt) {
      records.push({ eventId: event.eventId, receivedAt });
      accepted.push({ event, receivedAt });
    },
  };
  const fetcher = async (_url, init) => {
    posts++;
    const receipt = JSON.parse(
      app.receiveUsage(
        { type: 'text/plain', contents: String(init.body) },
        ports,
      ),
    );
    if (receipt.error)
      errors[receipt.error.code] = (errors[receipt.error.code] ?? 0) + 1;
    return Response.json(receipt);
  };
  for (const action of [...config.actions].sort((a, b) => a.atMs - b.atMs)) {
    clock = start + action.atMs;
    let session = sessions.get(action.client);
    if (!session) {
      session = {
        sessionId: crypto.randomUUID(),
        sender: app.createUsageSender(
          'https://script.google.com/macros/s/fixture/exec',
          { fetcher, now: () => clock },
        ),
      };
      sessions.set(action.client, session);
    }
    const expected = 1 + action.cards + action.clicks;
    let completed = 0;
    let finish;
    const done = new Promise((resolve) => (finish = resolve));
    const timer = setTimeout(() => finish(false), 5000);
    const contextSession = {
      sessionId: session.sessionId,
      src: action.mode === 'topic' ? 'team' : 'website',
      sender: {
        async send(value, snapshot) {
          const row = (byType[value.type] ??= {
            generated: 0,
            accepted: 0,
            dropped: 0,
          });
          row.generated++;
          const outcome = await session.sender.send(
            { ...value, time: new Date(clock).toISOString() },
            snapshot,
          );
          row[outcome === 'accepted' ? 'accepted' : 'dropped']++;
          if (++completed === expected) finish(true);
          return outcome;
        },
      },
    };
    const results = catalog.items.slice(0, action.cards).map((item) => ({
      item: app.toCatalogItem(item),
      reason: 'Synthetic capacity check',
      matchType: action.mode === 'llm' ? 'semantic' : 'strong',
    }));
    try {
      if (action.mode === 'topic') {
        const context = app.createTopicUsage(
          contextSession,
          catalog,
          { topic: '', tools: [], functionAreas: [] },
          results,
        );
        context.display();
        for (let i = 0; i < action.clicks; i++) context.click(0, 'embed');
      } else {
        const context = app.createRecommendationUsage(
          contextSession,
          catalog,
          { functionArea: null, tools: [], goalWords: [] },
          results,
          true,
          action.mode === 'llm'
            ? {
                recommendationEngine: 'llm',
                llmFallbackReason: 'none',
                modelVersion: app.CATALOG_SCORING_MODEL,
                promptVersion: app.CATALOG_SCORING_PROMPT,
              }
            : undefined,
        );
        context.display(results);
        for (let i = 0; i < action.clicks; i++)
          context.click(results[0], 0, 'embed');
      }
      if (!(await done)) throw new Error('Scenario did not complete');
    } finally {
      clearTimeout(timer);
    }
  }
  const report = app.buildAnalyticsReport({
    current: catalog,
    records: accepted,
    filter: {
      startDate: new Date(start - 86_400_000).toISOString().slice(0, 10),
      endDate: new Date(clock + 86_400_000).toISOString().slice(0, 10),
    },
  });
  return {
    scope: 'offline-in-memory, not live throughput or deployment validation',
    assumptions: [
      'Empty transport latency, uncontended lock, actions completed in timestamp order',
      'No purge during the scenario; retained rows consume capacity until removed',
      'All synthetic cards are matches; staff traffic uses the same collector caps',
      'Telemetry assumes every search displays its cards, independently of AI admission',
    ],
    passed:
      accepted.length === generated &&
      (!aiBurst ||
        (aiBurst.admitted === aiBurst.requests &&
          aiBurst.collectorVersionPermitted)),
    paidProviderCalls: 0,
    sheetWrites: 0,
    ...(aiBurst ? { aiBurst } : {}),
    startTime: config.startTime,
    policy: config.policy,
    requiredRecommendationVersion: {
      modelVersion: app.CATALOG_SCORING_MODEL,
      promptVersion: app.CATALOG_SCORING_PROMPT,
    },
    actions: config.actions.length,
    generated,
    posts,
    accepted: accepted.length,
    dropped: generated - accepted.length,
    suppressedBeforePost: generated - posts,
    collectorErrors: errors,
    byType,
    learnerDashboard: {
      appearances: report.videos.reduce((sum, row) => sum + row.appearances, 0),
      embedClicks: report.videos.reduce((sum, row) => sum + row.embedClicks, 0),
    },
  };
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  try {
    if (process.argv.length !== 3)
      throw new Error('Expected one scenario file');
    const report = await checkUsageCapacity(
      JSON.parse(await readFile(process.argv[2], 'utf8')),
    );
    console.log(JSON.stringify(report, null, 2));
    if (!report.passed) process.exitCode = 1;
  } catch {
    console.error(
      'Capacity check failed. Supply one valid synthetic scenario JSON file.',
    );
    process.exitCode = 2;
  }
}
