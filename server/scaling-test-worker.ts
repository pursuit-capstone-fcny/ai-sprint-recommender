// Isolated local load target. This module is never a production entry point.
import { recommend } from './recommendations';
import { RecommendationBudget } from './budget-object';
import type { ObjectStorage, BudgetNamespace } from './budget-object';
import {
  UsageBuffer as RealUsageBuffer,
  bufferUsage,
  type BufferStorage,
} from './usage-buffer';
import { catalogFixture } from './scoring-test-helpers';
import { catalogDataJson } from '../src/library/catalog';
import { receiveUsageBatch } from '../apps-script/usage';
import type { UsageRecord } from '../apps-script/usage';
import {
  buildAnalyticsReport,
  type AcceptedUsage,
} from '../src/analytics/report';
import {
  CATALOG_SCORING_MODEL,
  CATALOG_SCORING_PROMPT,
} from './full-catalog-scoring';
import type { Variables } from './config';

interface TestEnv extends Variables {
  RECOMMENDATION_BUDGET: BudgetNamespace;
  USAGE_BUFFER: BudgetNamespace;
  SYNTHETIC_COLLECTOR: BudgetNamespace;
}
let snapshot: ReturnType<typeof createCatalog> | undefined;
async function createCatalog() {
  const catalog = catalogFixture(89);
  catalog.items.forEach((item) => {
    item.tools = ['Fixture editor'];
    item.description +=
      ' These are fictional public examples of nonprofit work and approved tools.'.repeat(
        4,
      );
  });
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(catalogDataJson(catalog)),
  );
  catalog.catalogVersion = `sha256:${Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')}`;
  return catalog;
}
const catalog = () => (snapshot ??= createCatalog());
const fixtureFetch: typeof fetch = async (input) => {
  const current = await catalog();
  return Response.json(
    String(input).endsWith('/current.json')
      ? {
          schemaVersion: 1,
          catalogVersion: current.catalogVersion,
          publishedAt: '2026-11-03T00:00:00Z',
        }
      : current,
  );
};

export class NativeBudget extends RecommendationBudget {
  constructor(
    private nativeState: { storage: ObjectStorage },
    env: Variables,
  ) {
    super(nativeState, env);
  }
  async fetch(request: Request) {
    if (new URL(request.url).pathname === '/metrics') {
      const ledger = await this.nativeState.storage.get<{
        daily: number;
        monthly: number;
      }>('ledger');
      return Response.json({
        daily: ledger?.daily ?? 0,
        monthly: ledger?.monthly ?? 0,
      });
    }
    return super.fetch(request);
  }
}

export class NativeUsageBuffer extends RealUsageBuffer {
  constructor(state: { storage: BufferStorage }, env: TestEnv) {
    super(state, env, {
      fetcher: async (_input, init) =>
        env.SYNTHETIC_COLLECTOR.get(
          env.SYNTHETIC_COLLECTOR.idFromName('collector'),
        ).fetch(new Request('https://fixture/ingest', init)),
    });
  }
}

export class SyntheticCollector {
  private records: UsageRecord[] | undefined;
  constructor(
    private state: { storage: BufferStorage },
    private env: TestEnv,
  ) {}
  async fetch(request: Request) {
    const current = await catalog();
    const path = new URL(request.url).pathname;
    if (path === '/metrics')
      return Response.json(
        (await this.state.storage.get('stats')) ?? { accepted: 0 },
      );
    if (path === '/report') {
      const rows = [
        ...(
          await this.state.storage.list<AcceptedUsage>({
            prefix: 'event:',
            limit: 100_000,
          })
        ).values(),
      ];
      const day = new Date().toISOString().slice(0, 10);
      const report = buildAnalyticsReport({
        current,
        records: rows,
        filter: { startDate: day, endDate: day },
      });
      return Response.json({
        accepted: rows.length,
        searches: rows.filter((row) => row.event.type === 'search').length,
        appearances: report.videos.reduce(
          (sum, row) => sum + row.appearances,
          0,
        ),
        clicks: report.videos.reduce((sum, row) => sum + row.embedClicks, 0),
      });
    }
    const body = await request.text();
    const reply = await this.state.storage.transaction(async (storage) => {
      this.records ??= [
        ...(
          await this.state.storage.list<AcceptedUsage>({
            prefix: 'event:',
            limit: 100_000,
          })
        ).values(),
      ].map(({ event, receivedAt }) => ({
        eventId: event.eventId,
        receivedAt,
      }));
      const appended: AcceptedUsage[] = [];
      const reply = receiveUsageBatch(
        { type: 'text/plain', contents: body },
        {
          enabled: true,
          now: () => new Date(),
          catalog: () => current,
          policy: () => ({
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
          }),
          records: () => this.records!,
          lock: { tryLock: () => true, releaseLock() {} },
          appendBatch: (rows) => appended.push(...rows),
        },
        String(this.env.USAGE_BATCH_SECRET),
      );
      for (const row of appended)
        await storage.put(`event:${row.event.eventId}`, row);
      const stats = (await storage.get<{ accepted: number }>('stats')) ?? {
        accepted: 0,
      };
      await storage.put('stats', {
        accepted: stats.accepted + appended.length,
      });
      this.records.push(
        ...appended.map(({ event, receivedAt }) => ({
          eventId: event.eventId,
          receivedAt,
        })),
      );
      return reply;
    });
    return new Response(reply);
  }
}

let providerCalls = 0,
  active = 0,
  peak = 0,
  arrivals = 0;
let release: () => void = () => {};
const allArrived = new Promise<void>((resolve) => {
  release = resolve;
});
export default {
  async fetch(request: Request, env: TestEnv) {
    const path = new URL(request.url).pathname;
    if (path === '/catalog') return Response.json(await catalog());
    if (path === '/api/usage')
      return bufferUsage(request, env, { fetcher: fixtureFetch });
    if (path === '/api/recommendations') {
      if (++arrivals === 1000) release();
      return recommend(request, env, {
        fetch: fixtureFetch,
        provider: async () => {
          providerCalls++;
          active++;
          peak = Math.max(peak, active);
          await allArrived;
          await new Promise((resolve) => setTimeout(resolve, 25));
          active--;
          return {
            value: {
              youtubeIds: (await catalog()).items
                .slice(0, 8)
                .map((item) => item.youtubeId),
            },
            inputTokens: 3000,
            outputTokens: 500,
          };
        },
      });
    }
    if (path === '/metrics' || path === '/report') {
      const collector = await env.SYNTHETIC_COLLECTOR.get(
        env.SYNTHETIC_COLLECTOR.idFromName('collector'),
      )
        .fetch(new Request(`https://fixture${path}`))
        .then((r) => r.json());
      const spend = await env.RECOMMENDATION_BUDGET.get(
        env.RECOMMENDATION_BUDGET.idFromName('production'),
      )
        .fetch(new Request('https://fixture/metrics'))
        .then((r) => r.json());
      return Response.json({
        scope: 'local-workerd-synthetic-dependencies',
        catalogItems: (await catalog()).items.length,
        providerCalls,
        peak,
        arrivals,
        collector,
        spend,
        paidProviderCalls: 0,
        sheetWrites: 0,
      });
    }
    return new Response('Not found', { status: 404 });
  },
};
