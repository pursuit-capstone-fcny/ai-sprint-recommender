// Isolated test entry point. The ordinary and production bundles never import
// the snapshot or this adapter. All provider and budget paths stay unchanged.
import snapshot from '../docs/evaluation/2026-10-30-luna-ranking/catalog.json';
import worker from './worker';
import { EVALUATION_CATALOG_URL } from './evaluation-catalog-policy';
export { RecommendationBudget } from './budget-object';

export default {
  async fetch(...[request, env, ctx]: Parameters<typeof worker.fetch>) {
    const enabled =
      env.LLM_ENVIRONMENT === 'test' && env.LLM_PROVIDER === 'openai';
    const response = () =>
      Response.json(snapshot, {
        headers: {
          'cache-control': 'no-store',
          'x-content-type-options': 'nosniff',
        },
      });
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/evaluation-catalog/')) {
      if (
        !enabled ||
        request.url !== EVALUATION_CATALOG_URL ||
        request.method !== 'GET'
      )
        return new Response('Not found', { status: 404 });
      return response();
    }
    const fetcher: typeof fetch = async (input, init) => {
      const target = input instanceof Request ? input.url : String(input);
      if (target === EVALUATION_CATALOG_URL) {
        init?.signal?.throwIfAborted();
        if (!enabled) throw new Error('Evaluation catalog is test-only');
        return response();
      }
      return fetch(input, init);
    };
    return worker.fetch(request, env, ctx, { fetch: fetcher });
  },
};
