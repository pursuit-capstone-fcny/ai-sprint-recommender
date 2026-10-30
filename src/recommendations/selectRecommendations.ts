import type { CatalogItem } from '../contracts/catalogItem';
import type { IntakeProfile } from '../contracts/intakeProfile';
import type { RankedMatch } from '../contracts/rankedMatch';
import {
  RecommendationResponseSchema,
  MAX_RECOMMENDATIONS,
  type RecommendationFallbackReason,
} from '../contracts/recommendation';
import type { RecommendationVersion } from '../contracts/usageEvent';
import { rank } from '../engine';
import { applyDedupe } from '../engine/dedupe';
import { computeMatch } from '../engine/match';

export const RECOMMENDATION_PAGE_SIZE = MAX_RECOMMENDATIONS;
// Preserve the original top-three ordering and two-primary-task gate.
const DIVERSITY_WINDOW = 3;
export interface RecommendationSelection extends Partial<RecommendationVersion> {
  results: RankedMatch[];
  recommendationEngine: 'llm' | 'rules';
  llmFallbackReason: RecommendationFallbackReason | 'none';
}

// Shared by the page and evaluation runner: score the cards people actually see.
export function selectRulesResults(
  catalog: CatalogItem[],
  profile: IntakeProfile,
  count = RECOMMENDATION_PAGE_SIZE,
): RankedMatch[] {
  // Keep the original ranking window while displaying up to eight cards.
  const matches = rank(catalog, profile, {
    topN: DIVERSITY_WINDOW,
  }).slice(0, Math.min(count, MAX_RECOMMENDATIONS));
  return matches[0]?.matchType === 'fallback'
    ? matches
    : matches.filter((match) => match.matchType === 'strong');
}

export function rulesSelection(
  catalog: CatalogItem[],
  profile: IntakeProfile,
  reason: RecommendationFallbackReason,
  versions: Partial<RecommendationVersion> = {},
): RecommendationSelection {
  const results = selectRulesResults(catalog, profile);
  return {
    results,
    recommendationEngine: 'rules',
    llmFallbackReason: results.length ? reason : 'unavailable',
    ...versions,
  };
}

function semanticMatch(item: CatalogItem, profile: IntakeProfile): RankedMatch {
  const signals = computeMatch(item, profile);
  const crossArea = profile.functionArea !== null && !signals.areaMatch;
  const reasons: string[] = [];
  if (signals.areaMatch) reasons.push(`In ${profile.functionArea}`);
  // Only canonical tags support a specific claim; title keywords do not.
  if (signals.matchedTask) reasons.push(`About ${signals.matchedTask}`);
  if (signals.toolTier === 'exact' && signals.matchedTool)
    reasons.push(`Made with ${signals.matchedTool}`);
  if (!reasons.length) reasons.push('Suggested for your goal');
  if (crossArea)
    reasons.push(`From ${item.functionAreas.join(', ') || 'another area'}`);
  return {
    item,
    reason: reasons.join('. '),
    matchType: crossArea ? 'cross-area' : 'semantic',
  };
}

export function selectRecommendations(
  catalog: CatalogItem[],
  profile: IntakeProfile,
  catalogVersion: string,
  response: unknown,
): RecommendationSelection {
  const parsed = RecommendationResponseSchema.safeParse(response);
  if (!parsed.success)
    return rulesSelection(catalog, profile, 'invalid-response');
  const result = parsed.data;
  const versions =
    result.modelVersion && result.promptVersion
      ? {
          modelVersion: result.modelVersion,
          promptVersion: result.promptVersion,
        }
      : {};
  if (result.catalogVersion && result.catalogVersion !== catalogVersion)
    return rulesSelection(catalog, profile, 'catalog-mismatch', versions);
  if (result.outcome === 'fallback')
    return rulesSelection(catalog, profile, result.reason, versions);

  const active = new Map(
    catalog
      .filter((item) => item.status === 'active')
      .map((item) => [item.youtubeId, item]),
  );
  // Reject the whole response. Never blend valid fragments with rules results.
  if (result.youtubeIds.some((id) => !active.has(id)))
    return rulesSelection(catalog, profile, 'invalid-response', versions);
  const results = applyDedupe(
    result.youtubeIds.map((id) => semanticMatch(active.get(id)!, profile)),
    DIVERSITY_WINDOW,
  );
  const distinctTasks = new Set(
    results
      .map(({ item }) => item.tasks[0]?.trim().toLowerCase())
      .filter(Boolean),
  ).size;
  // Untagged picks cannot establish task diversity.
  if (distinctTasks < 2)
    return rulesSelection(catalog, profile, 'insufficient-results', versions);
  return {
    results,
    recommendationEngine: 'llm',
    llmFallbackReason: 'none',
    ...versions,
  };
}
