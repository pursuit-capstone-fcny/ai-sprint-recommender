import type { CatalogItem } from '../contracts/catalogItem';
import type { IntakeProfile } from '../contracts/intakeProfile';
import type { RankedMatch } from '../contracts/rankedMatch';
import {
  RecommendationResponseSchema,
  type RecommendationFallbackReason,
} from '../contracts/recommendation';
import type { RecommendationVersion } from '../contracts/usageEvent';
import { rank } from '../engine';
import { applyDedupe } from '../engine/dedupe';
import { computeMatch } from '../engine/match';
import {
  applyResultPolicy,
  eligibleCatalog,
  MAX_RECOMMENDATIONS,
  RECOMMENDATION_DIVERSITY_WINDOW,
} from './resultPolicy';

export const RECOMMENDATION_PAGE_SIZE = MAX_RECOMMENDATIONS;
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
  const ranked = rank(eligibleCatalog(catalog), profile, {
    topN: RECOMMENDATION_DIVERSITY_WINDOW,
  });
  return applyResultPolicy(
    ranked.filter((match) => match.matchType === 'strong'),
    ranked.filter((match) => match.matchType === 'fallback'),
  ).slice(0, Math.min(count, MAX_RECOMMENDATIONS));
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
    eligibleCatalog(catalog).map((item) => [item.youtubeId, item]),
  );
  // Reject the whole response. Never blend valid fragments with rules results.
  if (result.youtubeIds.some((id) => !active.has(id)))
    return rulesSelection(catalog, profile, 'invalid-response', versions);
  const results = applyDedupe(
    result.youtubeIds.map((id) => semanticMatch(active.get(id)!, profile)),
    RECOMMENDATION_DIVERSITY_WINDOW,
  );
  const distinctTasks = new Set(
    results
      .map(({ item }) => item.tasks[0]?.trim().toLowerCase())
      .filter(Boolean),
  ).size;
  // Untagged picks keep their place, but cannot establish task diversity.
  if (distinctTasks < 2)
    return rulesSelection(catalog, profile, 'insufficient-results', versions);
  const fallbacks = rank([...active.values()], profile, {
    topN: RECOMMENDATION_DIVERSITY_WINDOW,
  }).map((match): RankedMatch => ({
    ...match,
    matchType: 'fallback',
    // These items were not selected by the model. Do not imply semantic fit.
    reason: match.item.isStartHere
      ? 'A good place to start.'
      : `More from ${match.item.functionAreas[0] ?? 'the catalog'}.`,
  }));
  return {
    results: applyResultPolicy(results, fallbacks),
    recommendationEngine: 'llm',
    llmFallbackReason: 'none',
    ...versions,
  };
}
