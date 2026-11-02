import { toCatalogItem } from '../contracts/catalogItem';
import { normalizeTerm } from '../contracts/publicCatalog';
import type {
  PublicCatalog,
  PublicCatalogItem,
  TagCategory,
} from '../contracts/publicCatalog';
import type { RankedMatch } from '../contracts/rankedMatch';
import { prepareWorkflows, compatibleTask } from './workflow';
import { promptPolarity } from './promptPolarity';
import { preparePromptFit } from './promptFit';
import type { WorkflowConfig, WorkflowMatch } from './workflow';
import { prepareLearningFormats } from './learningFormat';
import type {
  LearningFormat,
  LearningFormatConfig,
  LearningFormatEvidence,
} from './learningFormat';
import {
  naturalTaskMentions,
  promptWords,
  languageWord,
  type PromptLanguage,
  type TaskIntentMention,
} from './promptLanguage';

export interface PromptRequest {
  prompt: string;
  functionArea?: string | null;
  tools?: readonly string[];
  limit?: number;
  learningFormat?: LearningFormat;
}

export interface PromptInterpretation {
  tasks: string[];
  taskPreferences: string[];
  tools: string[];
  functionAreas: string[];
  keywords: string[];
  excludedTasks: string[];
  excludedTools: string[];
  sourceMaterials: string[];
  desiredOutputs: string[];
  intermediateMaterials: string[];
  supportingMaterials: string[];
  learningFormats: LearningFormat[];
}

export type InstructionForm =
  'demonstrated' | 'walkthrough' | 'explained' | 'mentioned';

export interface TaskInstruction {
  youtubeId: string;
  task: string;
  form: InstructionForm;
}

export interface PromptOptions {
  // Experimental reviewed metadata, separate from the public serving contract.
  instructions?: readonly TaskInstruction[];
  workflows?: WorkflowConfig;
  learningFormats?: LearningFormatConfig;
  language?: PromptLanguage;
}

export interface PromptEvidence {
  kind:
    'workflow' | 'task' | 'keyword' | 'tool' | 'area' | 'format' | 'start-here';
  workflow?: WorkflowMatch;
  learningFormat: LearningFormatEvidence;
  matchedTasks: string[];
  matchedTools: string[];
  relatedTools: string[];
  matchedKeywords: string[];
  taskCoverage: number;
  keywordScore: number;
  instructionScore: number;
  instructions: { task: string; form: InstructionForm }[];
  areaMatch: boolean;
}

export interface PromptRecommendation extends RankedMatch {
  evidence: PromptEvidence;
}

export interface PromptResult {
  interpretation: PromptInterpretation;
  recommendations: PromptRecommendation[];
  warnings: string[];
}

const MAX_PROMPT_LENGTH = 500;
const CATEGORY_KEYS = {
  task: 'tasks',
  tool: 'tools',
  functionArea: 'functionAreas',
} as const;

// Language mechanics only. Domain vocabulary comes from the catalog snapshot.
const STOP_WORDS = new Set(
  `a an and are as at be been but by can could do does for from get had has have
   help how i if in into is it its learn learning me my need not no of on or our
   please should so some that the their them there these they this to turn us
   want was we what when where which who will with without would you your
   ai video videos already first draft make create build using use only avoid
   exclude excluding about like just one new ask back next thing something
   way really yet any also actually doing somewhere then other same bunch
   don t m ve d s ll won didn isn tell find point put could little
   work working someone people keep small before after start staff team lesson
   year all three five every last short long few main watch got while re tool tools
   own end automatically page write writing send sending need needs`.split(
    /\s+/,
  ),
);

interface VocabularyEntry {
  category: TagCategory;
  target: string;
  tokens: string[];
  isAlias?: boolean;
}

interface Mention extends VocabularyEntry, TaskIntentMention {
  start: number;
  end: number;
  excluded: boolean;
}

function ordinal(a: string, b: string): number {
  return a === b ? 0 : a < b ? -1 : 1;
}

function tokens(text: string): string[] {
  return normalizeTerm(text.normalize('NFKC')).split(' ').filter(Boolean);
}

function wordKey(word: string): string {
  return languageWord(word);
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort(ordinal);
}

function vocabulary(catalog: PublicCatalog): VocabularyEntry[] {
  const entries: VocabularyEntry[] = [];
  for (const category of ['task', 'tool', 'functionArea'] as const) {
    for (const target of catalog[CATEGORY_KEYS[category]]) {
      entries.push({ category, target, tokens: tokens(target) });
    }
  }
  for (const mapping of catalog.synonyms) {
    if (catalog[CATEGORY_KEYS[mapping.category]].includes(mapping.target)) {
      entries.push({
        ...mapping,
        tokens: tokens(mapping.alias),
        isAlias: true,
      });
    }
  }
  return entries.sort(
    (a, b) =>
      b.tokens.length - a.tokens.length ||
      ordinal(a.target, b.target) ||
      ordinal(a.tokens.join(' '), b.tokens.join(' ')),
  );
}

function mentions(words: string[], entries: VocabularyEntry[]): Mention[] {
  const polarity = promptPolarity(words);
  const occupied = {
    task: new Set<number>(),
    tool: new Set<number>(),
    functionArea: new Set<number>(),
  };
  const found: Mention[] = [];
  // Long phrases claim their spans before shorter aliases in the same category.
  for (const entry of entries) {
    for (
      let start = 0;
      start <= words.length - entry.tokens.length;
      start += 1
    ) {
      const end = start + entry.tokens.length;
      if (!entry.tokens.every((word, offset) => word === words[start + offset]))
        continue;
      if (
        entry.category === 'tool' &&
        entry.isAlias &&
        entry.tokens.join(' ') === 'word' &&
        (words[start + 1] === 'for' ||
          words[start - 1] === 'for' ||
          /^\d+$/.test(words[start - 1] ?? ''))
      )
        continue;
      if (
        words
          .slice(start, end)
          .some((_, offset) => occupied[entry.category].has(start + offset))
      )
        continue;
      for (let index = start; index < end; index += 1)
        occupied[entry.category].add(index);
      found.push({
        ...entry,
        start,
        end,
        excluded: polarity.isExcluded(start, end),
      });
    }
  }
  return found;
}

export function interpretPrompt(
  catalog: PublicCatalog,
  request: PromptRequest,
  options: PromptOptions,
) {
  const words = promptWords(request.prompt);
  const polarity = promptPolarity(words);
  const learningFormats = prepareLearningFormats(
    catalog,
    options.learningFormats,
    words,
    request.learningFormat,
  );
  const excludedMentions = [
    ...mentions(words, vocabulary(catalog)),
    ...naturalTaskMentions(catalog, options.language, words).map((mention) => ({
      ...mention,
      category: 'task' as const,
      tokens: [],
      excluded: polarity.isExcluded(mention.start, mention.end),
    })),
  ].filter((mention) => mention.excluded);
  const lexicalMentions = mentions(
    learningFormats.maskedWords,
    vocabulary(catalog),
  ).filter((mention) => {
    if (
      mention.category !== 'tool' ||
      !mention.isAlias ||
      mention.tokens.length !== 1 ||
      words[mention.start - 1] !== 'a' ||
      !['and', 'plus'].includes(words[mention.end])
    )
      return true;
    return !(options.language?.artifacts ?? []).some(
      (rule) =>
        rule.aliases.some(
          (alias) => tokens(alias).join(' ') === mention.tokens.join(' '),
        ) &&
        (!rule.context?.length ||
          rule.context.some((context) =>
            words.join(' ').includes(tokens(context).join(' ')),
          )),
    );
  });
  const rawMentions: Mention[] = [
    ...excludedMentions,
    ...lexicalMentions,
    ...naturalTaskMentions(
      catalog,
      options.language,
      learningFormats.maskedWords,
      lexicalMentions.filter((mention) => mention.category === 'tool'),
    ).map((mention) => ({
      ...mention,
      category: 'task' as const,
      tokens: [],
      excluded: false,
    })),
  ];
  const workflows = prepareWorkflows(
    catalog,
    options.workflows,
    learningFormats.maskedWords,
    rawMentions.filter(
      (mention) => mention.category === 'task' && !mention.excluded,
    ),
    learningFormats.workflowIntent,
    options.language,
    rawMentions.filter((mention) => mention.category === 'tool'),
    [
      ...rawMentions
        .filter((mention) => mention.category === 'tool' && !mention.excluded)
        .map((mention) => mention.target),
      ...(request.tools ?? []),
    ],
  );
  const found = rawMentions.filter(
    (mention) =>
      mention.category !== 'task' ||
      mention.excluded ||
      (!workflows.isSourceTask(mention) &&
        !workflows.isSuppressedTask(mention.target)),
  );
  const positive = (category: TagCategory) =>
    unique(
      found
        .filter((m) => m.category === category && !m.excluded && !m.preference)
        .map((m) => m.target),
    );
  const negative = (category: TagCategory) =>
    unique(
      found
        .filter((m) => m.category === category && m.excluded)
        .map((m) => m.target),
    );
  const excludedTasks = negative('task').filter(
    (task) => !positive('task').includes(task),
  );
  const excludedTools = negative('tool');
  const consumed = new Set<number>([
    ...workflows.consumed,
    ...learningFormats.consumed,
  ]);
  for (const mention of found) {
    for (let index = mention.start; index < mention.end; index += 1)
      consumed.add(index);
  }
  const interpretation: PromptInterpretation = {
    tasks: positive('task').filter((task) => !excludedTasks.includes(task)),
    taskPreferences: unique(
      found
        .filter((m) => m.category === 'task' && m.preference && !m.excluded)
        .map((m) => m.target),
    ),
    tools: unique([
      ...positive('tool'),
      ...(request.tools ?? []).filter((tool) => catalog.tools.includes(tool)),
    ]).filter((tool) => !excludedTools.includes(tool)),
    functionAreas: unique([
      ...positive('functionArea'),
      ...(request.functionArea &&
      catalog.functionAreas.includes(request.functionArea)
        ? [request.functionArea]
        : []),
    ]),
    keywords: unique(
      words
        .filter(
          (word, index) =>
            word &&
            /^[a-z0-9]+$/.test(word) &&
            !polarity.excluded.has(index) &&
            !consumed.has(index) &&
            !STOP_WORDS.has(word),
        )
        .map(wordKey),
    ),
    excludedTasks,
    excludedTools,
    sourceMaterials: workflows.sourceTypes,
    desiredOutputs: workflows.outputTypes,
    intermediateMaterials: workflows.intermediateTypes,
    supportingMaterials: workflows.supportingTypes,
    learningFormats: learningFormats.requested,
  };
  const unsupportedOnlyTool = found.some(
    (m) =>
      m.category === 'tool' &&
      !m.excluded &&
      ((words[m.start - 1] === 'only' && words[m.start - 2] !== 'not') ||
        words[m.end] === 'only'),
  );
  return { interpretation, unsupportedOnlyTool, workflows, learningFormats };
}

function keywordFields(item: PublicCatalogItem): Set<string>[] {
  return [item.title, item.tasks.join(' '), item.description].map(
    (text) => new Set(tokens(text).map(wordKey)),
  );
}

const GROUP_ORDER: Record<PromptEvidence['kind'], number> = {
  workflow: -1,
  task: 0,
  keyword: 1,
  tool: 2,
  area: 3,
  format: 4,
  'start-here': 5,
};

const INSTRUCTION_STRENGTH: Record<InstructionForm, number> = {
  demonstrated: 1,
  walkthrough: 0.75,
  explained: 0.5,
  mentioned: 0,
};

/** Internal shared validation for reviewed task evidence. */
export function prepareInstructions(
  catalog: PublicCatalog,
  entries: readonly TaskInstruction[] = [],
) {
  const instructions = new Map<string, InstructionForm>();
  for (const entry of entries) {
    const key = JSON.stringify([entry.youtubeId, entry.task]);
    if (
      instructions.has(key) ||
      !Object.hasOwn(INSTRUCTION_STRENGTH, entry.form) ||
      !catalog.items.some(
        (item) =>
          item.youtubeId === entry.youtubeId && item.tasks.includes(entry.task),
      )
    ) {
      throw new Error('Invalid or duplicate task instruction evidence.');
    }
    instructions.set(key, entry.form);
  }
  return instructions;
}

function compare(a: PromptRecommendation, b: PromptRecommendation): number {
  const x = a.evidence;
  const y = b.evidence;
  return (
    (x.workflow?.priority ?? 4) - (y.workflow?.priority ?? 4) ||
    (x.workflow?.supportOrder ?? 0) - (y.workflow?.supportOrder ?? 0) ||
    GROUP_ORDER[x.kind] - GROUP_ORDER[y.kind] ||
    y.taskCoverage - x.taskCoverage ||
    (x.kind === 'keyword' ? y.keywordScore - x.keywordScore : 0) ||
    y.learningFormat.affinity - x.learningFormat.affinity ||
    (x.kind === 'workflow' && y.kind === 'workflow'
      ? y.keywordScore - x.keywordScore
      : 0) ||
    y.instructionScore - x.instructionScore ||
    Number(y.matchedTools.length > 0) - Number(x.matchedTools.length > 0) ||
    Number(y.relatedTools.length > 0) - Number(x.relatedTools.length > 0) ||
    Number(y.areaMatch) - Number(x.areaMatch) ||
    y.keywordScore - x.keywordScore ||
    ordinal(b.item.addedAt ?? '', a.item.addedAt ?? '') ||
    ordinal(a.item.youtubeId, b.item.youtubeId)
  );
}

function reasonFor(evidence: PromptEvidence): string {
  const tools = evidence.matchedTools.length
    ? `; catalog tools: ${evidence.matchedTools.join(', ')}`
    : '';
  if (evidence.workflow) {
    const flow = evidence.workflow;
    const pair = `${flow.sourceLabel} → ${flow.outputLabel}`;
    if (flow.supportingTask)
      return `Supporting ${flow.supportingTask} step: ${pair}. This covers part of the request, using the example's catalog tools.`;
    if (flow.taskCompatibility === 'related')
      return `Related task (${flow.task}): ${pair}.`;
    if (flow.relation === 'preparation') return `Preparation step: ${pair}.`;
    if (flow.relation === 'alternative-source')
      return `Alternative starting material: ${pair}.`;
    if (flow.relation === 'output-review')
      return `Prepared-output review: ${pair}.`;
    return flow.sourceSpecified
      ? `Matches workflow: ${pair}.`
      : `Produces ${flow.outputLabel}; example starts with ${flow.sourceLabel}.`;
  }
  if (evidence.kind === 'task')
    return `Matches ${evidence.matchedTasks.join(', ')}${tools}.`;
  if (evidence.kind === 'keyword')
    return `Keyword match: ${evidence.matchedKeywords.join(', ')}.`;
  if (evidence.kind === 'tool')
    return evidence.matchedTools.length
      ? `Browse videos tagged ${evidence.matchedTools.join(', ')}.`
      : `Related tool: ${evidence.relatedTools.join(', ')}.`;
  if (evidence.kind === 'area') return 'Browse videos in your function area.';
  if (evidence.kind === 'format')
    return `Browse ${evidence.learningFormat.requested.join(' or ')} videos; no topic specified.`;
  return 'A place to start; no direct task match.';
}

/** Pure draft matcher. Callers supply a validated catalog; no prompts leave memory. */
export function recommendFromPrompt(
  catalog: PublicCatalog,
  request: PromptRequest,
  options: PromptOptions = {},
): PromptResult {
  if (request.prompt.length > MAX_PROMPT_LENGTH)
    throw new RangeError('Prompt must be 500 characters or fewer.');
  const limit = request.limit ?? 3;
  if (!Number.isInteger(limit) || limit < 0)
    throw new RangeError('Result limit must be a nonnegative integer.');
  const { interpretation, unsupportedOnlyTool, workflows, learningFormats } =
    interpretPrompt(catalog, request, options);
  const fit = preparePromptFit(
    catalog,
    promptPolarity(promptWords(request.prompt)).positiveWords,
    interpretation.tasks,
    options.language,
    {
      instructionForm: (id, task) =>
        options.instructions?.find(
          (row) => row.youtubeId === id && row.task === task,
        )?.form,
      learningFormat: (id) =>
        options.learningFormats?.videos.find((row) => row.youtubeId === id)
          ?.primary,
      artifactIds: options.workflows?.artifacts.map((row) => row.id),
      requestedOutputs: interpretation.desiredOutputs,
    },
  );
  if (fit.warnings.length)
    return { interpretation, recommendations: [], warnings: fit.warnings };
  if (unsupportedOnlyTool)
    return {
      interpretation,
      recommendations: [],
      warnings: [
        "This draft cannot verify tool-only workflows from the catalog's flat tool tags.",
      ],
    };

  const counts = new Map<string, number>();
  const instructions = prepareInstructions(catalog, options.instructions);
  for (const item of catalog.items)
    counts.set(item.youtubeId, (counts.get(item.youtubeId) ?? 0) + 1);
  const active = catalog.items.filter(
    (item) => item.status === 'active' && counts.get(item.youtubeId) === 1,
  );
  const fields = new Map(
    active.map((item) => [item.youtubeId, keywordFields(item)]),
  );
  const idf = new Map(
    interpretation.keywords.map((word) => {
      const frequency = active.filter((item) =>
        fields.get(item.youtubeId)!.some((field) => field.has(word)),
      ).length;
      return [
        word,
        Math.log(1 + (active.length - frequency + 0.5) / (frequency + 0.5)),
      ];
    }),
  );
  const matches: PromptRecommendation[] = [];
  for (const item of active) {
    if (
      item.tasks.some((task) => interpretation.excludedTasks.includes(task)) ||
      item.tools.some((tool) => interpretation.excludedTools.includes(tool))
    )
      continue;
    if (!fit.allows(item)) continue;
    const workflow = workflows.match(
      item.youtubeId,
      (task, requireProcedure) => {
        const form = instructions.get(JSON.stringify([item.youtubeId, task]));
        return requireProcedure
          ? form === 'demonstrated' || form === 'walkthrough'
          : form !== 'mentioned';
      },
      fit.allowsWorkflow,
    );
    if (
      workflows.hasOutput &&
      workflows.hasEvidence(item.youtubeId) &&
      !workflow
    )
      continue;
    const matchedTasks = interpretation.tasks.filter(
      (task) =>
        item.tasks.includes(task) &&
        instructions.get(JSON.stringify([item.youtubeId, task])) !==
          'mentioned',
    );
    const matchedInstructions = unique([
      ...matchedTasks,
      ...(workflow ? [workflow.task] : []),
    ]).flatMap((task) => {
      const form = instructions.get(JSON.stringify([item.youtubeId, task]));
      return form ? [{ task, form }] : [];
    });
    const matchedTools = interpretation.tools.filter((tool) =>
      item.tools.includes(tool),
    );
    const relatedTools = unique(
      catalog.adjacentTools
        .filter(
          (mapping) =>
            interpretation.tools.includes(mapping.source) &&
            item.tools.includes(mapping.related) &&
            matchedTasks.includes(mapping.task),
        )
        .map((mapping) => mapping.related),
    );
    const itemFields = fields.get(item.youtubeId)!;
    const matchedKeywords = interpretation.keywords.filter((word) =>
      itemFields.some((field) => field.has(word)),
    );
    const keywordScore = matchedKeywords.reduce((sum, word) => {
      const fieldIndex = itemFields.findIndex((field) => field.has(word));
      return sum + [4, 3, 2][fieldIndex] * idf.get(word)!;
    }, 0);
    const topicKeywords = interpretation.keywords.filter(
      (word) =>
        (active.length < 10 || (idf.get(word) ?? 0) >= 1) && word.length >= 3,
    );
    const matchedTopic = matchedKeywords.filter((word) =>
      topicKeywords.includes(word),
    );
    const anchored = matchedTopic.some(
      (word) => itemFields[0].has(word) || itemFields[1].has(word),
    );
    const rareAnchor = matchedTopic.some(
      (word) =>
        (idf.get(word) ?? 0) >= 2.5 &&
        (itemFields[0].has(word) || itemFields[1].has(word)),
    );
    const lexicalFit =
      (rareAnchor &&
        matchedTopic.length >= 2 &&
        matchedTopic.length / Math.max(1, topicKeywords.length) >= 0.2) ||
      (topicKeywords.length === 1
        ? matchedTopic.length === 1 && itemFields[0].has(matchedTopic[0])
        : ((matchedTopic.length >= 2 && anchored) ||
            matchedTopic.length >= 3) &&
          (active.length < 10 ||
            (keywordScore >= 10 &&
              matchedTopic.length / Math.max(1, topicKeywords.length) >= 0.2)));
    const hasCompatibleTask =
      matchedTasks.length > 0 ||
      workflow?.taskCompatibility === 'related' ||
      (workflow &&
        interpretation.tasks.some((task) =>
          compatibleTask(task, workflow.task),
        ));
    if (
      !hasCompatibleTask &&
      interpretation.tools.length &&
      !matchedTools.length &&
      !relatedTools.length
    )
      continue;
    const preparation = workflow?.relation === 'preparation';
    if (interpretation.tasks.length && !hasCompatibleTask && !preparation)
      continue;
    // Without a recognized task, a workflow must also have topic evidence.
    const supportedWorkflow =
      workflow &&
      (hasCompatibleTask ||
        preparation ||
        lexicalFit ||
        (workflow.sourceMatch && interpretation.keywords.length === 0));
    const areaMatch = interpretation.functionAreas.some((area) =>
      item.functionAreas.includes(area),
    );
    const learningFormat = learningFormats.evidence(item.youtubeId);
    const formatOnly =
      !learningFormats.topicSpecified &&
      !interpretation.tasks.length &&
      !interpretation.keywords.length &&
      !interpretation.tools.length &&
      !interpretation.functionAreas.length &&
      !interpretation.sourceMaterials.length &&
      !interpretation.desiredOutputs.length;
    const browseOnly =
      !interpretation.tasks.length &&
      !interpretation.keywords.length &&
      !interpretation.sourceMaterials.length &&
      !interpretation.desiredOutputs.length;
    const kind = supportedWorkflow
      ? 'workflow'
      : matchedTasks.length
        ? 'task'
        : lexicalFit
          ? 'keyword'
          : browseOnly && (matchedTools.length || relatedTools.length)
            ? 'tool'
            : browseOnly && areaMatch
              ? 'area'
              : formatOnly && learningFormat.affinity > 0
                ? 'format'
                : undefined;
    if (!kind) continue;
    const evidence: PromptEvidence = {
      kind,
      learningFormat,
      ...(supportedWorkflow ? { workflow } : {}),
      matchedTasks,
      matchedTools,
      relatedTools,
      matchedKeywords,
      taskCoverage: interpretation.tasks.length
        ? matchedTasks.length / interpretation.tasks.length
        : 0,
      keywordScore,
      areaMatch,
      instructions: matchedInstructions,
      instructionScore: matchedInstructions.length
        ? matchedInstructions.reduce(
            (sum, entry) => sum + INSTRUCTION_STRENGTH[entry.form],
            0,
          ) / matchedInstructions.length
        : 0,
    };
    matches.push({
      item: toCatalogItem(item),
      evidence,
      reason: reasonFor(evidence),
      matchType: supportedWorkflow
        ? workflow.relation === 'source-to-output' &&
          workflow.taskCompatibility !== 'related'
          ? 'strong'
          : 'fallback'
        : kind === 'task'
          ? 'strong'
          : 'fallback',
    });
  }
  if (
    !matches.length &&
    !interpretation.tasks.length &&
    !interpretation.keywords.length &&
    !interpretation.sourceMaterials.length &&
    !interpretation.desiredOutputs.length
  ) {
    for (const item of active.filter(
      (item) =>
        item.startHere &&
        fit.allows(item) &&
        !item.tasks.some((task) =>
          interpretation.excludedTasks.includes(task),
        ) &&
        !item.tools.some((tool) => interpretation.excludedTools.includes(tool)),
    )) {
      const evidence: PromptEvidence = {
        kind: 'start-here',
        learningFormat: learningFormats.evidence(item.youtubeId),
        matchedTasks: [],
        matchedTools: [],
        relatedTools: [],
        matchedKeywords: [],
        taskCoverage: 0,
        keywordScore: 0,
        instructionScore: 0,
        instructions: [],
        areaMatch: false,
      };
      matches.push({
        item: toCatalogItem(item),
        evidence,
        reason: reasonFor(evidence),
        matchType: 'fallback',
      });
    }
  }
  const warnings =
    interpretation.tasks.length &&
    !matches.some(
      (match) =>
        match.evidence.kind === 'task' || match.evidence.kind === 'workflow',
    )
      ? [
          'No eligible video matches the recognized task. Suggestions are labeled separately.',
        ]
      : [];
  if (!matches.length && !warnings.length)
    warnings.push(
      'No sufficiently supported match was found. Try naming the task, starting material or desired result.',
    );
  if (
    interpretation.sourceMaterials.length &&
    interpretation.desiredOutputs.length &&
    !matches.some(
      (match) => match.evidence.workflow?.relation === 'source-to-output',
    )
  ) {
    warnings.push(
      'No reviewed creation workflow matches both the source material and desired output. Related steps and different starting materials are labeled separately.',
    );
  }
  return {
    interpretation,
    recommendations: matches
      .sort(compare)
      .filter(
        (match, index, all) =>
          match.evidence.kind !== 'keyword' ||
          all
            .slice(0, index)
            .filter((previous) => previous.evidence.kind === 'keyword').length <
            3,
      )
      .slice(0, limit),
    warnings,
  };
}
