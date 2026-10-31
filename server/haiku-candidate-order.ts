import { taskRelevance } from '../src/engine/relevance';
import { normalizeText } from '../src/engine/vocabulary';
import type { ProviderBody } from './anthropic';

// Presentation order only: all candidates remain available. Keep the trusted
// ID map and zero-based output positions together when changing that order.
export function orderHaikuCandidates(body: ProviderBody): ProviderBody {
  const rows = body.data.catalog.map((item, index) => ({
    ...item,
    youtubeId: body.catalogIds[index],
  }));
  const relevance = taskRelevance(rows, normalizeText(body.data.goal));
  const order = rows
    .map((_, index) => index)
    .sort(
      (a, b) =>
        (relevance.get(rows[b].youtubeId) ?? 0) -
          (relevance.get(rows[a].youtubeId) ?? 0) || a - b,
    );
  return {
    ...body,
    catalogIds: order.map((index) => body.catalogIds[index]),
    data: {
      ...body.data,
      catalog: order.map((index, position) => ({
        ...body.data.catalog[index],
        position,
      })),
    },
  };
}
