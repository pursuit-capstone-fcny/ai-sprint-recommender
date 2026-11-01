import type { PublicCatalog } from '../contracts/publicCatalog';
import type { PromptInterpretation, PromptOptions } from './prompt';
import { languageTokens, promptWords } from './promptLanguage';
import { promptPolarity } from './promptPolarity';
import { operationRules } from './promptConfig/operations';
import { capabilityConstraints } from './promptConfig/capabilityConstraints';
import { requiredPlatform } from './promptPlatform';

export interface CandidateRequirement {
  tasks: string[];
  allTasks?: string[];
  teaching?: string[];
  excludeTasks?: string[];
  excludeTeaching?: string[];
  when?: string[];
  /** Every cue group must match; phrases inside a group are alternatives. */
  whenAll?: string[][];
  minimumStrength?: number;
  priority: number;
  requireSourceMatch?: boolean;
  requireOutputMatch?: boolean;
}
export interface CapabilityConstraint {
  when: string[][];
  teaching?: string[][];
  tasks?: string[];
  tools?: string[];
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
  precedence?: number;
  clearSource?: boolean;
  outputWhen?: Record<string, string[]>;
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
  // Keep clause boundaries for operation scope. Explicit tool lists are extended below.
  // Handle a noun phrase rejected after its mention: "a slide deck isn't the goal".
  const normalized = prompt
    .replace(
      /(?:a |the )?([^.!?;]+?)\s+(?:isn't|is not)\s+(?:the |our )?goal\b/gi,
      'not $1',
    )
    .replace(/\brules? out\b/gi, 'not');
  const scoped = promptWords(normalized);
  const polarity = promptPolarity(scoped);
  const positive = polarity.positiveWords.map((word) =>
    word === '\u0000' ? word : languageTokens(word).join(' '),
  );
  const has = (phrase: string) => containsPhrase(positive, phrase);
  const recognized = [...operationRules]
    .sort(
      (a, b) =>
        b.when.length - a.when.length ||
        (b.precedence ?? 0) - (a.precedence ?? 0),
    )
    .find(
      (rule) =>
        rule.when.every((group) => group.some(has)) && !rule.unless?.some(has),
    );
  const toolWords = promptWords(normalized);
  const toolPolarity = promptPolarity(toolWords);
  const exclusions = new Set(toolPolarity.excluded);
  // Extend explicit tool-exclusion lists across commas, but stop incidental negatives
  // such as "claims we cannot support, with edits in Word" at the comma.
  for (let start = 0; start < toolWords.length; start++) {
    if (
      !['not', 'no', 'without', 'avoid', 'exclude', 'excluding'].includes(
        toolWords[start],
      )
    )
      continue;
    const following = toolWords.slice(start + 1, start + 5);
    const namesTool = catalog.tools.some(
      (tool) =>
        containsPhrase(following, tool) ||
        catalog.synonyms.some(
          (row) =>
            row.category === 'tool' &&
            row.target === tool &&
            containsPhrase(following, row.alias),
        ),
    );
    if (
      !['use', 'using', 'install', 'with', 'switching', 'switch'].includes(
        toolWords[start + 1],
      ) &&
      !namesTool
    )
      continue;
    for (let end = start; end < toolWords.length; end++) {
      if (['\u0000', 'but', 'however', 'instead'].includes(toolWords[end]))
        break;
      exclusions.add(end);
    }
  }
  const excluded = toolWords
    .filter((_, index) => exclusions.has(index))
    .flatMap(languageTokens);
  const aliasesFor = (tool: string) => [
    tool,
    ...catalog.synonyms
      .filter((row) => row.category === 'tool' && row.target === tool)
      .map((row) => row.alias),
    ...(/^(?:Microsoft|Adobe|Google|Apple) /.test(tool)
      ? [tool.replace(/^(?:Microsoft|Adobe|Google|Apple) /, '')]
      : []),
  ];
  const excludedTools = catalog.tools.filter((tool) =>
    aliasesFor(tool).some((alias) => containsPhrase(excluded, alias)),
  );
  const positiveToolWords = toolPolarity.positiveWords.flatMap(languageTokens);
  const mentionedTools = catalog.tools.filter((tool) =>
    aliasesFor(tool).some((alias) => containsPhrase(positiveToolWords, alias)),
  );
  const toolMentions = (tool: string) =>
    aliasesFor(tool).flatMap((alias) => {
      const parts = languageTokens(alias);
      return positiveToolWords.flatMap((_, start) =>
        parts.every(
          (part, offset) => positiveToolWords[start + offset] === part,
        )
          ? [{ start, end: start + parts.length }]
          : [],
      );
    });
  const tools = [...new Set([...current.tools, ...mentionedTools])].filter(
    (tool) =>
      !excludedTools.includes(tool) &&
      // Bare forms/slides are artifacts, not evidence of a Google application.
      (!['Google Forms', 'Google Slides', 'Google Sheets'].includes(tool) ||
        containsPhrase(positiveToolWords, tool) ||
        new RegExp(`\\b(?:in|with|using) ${tool.split(' ').at(-1)}\\b`).test(
          prompt,
        )) &&
      // Prefer a named product over a shorter product name inside it.
      (!mentionedTools.includes(tool) ||
        !toolMentions(tool).every((span) =>
          mentionedTools.some(
            (specific) =>
              specific.startsWith(`${tool} `) &&
              toolMentions(specific).some(
                (outer) => outer.start <= span.start && outer.end >= span.end,
              ),
          ),
        )) &&
      (tool !== 'Microsoft Word' ||
        /\b(?:Microsoft Word|(?:in|with|using) Word|Word (?:record|document|file|minutes))\b/.test(
          prompt,
        )),
  );
  const requiredTool = requiredPlatform(prompt);
  const language = /\b(spanish|french|mandarin|german|arabic|english)\b/i
    .exec(prompt)?.[1]
    .toLowerCase();
  // A generic route requires an explicit canonical task or a multiword catalog alias.
  // Incidental nouns and keyword-only similarities cannot bypass compatibility.
  const declared = current.tasks.filter(
    (task) =>
      has(task) ||
      catalog.synonyms.some(
        (row) =>
          row.category === 'task' &&
          row.target === task &&
          languageTokens(row.alias).length >= 2 &&
          has(row.alias),
      ),
  );
  const operation: OperationRule | undefined =
    recognized ??
    (declared.length
      ? {
          id: 'catalog-task',
          when: [],
          tasks: declared,
          source:
            current.sourceMaterials.length === 1
              ? current.sourceMaterials[0]
              : undefined,
          outputs: current.desiredOutputs,
          candidates: declared.map((task) => ({
            tasks: [task],
            priority: 100,
            requireSourceMatch: true,
            requireOutputMatch: true,
            minimumStrength: current.learningFormats.some(
              (f) => f === 'explainer' || f === 'presentation',
            )
              ? 0.5
              : 0.75,
          })),
        }
      : undefined);
  const interpretation: PromptInterpretation = operation
    ? {
        ...current,
        tasks: operation.tasks.filter((task) => catalog.tasks.includes(task)),
        sourceMaterials: operation.clearSource
          ? []
          : operation.source
            ? [operation.source]
            : current.sourceMaterials,
        desiredOutputs: operation.outputs.filter(
          (output) =>
            !operation.outputWhen?.[output] ||
            operation.outputWhen[output].some(has),
        ),
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
    constraints: capabilityConstraints.filter((rule) =>
      rule.when.every((group) => group.some(has)),
    ),
  };
}
