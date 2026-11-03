import type { CatalogItem } from '../contracts/catalogItem';
import type { IntakeProfile } from '../contracts/intakeProfile';
import {
  RecommendationResponseSchema,
  type RecommendationFallbackReason,
} from '../contracts/recommendation';
import type { RecommendationSelection } from './selectRecommendations';
import { eligibleCatalog, MAX_RECOMMENDATIONS } from './resultPolicy';
import { applyAiDedupe } from './aiDedupe';

export type RecommendationState =
  | { status: 'ready' | 'abstained'; selection: RecommendationSelection }
  | { status: 'unavailable'; reason: RecommendationFallbackReason };

// AI output never invokes deterministic matching or fills missing slots.
export function selectRecommendationState(
  catalog: CatalogItem[],
  profile: IntakeProfile,
  catalogVersion: string,
  response: unknown,
): RecommendationState {
  const parsed = RecommendationResponseSchema.safeParse(response);
  if (!parsed.success)
    return { status: 'unavailable', reason: 'invalid-response' };
  const result = parsed.data;
  if (result.catalogVersion && result.catalogVersion !== catalogVersion)
    return { status: 'unavailable', reason: 'catalog-mismatch' };
  if (result.outcome === 'fallback')
    return { status: 'unavailable', reason: result.reason };
  if (result.youtubeIds.length === 0) {
    return {
      status: 'abstained',
      selection: {
        results: [],
        recommendationEngine: 'llm',
        llmFallbackReason: 'none',
        modelVersion: result.modelVersion,
        promptVersion: result.promptVersion,
      },
    };
  }
  const byId = new Map(
    eligibleCatalog(catalog).map((item) => [item.youtubeId, item]),
  );
  if (
    result.youtubeIds.length > MAX_RECOMMENDATIONS ||
    result.youtubeIds.some((id) => !byId.has(id))
  )
    return { status: 'unavailable', reason: 'invalid-response' };
  // Task tags only reorder picks; they never reject a valid answer.
  const results = applyAiDedupe(
    result.youtubeIds.map((id, index) => ({
      item: byId.get(id)!,
      reason: result.reasons?.[index] ?? 'Suggested for your goal',
      matchType:
        profile.functionArea !== null &&
        !byId.get(id)!.functionAreas.includes(profile.functionArea)
          ? ('cross-area' as const)
          : ('semantic' as const),
    })),
    3,
  );
  const selection: RecommendationSelection = {
    results,
    recommendationEngine: 'llm',
    llmFallbackReason: 'none',
    modelVersion: result.modelVersion,
    promptVersion: result.promptVersion,
  };
  return {
    status: 'ready',
    selection,
  };
}
