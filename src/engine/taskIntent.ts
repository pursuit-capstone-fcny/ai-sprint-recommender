import type { PublicCatalog } from '../contracts/publicCatalog';
import type { PromptInterpretation, PromptOptions } from './prompt';
import { languageTokens, promptWords } from './promptLanguage';
import { promptPolarity } from './promptPolarity';
import { operationRules } from './promptConfig/operations';

export interface CandidateRequirement {
  tasks: string[];
  allTasks?: string[];
  teaching?: string[];
  excludeTasks?: string[];
  excludeTeaching?: string[];
  when?: string[];
  minimumStrength?: number;
  priority: number;
}
export interface OperationRule {
  id: string;
  when: string[][];
  unless?: string[];
  tasks: string[];
  source?: string;
  outputs: string[];
  candidates: CandidateRequirement[];
  explanatory?: boolean;
}
export function containsPhrase(words: readonly string[], phrase: string) {
  const parts = languageTokens(phrase);
  return words.some((_, i) => parts.every((part, j) => words[i + j] === part));
}

/** An operation needs evidence from every condition group, not a single topic noun. */
export function interpretOperation(
  prompt: string,
  current: PromptInterpretation,
  catalog: PublicCatalog,
  options: PromptOptions,
) {
  // Commas can delimit an exclusion list, so retain sentence boundaries but not comma boundaries.
  const words = promptWords(prompt).filter((word) => word !== '\u0001');
  // Handle a noun phrase rejected after its mention: "a slide deck isn't the goal".
  const normalized = prompt.replace(
    /(?:a |the )?([^.!?;]+?)\s+(?:isn't|is not)\s+(?:the |our )?goal\b/gi,
    'not $1',
  );
  const scoped = promptWords(normalized).filter((word) => word !== '\u0001');
  const polarity = promptPolarity(scoped);
  const positive = polarity.positiveWords.map((word) =>
    word === '\u0000' ? word : languageTokens(word).join(' '),
  );
  const has = (phrase: string) => containsPhrase(positive, phrase);
  const operation = [...operationRules]
    .sort((a, b) => b.when.length - a.when.length)
    .find(
      (rule) =>
        rule.when.every((group) => group.some(has)) && !rule.unless?.some(has),
    );
  const exclusions = promptPolarity(words);
  const excluded = words
    .filter((_, index) => exclusions.excluded.has(index))
    .flatMap(languageTokens);
  const excludedTools = catalog.tools.filter((tool) =>
    containsPhrase(excluded, tool),
  );
  const tools = current.tools.filter(
    (tool) =>
      !excludedTools.includes(tool) &&
      (tool !== 'Microsoft Word' ||
        /\b(?:Microsoft Word|(?:in|with|using) Word)\b/.test(prompt)),
  );
  // Required native applications are hard constraints, including apps outside the catalog dictionary.
  const native =
    /\b(?:built[ -]in\s+)?([A-Z][a-zA-Z]+)\s+app\b/.exec(prompt)?.[1] ??
    /\b([A-Z][a-zA-Z]+)['’]s own\b/.exec(prompt)?.[1];
  const nativeRequired =
    !!native &&
    /\b(?:only|actual controls|own formula|without switching)\b/i.test(prompt);
  const requiredTool = nativeRequired ? native : undefined;
  const language = /\b(spanish|french|mandarin|german|arabic|english)\b/i
    .exec(prompt)?.[1]
    .toLowerCase();
  const interpretation: PromptInterpretation = operation
    ? {
        ...current,
        tasks: operation.tasks.filter((task) => catalog.tasks.includes(task)),
        sourceMaterials: operation.source
          ? [operation.source]
          : current.sourceMaterials,
        desiredOutputs: operation.outputs,
        intermediateMaterials: [],
        tools,
        excludedTools: [
          ...new Set([...current.excludedTools, ...excludedTools]),
        ].sort(),
      }
    : {
        ...current,
        tools,
        excludedTools: [
          ...new Set([...current.excludedTools, ...excludedTools]),
        ].sort(),
      };
  return {
    operation,
    interpretation,
    positive,
    requiredTool,
    language: operation?.id === 'language-practice' ? language : undefined,
    learningFormats: options.learningFormats,
  };
}
