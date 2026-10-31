import { z } from 'zod';
import { RecommendationIdsSchema } from '../src/contracts/recommendation';
import { taskRelevance } from '../src/engine/relevance';
import { normalizeText } from '../src/engine/vocabulary';
import {
  inputTokenBound,
  type Provider,
  type ProviderBody,
  type ProviderResult,
} from './anthropic';
import { compactRanking } from './compact-ranking';
import { LUNA_GOAL_ELIGIBILITY_INSTRUCTION } from './luna-policy';

const REVIEW_SIZE = 18;
const INPUT_LIMIT = 65_000;
const STAGE_OUTPUT_LIMIT = 256;
const output = z.strictObject({ youtubeIds: RecommendationIdsSchema });
const REVIEW_INSTRUCTION = [
  'Classify each video independently for the real work described by this nonprofit worker. Do not choose a list length or try to fill slots. Every candidate needs a judgment based on its demonstrated method, not its presence in this candidate set.',
  'Use 2 for a direct demonstration of a requested activity or deliverable. Preserve the intended audience or counterparty and the direction of the work, including whose material is evaluated and who will ask or answer questions. Use 1 for a concrete supporting operation that helps prepare inputs, draft or rehearse, check quality, organize work, or use the requested result. A method can transfer across departments and tools when the operation is still needed. Use 0 when neither connection is demonstrated.',
  'Shared source material does not make an unrelated output useful. A different medium, unrelated document or new project is 0 unless it is needed for the submitted work. General AI knowledge, generic prompting, or an unrelated departmental task is 0 for a concrete workflow unless its demonstrated operation directly helps perform that workflow. Do not manufacture a prerequisite or imagine a new assignment to justify a pick. Conversely, do not reject a usable supporting method solely because the example uses another department or audience.',
  'Inspect every row, including later alternatives. A practical supporting method deserves 1 even without matching title words. Keep all genuinely useful methods; there is no quota for any score and no preferred count of positive judgments.',
  'Each catalog row uses the field order in catalogFields. Return exactly candidate0 through candidateN for the supplied N+1 rows. Every value must be integer 0, 1 or 2. No omissions, repeated keys, explanations or other fields.',
  LUNA_GOAL_ELIGIBILITY_INSTRUCTION.replace(
    'return an empty positions array',
    'give every candidate 0',
  ),
].join(' ');

export interface HaikuReviewDiagnostic {
  providerCallCount?: number;
  reviewCandidateCount?: number;
  draftInputTokens?: number;
  draftOutputTokens?: number;
  reviewInputTokens?: number;
  reviewOutputTokens?: number;
  reviewDecision?: 'reviewed' | 'single' | 'empty' | 'invalid' | 'aborted';
}

function reviewBody(
  body: ProviderBody,
  indices: number[],
  draftIds: string[],
): ProviderBody {
  const catalogIds = indices.map((index) => body.catalogIds[index]);
  const data = {
    ...body.data,
    catalog: indices.map((index, position) => ({
      ...body.data.catalog[index],
      position,
    })),
  };
  const schema = body.request.output_config.format.schema;
  const keys = indices.map((_, position) => `candidate${position}`);
  const properties = Object.fromEntries(
    keys.map((key) => [key, { anyOf: [{ type: 'integer', enum: [0, 1, 2] }] }]),
  );
  const order = [
    ...draftIds,
    ...catalogIds.filter((id) => !draftIds.includes(id)),
  ];
  const compact = JSON.parse(compactRanking({ ...body, data }).content);
  return {
    catalogIds,
    data,
    reviewPriority: catalogIds.map((id) => order.indexOf(id)),
    request: {
      ...body.request,
      max_tokens: STAGE_OUTPUT_LIMIT,
      system: REVIEW_INSTRUCTION,
      messages: [
        {
          role: 'user',
          content: JSON.stringify(compact),
        },
      ],
      output_config: {
        ...body.request.output_config,
        format: {
          ...body.request.output_config.format,
          schema: { ...schema, properties, required: keys },
        },
      },
    },
  };
}

// Bound both requests before dispatch. The largest possible review rows and
// schema framing overestimate every selected review subset.
export function haikuReviewPlan(body: ProviderBody) {
  if (!body.data.goal.trim() || body.catalogIds.length > 48)
    return { review: false, inputBound: inputTokenBound(body) };
  const largest = body.data.catalog
    .map((row, index) => ({
      index,
      size: new TextEncoder().encode(JSON.stringify(row)).length,
    }))
    .sort((a, b) => b.size - a.size)
    .slice(0, REVIEW_SIZE)
    .map((row) => row.index);
  const draft = {
    ...body,
    request: { ...body.request, max_tokens: STAGE_OUTPUT_LIMIT },
  };
  const maximumReview = reviewBody(
    body,
    largest,
    largest.slice(0, 8).map((index) => body.catalogIds[index]),
  );
  const inputBound =
    inputTokenBound(draft) + inputTokenBound(maximumReview) + 32;
  return { review: inputBound <= INPUT_LIMIT, inputBound };
}

function reviewIndices(body: ProviderBody, ids: string[]): number[] {
  const scores = taskRelevance(
    body.data.catalog.map((item, index) => ({
      ...item,
      youtubeId: body.catalogIds[index],
    })),
    normalizeText(body.data.goal),
  );
  const selected = new Set(ids.map((id) => body.catalogIds.indexOf(id)));
  const ranked = body.catalogIds
    .map((_, index) => index)
    .sort(
      (a, b) =>
        (scores.get(body.catalogIds[b]) ?? 0) -
          (scores.get(body.catalogIds[a]) ?? 0) || a - b,
    );
  for (const index of ranked) {
    if (selected.size >= REVIEW_SIZE) break;
    selected.add(index);
  }
  return [...selected].sort((a, b) => a - b);
}

function validUsage(result: ProviderResult) {
  return (
    Number.isSafeInteger(result.inputTokens) &&
    result.inputTokens >= 0 &&
    Number.isSafeInteger(result.outputTokens) &&
    result.outputTokens >= 0
  );
}

export function haikuReviewProvider(
  provider: Provider,
  progress: (value: HaikuReviewDiagnostic) => void = () => undefined,
): Provider {
  return async (body, signal, timing) => {
    signal.throwIfAborted();
    const plan = haikuReviewPlan(body);
    const draft = plan.review
      ? {
          ...body,
          request: { ...body.request, max_tokens: STAGE_OUTPUT_LIMIT },
        }
      : body;
    progress({ providerCallCount: 1, reviewDecision: 'single' });
    const first = await provider(draft, signal, timing);
    if (!validUsage(first)) return first;
    progress({
      draftInputTokens: first.inputTokens,
      draftOutputTokens: first.outputTokens,
    });
    if (!plan.review) return first;
    if (signal.aborted) {
      progress({ reviewDecision: 'aborted' });
      return first; // Let the caller settle known late usage, never display it.
    }
    const parsed = output.safeParse(first.value);
    if (
      first.validationFailure ||
      !parsed.success ||
      parsed.data.youtubeIds.some((id) => !body.catalogIds.includes(id)) ||
      first.inputTokens > inputTokenBound(draft) ||
      first.outputTokens > STAGE_OUTPUT_LIMIT
    ) {
      progress({ reviewDecision: 'invalid' });
      return {
        ...first,
        value: null,
        validationFailure:
          first.validationFailure ?? 'candidate-or-usage-mismatch',
      };
    }
    if (!parsed.data.youtubeIds.length) {
      progress({ reviewDecision: 'empty' });
      return first;
    }
    const review = reviewBody(
      body,
      reviewIndices(body, parsed.data.youtubeIds),
      parsed.data.youtubeIds,
    );
    // Keep the runtime check as well as the pessimistic preflight bound.
    if (inputTokenBound(draft) + inputTokenBound(review) > INPUT_LIMIT)
      throw new Error('Review input exceeds reservation');
    signal.throwIfAborted();
    progress({
      providerCallCount: 2,
      reviewCandidateCount: review.catalogIds.length,
      reviewDecision: 'reviewed',
    });
    // A failure here must propagate: returning the draft would hide the second
    // charge and a failed review. Unknown usage keeps the full reservation.
    const second = await provider(review, signal, timing);
    if (!validUsage(second)) throw new Error('Unknown review usage');
    progress({
      reviewInputTokens: second.inputTokens,
      reviewOutputTokens: second.outputTokens,
    });
    const reviewed = output.safeParse(second.value);
    return {
      ...second,
      ...(!reviewed.success ||
      reviewed.data.youtubeIds.some((id) => !review.catalogIds.includes(id)) ||
      second.inputTokens > inputTokenBound(review) ||
      second.outputTokens > STAGE_OUTPUT_LIMIT
        ? {
            value: null,
            validationFailure:
              second.validationFailure ??
              ('candidate-or-usage-mismatch' as const),
          }
        : {}),
      inputTokens: first.inputTokens + second.inputTokens,
      outputTokens: first.outputTokens + second.outputTokens,
    };
  };
}
