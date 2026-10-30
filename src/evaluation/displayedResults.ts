import type { RankedMatch } from '../contracts/rankedMatch';

export interface RecommendationJudgments {
  ideal: readonly { youtubeId: string }[];
  good: readonly { youtubeId: string }[];
}

// Score the exact displayed set, including expanded cards. Frozen labels only
// identify known good picks; other picks still need review, not an automatic fail.
export function scoreDisplayedResults(
  judgments: RecommendationJudgments,
  results: readonly RankedMatch[],
) {
  const displayedIds = results.map(({ item }) => item.youtubeId);
  if (new Set(displayedIds).size !== displayedIds.length)
    throw new Error('Displayed recommendations must have distinct IDs.');
  if (results.some(({ item }) => item.status !== 'active'))
    throw new Error('Displayed recommendations must be active.');

  const good = new Set(
    [...judgments.ideal, ...judgments.good].map(({ youtubeId }) => youtubeId),
  );
  const topThreeIds = displayedIds.slice(0, 3);
  const hits = topThreeIds.filter((id) => good.has(id)).length;
  const knownGoodIds = displayedIds.filter((id) => good.has(id));
  return {
    topThree: {
      displayedIds: topThreeIds,
      hits,
      misses: 3 - hits,
      passed: hits >= 2,
    },
    expanded: {
      displayedIds,
      count: displayedIds.length,
      knownGoodIds,
      unreviewedIds: displayedIds.filter((id) => !good.has(id)),
      qualityApproval: 'pending-client-review' as const,
    },
  };
}
