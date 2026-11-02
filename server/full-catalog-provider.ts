import { z } from 'zod';
import type { Provider, ProviderBody } from './anthropic';
import type { RecommendationRequest } from '../src/contracts/recommendation';
import type { PublicCatalog } from '../src/contracts/publicCatalog';
import { boundedJson } from './bounded-json';
import { prepareCatalogScoring } from './full-catalog-scoring';

export function scoringBody(
  input: RecommendationRequest,
  catalog: PublicCatalog,
): ProviderBody {
  const plan = prepareCatalogScoring(input, catalog);
  return {
    request: plan.request,
    catalogIds: catalog.items.map((item) => item.youtubeId),
    complete: plan.complete,
  };
}

const envelopeSchema = z.object({
  stop_reason: z.string(),
  content: z.unknown(),
  usage: z.object({
    input_tokens: z.number().int().nonnegative(),
    output_tokens: z.number().int().nonnegative(),
    cache_creation_input_tokens: z.number().int().nonnegative().optional(),
    cache_read_input_tokens: z.number().int().nonnegative().optional(),
  }),
});
const textSchema = z
  .array(z.object({ type: z.literal('text'), text: z.string().max(131_072) }))
  .length(1);

export function catalogScoringProvider(
  key: string,
  fetcher: typeof fetch = fetch,
): Provider {
  return async (body, signal) => {
    if (!body.complete) throw new Error('Missing catalog assessment validator');
    const response = await fetcher('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal,
      // Reject redirects via the non-OK response check; Workers has no error mode.
      redirect: 'manual',
      headers: {
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': key,
      },
      body: JSON.stringify(body.request),
    });
    if (!response.ok) throw new Error('Provider failed');
    const envelope = envelopeSchema.parse(await boundedJson(response, 262_144));
    const usage = {
      inputTokens:
        envelope.usage.input_tokens +
        (envelope.usage.cache_creation_input_tokens ?? 0) +
        (envelope.usage.cache_read_input_tokens ?? 0),
      outputTokens: envelope.usage.output_tokens,
    };
    if (envelope.stop_reason !== 'end_turn')
      return {
        ...usage,
        value: null,
        validationFailure:
          envelope.stop_reason === 'max_tokens' ? 'max-tokens' : 'stop-reason',
      };
    const text = textSchema.safeParse(envelope.content);
    if (!text.success)
      return { ...usage, value: null, validationFailure: 'content' };
    let decoded: unknown;
    try {
      decoded = JSON.parse(text.data[0].text);
    } catch {
      return { ...usage, value: null, validationFailure: 'json' };
    }
    const result = body.complete(decoded);
    if (result.response.outcome !== 'success')
      return { ...usage, value: null, validationFailure: 'schema' };
    return { ...usage, value: { youtubeIds: result.response.youtubeIds } };
  };
}
