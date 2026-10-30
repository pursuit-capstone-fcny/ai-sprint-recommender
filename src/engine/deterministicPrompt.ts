import type { PublicCatalog } from '../contracts/publicCatalog';
import {
  recommendFromPrompt,
  type PromptOptions,
  type PromptRequest,
} from './prompt';
import { expandedDeterministicRecommendations } from './expandedPrecision';
import { language } from './promptConfig/language';
import { workflows } from './promptConfig/workflows';
import { learningFormats } from './promptConfig/learningFormats';
import { instructions } from './promptConfig/instructions';
import { expansionPolicy } from './promptConfig/expansionPolicy';
import { precisionPolicy } from './promptConfig/precisionPolicy';

export const defaultPromptOptions: PromptOptions = {
  language,
  workflows,
  learningFormats,
  instructions,
};

/** Browser-local free-text recommendations. Callers may supply a reviewed metadata snapshot. */
export function recommendVideos(
  catalog: PublicCatalog,
  request: PromptRequest,
  overrides: PromptOptions = {},
) {
  const options = { ...defaultPromptOptions, ...overrides };
  const current = recommendFromPrompt(catalog, request, options);
  const result = expandedDeterministicRecommendations({
    catalog,
    request: { ...request, limit: request.limit ?? 8 },
    options,
    current,
    expansionPolicy,
    refinementPolicy: precisionPolicy,
  });
  return {
    interpretation: current.interpretation,
    warnings: current.warnings,
    recommendations: result.recommendations.map((row) => ({
      item: catalog.items.find((item) => item.youtubeId === row.youtubeId)!,
      rank: row.rank,
      reason: row.reason,
      origin: row.origin,
    })),
  };
}
