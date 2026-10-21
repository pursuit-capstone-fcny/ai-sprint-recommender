import { RECOMMENDATION_PATH } from '../src/contracts/recommendation';
import { recommend, type WorkerEnv } from './recommendations';

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === RECOMMENDATION_PATH) return recommend(request, env);
    if (path.startsWith('/api/'))
      return new Response('Not found', { status: 404 });
    return (
      env.ASSETS?.fetch(request) ?? new Response('Not found', { status: 404 })
    );
  },
};
