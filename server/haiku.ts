import type { ProviderBody } from './anthropic';
import { MAX_RECOMMENDATIONS } from '../src/contracts/recommendation';
import { compactRanking } from './compact-ranking';
import { LUNA_TARGETED_RANKING_INSTRUCTION } from './luna-policy';
import {
  HAIKU_BREADTH_INSTRUCTION,
  HAIKU_BROWSING_INSTRUCTION,
  HAIKU_FINAL_CHECK_INSTRUCTION,
  HAIKU_MIXED_GOAL_INSTRUCTION,
  HAIKU_METHOD_CONNECTION_INSTRUCTION,
  HAIKU_SELECTION_ENCODING_INSTRUCTION,
} from './haiku-policy';

// Anthropic does not support maxItems. Retain its existing eight required
// slots, strict duplicate/range validation and known-usage accounting.
export function haikuDeployedBody(body: ProviderBody): ProviderBody {
  const compact = compactRanking(body);
  const selectionKeys = body.data.catalog.map(
    (item) => `${item.position}: ${item.title}`,
  );
  const rankKeys = Array.from(
    { length: MAX_RECOMMENDATIONS },
    (_, i) => `rank${i + 1}`,
  );
  const system = compact.system
    .replace('return an empty positions array', 'use null in all eight ranks')
    .replace(
      'Return one positions array containing six to eight useful, distinct catalog positions when available, best match first.',
      'Return exactly the eight named fields rank1 through rank8, best match first. Put a distinct catalog position in each useful rank and null in every unused rank. Select six to eight useful videos when available.',
    )
    .replace('an empty array when none fit', 'all nulls when none fit')
    .replace(
      'Copy the integer position provided for each item; never invent a position or return IDs, titles, URLs, or explanations.',
      HAIKU_SELECTION_ENCODING_INSTRUCTION,
    );
  const rankedSystem = body.data.goal.trim()
    ? system.replace(
        LUNA_TARGETED_RANKING_INSTRUCTION,
        `${HAIKU_MIXED_GOAL_INSTRUCTION} ${HAIKU_METHOD_CONNECTION_INSTRUCTION} ${HAIKU_BREADTH_INSTRUCTION} ${LUNA_TARGETED_RANKING_INSTRUCTION}`,
      )
    : `${system} ${HAIKU_BROWSING_INSTRUCTION}`;
  return {
    ...body,
    selectionKeys,
    request: {
      ...body.request,
      output_config: {
        ...body.request.output_config,
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: Object.fromEntries(
              rankKeys.map((key) => [key, { $ref: '#/definitions/choice' }]),
            ),
            required: rankKeys,
            additionalProperties: false,
            definitions: {
              choice: {
                anyOf: [
                  { type: 'string', enum: selectionKeys },
                  { type: 'null' },
                ],
              },
            },
          },
        },
      },
      system: `${rankedSystem} ${HAIKU_FINAL_CHECK_INSTRUCTION}`,
      messages: [{ role: 'user', content: compact.content }],
    },
  };
}
