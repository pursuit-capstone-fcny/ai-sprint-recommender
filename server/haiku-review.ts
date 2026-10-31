import { z } from 'zod';
import { RecommendationIdsSchema } from '../src/contracts/recommendation';
import { taskRelevance } from '../src/engine/relevance';
import { normalizeText } from '../src/engine/vocabulary';
import {
  inputTokenBound,
  RANK_OUTPUT_INSTRUCTION,
  type Provider,
  type ProviderBody,
  type ProviderResult,
} from './anthropic';
import { compactRanking } from './compact-ranking';
import { HAIKU_FINAL_CHECK_INSTRUCTION } from './haiku-policy';
import { LUNA_GOAL_ELIGIBILITY_INSTRUCTION } from './luna-policy';

const REVIEW_SIZE = 18;
const INPUT_LIMIT = 65_000;
const STAGE_OUTPUT_LIMIT = 256;
const output = z.strictObject({ youtubeIds: RecommendationIdsSchema });
const REVIEW_INSTRUCTION = [
  'Review a draft video recommendation for a nonprofit worker. The draft positions are suggestions from an earlier pass, not evidence of relevance. Evaluate the goal and every supplied catalog row independently.',
  'Identify the real activity, the inputs being worked on, and the intended output. Keep the strongest three direct demonstrations first. For every additional video, verify a concrete operation that helps prepare, produce, check, use or follow up that same output. A shared input, audience, tool or topic alone is insufficient. Do not introduce an unrequested medium or a new assignment merely because it uses the same source material. A method from another department can transfer when it teaches an operation the submitted work actually needs.',
  'Review the unused alternatives as well as the draft. Replace weak suggestions with stronger useful alternatives. Aim for six to eight useful videos; before stopping below six, check for other direct demonstrations and supporting operations. Preserve strong direct matches while improving the rest. Do not pad, require an exact title match, or limit useful methods to a department or tool. If fewer than six are useful, return fewer.',
  'Each catalog row uses the field order in catalogFields. draftPositions refer to positions in this supplied catalog only. Emit a fresh complete ranking, not a patch.',
  RANK_OUTPUT_INSTRUCTION,
  LUNA_GOAL_ELIGIBILITY_INSTRUCTION,
  HAIKU_FINAL_CHECK_INSTRUCTION,
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
  const properties = Object.fromEntries(
    Object.keys(schema.properties).map((key) => [
      key,
      {
        anyOf: [
          { type: 'integer', enum: indices.map((_, position) => position) },
          { type: 'null' },
        ],
      },
    ]),
  );
  const compact = JSON.parse(compactRanking({ ...body, data }).content);
  return {
    catalogIds,
    data,
    request: {
      ...body.request,
      max_tokens: STAGE_OUTPUT_LIMIT,
      system: REVIEW_INSTRUCTION,
      messages: [
        {
          role: 'user',
          content: JSON.stringify({
            ...compact,
            draftPositions: draftIds.map((id) => catalogIds.indexOf(id)),
          }),
        },
      ],
      output_config: {
        ...body.request.output_config,
        format: {
          ...body.request.output_config.format,
          schema: { ...schema, properties },
        },
      },
    },
  };
}

// Bound both requests before dispatch. The largest possible review rows and
// eight two-digit draft positions overestimate every selected review subset.
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
