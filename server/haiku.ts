import type { ProviderBody } from './anthropic';
import { compactRanking } from './compact-ranking';
import { LUNA_TARGETED_RANKING_INSTRUCTION } from './luna-policy';
import { orderHaikuCandidates } from './haiku-candidate-order';
import {
  HAIKU_BREADTH_INSTRUCTION,
  HAIKU_BROWSING_INSTRUCTION,
  HAIKU_FINAL_CHECK_INSTRUCTION,
  HAIKU_MIXED_GOAL_INSTRUCTION,
} from './haiku-policy';

// Anthropic does not support maxItems. Retain its existing eight required
// slots, strict duplicate/range validation and known-usage accounting.
export function haikuDeployedBody(body: ProviderBody): ProviderBody {
  body = orderHaikuCandidates(body);
  const compact = compactRanking(body);
  const system = compact.system
    .replace('return an empty positions array', 'use null in all eight ranks')
    .replace(
      'Return one positions array containing six to eight useful, distinct catalog positions when available, best match first.',
      'Return exactly the eight named fields rank1 through rank8, best match first. Put a distinct catalog position in each useful rank and null in every unused rank. Select six to eight useful videos when available.',
    )
    .replace('an empty array when none fit', 'all nulls when none fit');
  const rankedSystem = body.data.goal.trim()
    ? system.replace(
        LUNA_TARGETED_RANKING_INSTRUCTION,
        `${HAIKU_MIXED_GOAL_INSTRUCTION} ${HAIKU_BREADTH_INSTRUCTION} ${LUNA_TARGETED_RANKING_INSTRUCTION}`,
      )
    : `${system} ${HAIKU_BROWSING_INSTRUCTION}`;
  return {
    ...body,
    request: {
      ...body.request,
      system: `${rankedSystem} ${HAIKU_FINAL_CHECK_INSTRUCTION}`,
      messages: [{ role: 'user', content: compact.content }],
    },
  };
}
