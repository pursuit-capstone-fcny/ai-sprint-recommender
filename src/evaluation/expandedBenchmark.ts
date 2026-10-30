import { z } from 'zod';
import { PublicCatalogSchema } from '../contracts/publicCatalog';
import { toCatalogItem } from '../contracts/catalogItem';
import {
  RecommendationRequestSchema,
  RecommendationResponseSchema,
} from '../contracts/recommendation';
import {
  selectRecommendations,
  rulesSelection,
} from '../recommendations/selectRecommendations';
import { scoreDisplayedResults } from './displayedResults';

// Read the frozen #19 benchmark and saved trials without changing their labels
// or historical reports. This is offline scoring, never fresh live evidence.
const label = z.object({ youtubeId: z.string().regex(/^[A-Za-z0-9_-]{11}$/) });
const benchmarkSchema = z.object({
  id: z.string().min(1),
  catalog: PublicCatalogSchema,
  profiles: z
    .array(
      z.object({
        id: z.string().min(1),
        input: RecommendationRequestSchema.omit({ catalogVersion: true }),
        ideal: z.array(label),
        good: z.array(label),
      }),
    )
    .length(10),
});
const trialsSchema = z.object({
  trials: z
    .array(
      z.object({
        calls: z
          .array(
            z.object({
              profileId: z.string(),
              response: RecommendationResponseSchema,
            }),
          )
          .length(10),
      }),
    )
    .length(3),
});

export function scoreExpandedBenchmark(
  benchmarkInput: unknown,
  trialsInput?: unknown,
) {
  const benchmark = benchmarkSchema.parse(benchmarkInput);
  const trials =
    trialsInput === undefined ? undefined : trialsSchema.parse(trialsInput);
  const profileIds = new Set(benchmark.profiles.map(({ id }) => id));
  if (profileIds.size !== 10)
    throw new Error('Benchmark needs ten distinct profiles.');
  const catalog = benchmark.catalog.items.map(toCatalogItem);
  const ids = new Set(catalog.map(({ youtubeId }) => youtubeId));
  for (const profile of benchmark.profiles) {
    const labels = [...profile.ideal, ...profile.good].map(
      ({ youtubeId }) => youtubeId,
    );
    if (
      new Set(labels).size !== labels.length ||
      labels.some((id) => !ids.has(id))
    )
      throw new Error('Judgments must use distinct active catalog IDs.');
  }
  function score(responseFor?: (id: string) => unknown) {
    return benchmark.profiles.map((profile) => {
      const intake = {
        ...profile.input,
        goalWords: profile.input.goal.split(/\s+/).filter(Boolean),
      };
      const selection = responseFor
        ? selectRecommendations(
            catalog,
            intake,
            benchmark.catalog.catalogVersion,
            responseFor(profile.id),
          )
        : rulesSelection(catalog, intake, 'not-requested');
      return {
        profileId: profile.id,
        recommendationEngine: selection.recommendationEngine,
        llmFallbackReason: selection.llmFallbackReason,
        ...scoreDisplayedResults(profile, selection.results),
      };
    });
  }
  return {
    benchmarkId: benchmark.id,
    catalogVersion: benchmark.catalog.catalogVersion,
    evidence: 'offline-replay' as const,
    qualityApproval: 'pending-client-review' as const,
    rules: score(),
    llm:
      trials?.trials.map(({ calls }) => {
        if (
          new Set(calls.map(({ profileId }) => profileId)).size !== 10 ||
          calls.some(({ profileId }) => !profileIds.has(profileId))
        )
          throw new Error(
            'Every trial must contain each benchmark profile once.',
          );
        return score(
          (id) => calls.find(({ profileId }) => profileId === id)!.response,
        );
      }) ?? [],
  };
}
