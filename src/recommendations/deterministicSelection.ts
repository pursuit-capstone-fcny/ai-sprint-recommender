import { toCatalogItem } from '../contracts/catalogItem';
import type { PublicCatalog } from '../contracts/publicCatalog';
import type { IntakeProfile } from '../contracts/intakeProfile';
import { recommendVideos } from '../engine/deterministicPrompt';
import type { RecommendationSelection } from './selectRecommendations';
import { deterministicCatalog } from './deterministicCatalog';

export function deterministicSelection(
  catalog: PublicCatalog,
  goal: string,
  profile: IntakeProfile,
): RecommendationSelection {
  const result = recommendVideos(deterministicCatalog(catalog), {
    prompt: goal,
    functionArea: profile.functionArea,
    tools: profile.tools,
    limit: 8,
  });
  return {
    results: result.recommendations.map(({ item, reason }) => ({
      item: toCatalogItem(
        catalog.items.find((source) => source.youtubeId === item.youtubeId)!,
      ),
      reason,
      matchType: 'strong',
    })),
    recommendationEngine: 'rules',
    llmFallbackReason: 'not-requested',
  };
}
