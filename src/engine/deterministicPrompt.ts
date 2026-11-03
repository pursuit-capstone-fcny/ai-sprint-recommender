import type { PublicCatalog } from '../contracts/publicCatalog';
import {
  interpretPrompt,
  type PromptOptions,
  type PromptRequest,
} from './prompt';
import { language } from './promptConfig/language';
import { workflows } from './promptConfig/workflows';
import { learningFormats } from './promptConfig/learningFormats';
import { instructions } from './promptConfig/instructions';
import { interpretOperation } from './taskIntent';
import { compatibleCandidates } from './taskCompatibility';
import { discoveryCandidates } from './discovery';

export const defaultPromptOptions: PromptOptions = {
  language,
  workflows,
  learningFormats,
  instructions,
};

function optionsForCatalog(catalog: PublicCatalog): PromptOptions {
  const items = new Map(catalog.items.map((item) => [item.youtubeId, item]));
  const dictionaryCompatible = language.tasks.every((rule) =>
    catalog.tasks.includes(rule.task),
  );
  const reviewedInstructions = [
    ...instructions.filter(
      (row) =>
        !items.get(row.youtubeId)?.instructionForm &&
        items.get(row.youtubeId)?.tasks.includes(row.task),
    ),
    ...catalog.items.flatMap((item) =>
      item.instructionForm
        ? item.tasks.map((task) => ({
            youtubeId: item.youtubeId,
            task,
            form: item.instructionForm!,
          }))
        : [],
    ),
  ];
  return {
    language: dictionaryCompatible ? language : undefined,
    workflows: dictionaryCompatible
      ? {
          ...workflows,
          workflows: workflows.workflows.filter((row) =>
            items.get(row.youtubeId)?.tasks.includes(row.task),
          ),
        }
      : undefined,
    learningFormats: {
      ...learningFormats,
      videos: learningFormats.videos.filter((row) => items.has(row.youtubeId)),
    },
    instructions: reviewedInstructions.length
      ? reviewedInstructions
      : undefined,
  };
}

/** Browser-local free-text recommendations. Callers may supply a reviewed metadata snapshot. */
export function recommendVideos(
  catalog: PublicCatalog,
  request: PromptRequest,
  overrides: PromptOptions = {},
) {
  const options = { ...optionsForCatalog(catalog), ...overrides };
  const boundedRequest = { ...request, limit: Math.min(request.limit ?? 8, 8) };
  if (request.prompt.length > 500)
    throw new RangeError('Prompt must be 500 characters or fewer.');
  if (!Number.isInteger(boundedRequest.limit) || boundedRequest.limit < 0)
    throw new RangeError('Result limit must be a nonnegative integer.');
  const current = interpretPrompt(catalog, boundedRequest, options);
  if (!request.prompt.trim())
    return {
      interpretation: current.interpretation,
      warnings: ['Enter a task description of 1 to 500 characters.'],
      recommendations: [],
    };
  const intent = interpretOperation(
    request.prompt,
    current.interpretation,
    catalog,
    options,
  );
  if (
    (!intent.operation || intent.operation.requireToolOnlyProof) &&
    current.unsupportedOnlyTool
  )
    return {
      interpretation: intent.interpretation,
      warnings: [
        "Cannot verify tool-only workflows from the catalog's flat tool tags.",
      ],
      recommendations: [],
    };
  const compatible = intent.operation
    ? compatibleCandidates(catalog, intent, options)
    : discoveryCandidates(catalog, intent, options);
  return {
    interpretation: intent.interpretation,
    warnings: compatible.length
      ? []
      : [
          'No compatible instructional example for the requested operation and constraints.',
        ],
    recommendations: compatible
      .slice(0, boundedRequest.limit)
      .map((row, index) => ({
        item: row.item,
        rank: index + 1,
        reason: row.reason,
        origin: intent.operation ? 'operation' : 'discovery',
      })),
  };
}

export type DeterministicPromptResult = ReturnType<typeof recommendVideos>;
