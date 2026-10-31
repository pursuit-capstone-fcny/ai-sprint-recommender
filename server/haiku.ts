import type { ProviderBody } from './anthropic';
import { compactRanking } from './compact-ranking';
import {
  LUNA_GOAL_ELIGIBILITY_INSTRUCTION,
  LUNA_TARGETED_RANKING_INSTRUCTION,
} from './luna-policy';
import {
  HAIKU_RANKING_INSTRUCTION,
  HAIKU_BROWSING_INSTRUCTION,
  HAIKU_FINAL_CHECK_INSTRUCTION,
  HAIKU_MIXED_GOAL_INSTRUCTION,
} from './haiku-policy';

// Keep the existing numeric schema, strict validation and measured accounting.
export function haikuDeployedBody(body: ProviderBody): ProviderBody {
  const compact = compactRanking(body);
  // Preserve each value and the position-to-ID map, separating complete rows.
  const data: { catalog: unknown[] } = JSON.parse(compact.content);
  const content = compact.content.replace(
    JSON.stringify(data.catalog),
    `[\n${data.catalog.map((row) => JSON.stringify(row)).join(',\n')}\n]`,
  );
  const system = [
    HAIKU_RANKING_INSTRUCTION,
    LUNA_GOAL_ELIGIBILITY_INSTRUCTION.replace(
      'return an empty positions array',
      'use null in all eight ranks',
    ),
    body.data.goal.trim()
      ? HAIKU_MIXED_GOAL_INSTRUCTION
      : HAIKU_BROWSING_INSTRUCTION,
    LUNA_TARGETED_RANKING_INSTRUCTION,
    HAIKU_FINAL_CHECK_INSTRUCTION,
  ].join(' ');
  return {
    ...body,
    request: {
      ...body.request,
      system,
      messages: [{ role: 'user', content }],
    },
  };
}
