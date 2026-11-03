import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { loadCapacityApp } from './check-usage-capacity.mjs';

// Deliberately restricted to localhost. Never generates production load or paid calls.
const origin = process.argv[2] ?? 'http://127.0.0.1:8791';
const url = new URL(origin);
assert(
  ['127.0.0.1', 'localhost'].includes(url.hostname) &&
    url.protocol === 'http:' &&
    url.pathname === '/' &&
    !url.search &&
    !url.username,
);
const app = await loadCapacityApp();
const catalog = await (await fetch(`${origin}/catalog`)).json();
const prepared = app.prepareCatalogScoring(
  {
    goal: 'Help me with Fixture editor.',
    functionArea: null,
    tools: [],
    catalogVersion: catalog.catalogVersion,
  },
  catalog,
);
assert(prepared.inputTokenBound <= 80_000);
const goal = 'Help me with Fixture editor.';
const profile = { functionArea: null, tools: [], goalWords: goal.split(/\s+/) };
const rules = app.deterministicSelection(catalog, goal, profile).results;
assert.equal(
  rules.length,
  8,
  'The fixture must exercise eight real deterministic matches',
);
const events = [];
function usage(results, llm) {
  const captured = [];
  const context = app.createRecommendationUsage(
    {
      sessionId: crypto.randomUUID(),
      src: 'website',
      sender: {
        send(event) {
          captured.push(event);
          return Promise.resolve('queued');
        },
      },
    },
    catalog,
    profile,
    results,
    true,
    llm
      ? {
          recommendationEngine: 'llm',
          llmFallbackReason: 'none',
          modelVersion: app.CATALOG_SCORING_MODEL,
          promptVersion: app.CATALOG_SCORING_PROMPT,
        }
      : undefined,
  );
  context.display(results);
  context.click(results[0], 0, 'embed');
  return captured;
}
const summary = {
  scope: 'local-workerd-synthetic-dependencies',
  usersPerEngine: 1000,
  catalogItems: catalog.items.length,
  inputTokenBound: prepared.inputTokenBound,
  paidProviderCalls: 0,
  sheetWrites: 0,
  checks: {},
};
try {
  const latencies = [];
  let activeRequests = 0,
    peakRequests = 0;
  const calls = [];
  for (let index = 0; index < 1000; index++) {
    calls.push(
      (async () => {
        events.push(usage(rules, false));
        const start = performance.now();
        activeRequests++;
        peakRequests = Math.max(peakRequests, activeRequests);
        try {
          const response = await fetch(`${origin}/api/recommendations`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'CF-Connecting-IP': '203.0.113.1',
            },
            body: JSON.stringify({
              goal,
              functionArea: null,
              tools: [],
              catalogVersion: catalog.catalogVersion,
              clientId: crypto.randomUUID(),
            }),
            signal: AbortSignal.timeout(299_000),
          });
          const result = await response.json();
          latencies.push(performance.now() - start);
          if (result.outcome === 'success')
            events.push(
              usage(
                result.youtubeIds.map((id) => ({
                  item: app.toCatalogItem(
                    catalog.items.find((row) => row.youtubeId === id),
                  ),
                  reason: 'Synthetic match',
                  matchType: 'semantic',
                })),
                true,
              ),
            );
          return result.outcome;
        } catch {
          return 'transport-error';
        } finally {
          activeRequests--;
        }
      })(),
    );
    // Yield between socket opens rather than scheduling 1,000 expired timers
    // together. The synthetic provider holds until all arrivals are present.
    await delay(1);
  }
  const responses = await Promise.all(calls);
  summary.checks.concurrentClientRequests = peakRequests;
  assert.equal(peakRequests, 1000);
  summary.checks.outcomes = Object.fromEntries(
    [...new Set(responses)].map((outcome) => [
      outcome,
      responses.filter((value) => value === outcome).length,
    ]),
  );
  summary.checks.aiSuccesses = responses.filter(
    (outcome) => outcome === 'success',
  ).length;
  assert.equal(summary.checks.aiSuccesses, 1000);
  latencies.sort((a, b) => a - b);
  summary.checks.aiLatencyMs = Object.fromEntries(
    [50, 95, 99].map((p) => [
      `p${p}`,
      Math.round(latencies[Math.ceil((p / 100) * latencies.length) - 1]),
    ]),
  );
  const sends = [];
  let enqueueAttempts = 0;
  for (const batch of events) {
    const sender = app.createBufferedUsageSender(
      'https://script.google.com/macros/s/fixture/exec',
      true,
      (path, init) => {
        enqueueAttempts++;
        return fetch(`${origin}${path}`, init);
      },
    );
    sends.push(
      Promise.all(batch.map((event) => sender.send(event, catalog))).then(
        (values) => values.every((value) => value === 'queued'),
      ),
    );
    await delay(1);
  }
  const enqueued = await Promise.all(sends);
  summary.checks.queuedPages = enqueued.filter(Boolean).length;
  summary.checks.enqueueAttempts = enqueueAttempts;
  assert.equal(summary.checks.queuedPages, 2000);
  let metrics;
  for (let attempt = 0; attempt < 180; attempt++) {
    metrics = await (await fetch(`${origin}/metrics`)).json();
    if (metrics.collector.accepted === 20_000) break;
    await delay(1000);
  }
  assert.equal(metrics.collector.accepted, 20_000);
  summary.native = await (await fetch(`${origin}/report`)).json();
  assert.equal(summary.native.collector.appearances, 16_000);
  assert.equal(summary.native.collector.clicks, 2000);
  assert.equal(summary.native.collector.searches, 2000);
  assert.equal(summary.native.providerCalls, 1000);
  assert(summary.native.peak <= 32);
  assert.equal(summary.native.spend.daily, 550_000);
  assert.equal(summary.native.spend.monthly, 550_000);
  summary.passed = true;
} catch {
  summary.passed = false;
  process.exitCode = 1;
}
await mkdir('build/evaluation/backend-burst', { recursive: true });
await writeFile(
  'build/evaluation/backend-burst/report.json',
  JSON.stringify(summary, null, 2) + '\n',
);
console.log(JSON.stringify(summary, null, 2));
