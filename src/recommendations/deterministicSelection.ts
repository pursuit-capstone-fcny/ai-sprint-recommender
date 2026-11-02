import { toCatalogItem } from '../contracts/catalogItem';
import type { PublicCatalog } from '../contracts/publicCatalog';
import type { IntakeProfile } from '../contracts/intakeProfile';
import { recommendVideos } from '../engine/deterministicPrompt';
import type { RecommendationSelection } from './selectRecommendations';

export function deterministicSelection(
  catalog: PublicCatalog,
  goal: string,
  profile: IntakeProfile,
): RecommendationSelection {
  const result = recommendVideos(catalog, {
    prompt: goal,
    functionArea: profile.functionArea,
    tools: profile.tools,
    limit: 8,
  });
  return {
    results: result.recommendations.map(({ item, reason }) => ({
      item: toCatalogItem(item),
      reason,
      matchType: 'strong',
    })),
    recommendationEngine: 'rules',
    llmFallbackReason: 'not-requested',
  };
}
