import type { ProviderBody } from './anthropic';
import { compactRanking } from './compact-ranking';
import { LUNA_TARGETED_RANKING_INSTRUCTION } from './luna-policy';
import {
  HAIKU_BREADTH_INSTRUCTION,
  HAIKU_BROWSING_INSTRUCTION,
  HAIKU_FINAL_CHECK_INSTRUCTION,
  HAIKU_MIXED_GOAL_INSTRUCTION,
  HAIKU_V57_SYSTEM_PROMPT,
} from './haiku-policy';

// Keep each candidate together on its own line without changing any field,
// catalog position or response-schema value.
function catalogRows(content: string): string {
  const data: { catalog: unknown[] } = JSON.parse(content);
  return content.replace(
    JSON.stringify(data.catalog),
    `[\n${data.catalog.map((row) => JSON.stringify(row)).join(',\n')}\n]`,
  );
}

// Anthropic does not support maxItems. Retain its existing eight required
// slots, range validation and known-usage accounting.
export function haikuDeployedBody(body: ProviderBody): ProviderBody {
  const compact = compactRanking(body);
  const content = catalogRows(compact.content);
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
    selectionEvidence: true,
    request: {
      ...body.request,
      system: `${rankedSystem} ${HAIKU_FINAL_CHECK_INSTRUCTION}`,
      messages: [{ role: 'user', content }],
    },
  };
}

// V57 sends the same catalog rows and the original numeric rank schema with
// one short system prompt. No usefulness notes are requested.
export function haikuV57Body(body: ProviderBody): ProviderBody {
  return {
    ...body,
    request: {
      ...body.request,
      system: HAIKU_V57_SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: catalogRows(compactRanking(body).content) },
      ],
    },
  };
}
