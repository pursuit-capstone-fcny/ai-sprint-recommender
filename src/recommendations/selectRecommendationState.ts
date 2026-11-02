import type { CatalogItem } from '../contracts/catalogItem';
import type { IntakeProfile } from '../contracts/intakeProfile';
import {
  RecommendationResponseSchema,
  type RecommendationFallbackReason,
} from '../contracts/recommendation';
import {
  selectRecommendations,
  type RecommendationSelection,
} from './selectRecommendations';

export type RecommendationState =
  | { status: 'ready' | 'abstained'; selection: RecommendationSelection }
  | { status: 'unavailable'; reason: RecommendationFallbackReason };

// UI-only outcome policy. Historical evaluation replay retains its legacy
// selector; nonempty UI results still use its unchanged validation/diversity gate.
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
  const selection = selectRecommendations(
    catalog,
    profile,
    catalogVersion,
    result,
  );
  if (selection.recommendationEngine !== 'llm') {
    return {
      status: 'unavailable',
      reason:
        selection.llmFallbackReason === 'none'
          ? 'unavailable'
          : selection.llmFallbackReason,
    };
  }
  return {
    status: 'ready',
    selection,
  };
}
