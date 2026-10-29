import { RECOMMENDATION_PATH } from '../src/contracts/recommendation';
import { recommend, type WorkerEnv } from './recommendations';
import { CATALOG_PATH, serveCatalog } from './catalog-route';

export default {
  async fetch(
    request: Request,
    env: WorkerEnv,
    ctx?: { waitUntil(task: Promise<unknown>): void },
  ): Promise<Response> {
    const path = new URL(request.url).pathname;
    // Runner-only readback accounts for every call, including unobserved traffic.
    if (path === '/api/test-budget') {
      if (
        request.method !== 'GET' ||
        env.LLM_ENVIRONMENT !== 'test' ||
        env.LLM_PROVIDER !== 'openai' ||
        typeof env.LLM_RATE_KEY !== 'string' ||
        env.LLM_RATE_KEY.length < 32 ||
        request.headers.get('Authorization') !== `Bearer ${env.LLM_RATE_KEY}` ||
        !env.RECOMMENDATION_BUDGET
      )
        return new Response('Not found', { status: 404 });
      const object = env.RECOMMENDATION_BUDGET.get(
        env.RECOMMENDATION_BUDGET.idFromName('test:gpt-6-luna'),
      );
      const response = await object.fetch(
        new Request('https://budget/summary', { method: 'POST' }),
      );
      return new Response(response.body, {
        status: response.status,
        headers: {
          'content-type': 'application/json',
          'cache-control': 'no-store',
        },
      });
    }
    if (path === CATALOG_PATH) return serveCatalog(request, env);
    if (path === RECOMMENDATION_PATH)
      return recommend(request, env, {
        waitUntil: ctx ? (task) => ctx.waitUntil(task) : undefined,
      });
    if (path.startsWith('/api/'))
      return new Response('Not found', { status: 404 });
    return (
      env.ASSETS?.fetch(request) ?? new Response('Not found', { status: 404 })
    );
  },
};
