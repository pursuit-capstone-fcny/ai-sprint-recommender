import type { ProviderBody } from './anthropic';
import { compactRanking } from './compact-ranking';

// Anthropic does not support maxItems. Retain its existing eight required
// slots, strict duplicate/range validation and known-usage accounting.
export function haikuDeployedBody(body: ProviderBody): ProviderBody {
  const compact = compactRanking(body);
  const system = compact.system
    .replace('return an empty positions array', 'use null in all eight ranks')
    .replace(
      'Return one positions array containing six to eight useful, distinct catalog positions when available, best match first.',
      'Return exactly the eight named fields rank1 through rank8, best match first. Put a distinct catalog position in each useful rank and null in every unused rank. Select six to eight useful videos when available.',
    )
    .replace('an empty array when none fit', 'all nulls when none fit');
  return {
    ...body,
    request: {
      ...body.request,
      system,
      messages: [{ role: 'user', content: compact.content }],
    },
  };
}
