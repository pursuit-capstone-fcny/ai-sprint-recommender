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
