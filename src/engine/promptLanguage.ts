import { normalizeTerm, type PublicCatalog } from '../contracts/publicCatalog';

export interface NaturalTaskRule {
  task: string;
  phrases: string[];
  context?: string[];
  contextAll?: string[][];
  unlessContext?: string[];
  outputs?: string[];
  implicitSource?: string;
  contextWindow?: number;
  contextDirection?: 'before' | 'after';
  implicitSourceAlongside?: boolean;
  procedural?: boolean;
  actionOnly?: boolean;
  preference?: boolean;
}

export interface ArtifactLanguage {
  artifact: string;
  aliases: string[];
  inputVerbs?: string[];
  context?: string[];
  supportingWhenTasks?: string[];
}

export interface PromptLanguage {
  tasks: readonly NaturalTaskRule[];
  artifacts: readonly ArtifactLanguage[];
  taskSupports?: readonly {
    requestedTask: string;
    taughtTask: string;
    outputs: string[];
    requiresPreference?: boolean;
    requiresToolMatch?: boolean;
    requiresRequestedOutput?: boolean;
    requiresSourceMatch?: boolean;
    requiresTasks?: string[];
    teachingAny?: string[];
    contextAll?: string[][];
  }[];
  candidateConstraints?: readonly {
    whenTasks?: string[];
    contextAll?: string[][];
    unlessContext?: string[];
    excludeTasks?: string[];
    teachingAny?: string[];
    requireTools?: string[];
    proceduralTasks?: string[];
    requireFormats?: ('demo' | 'walkthrough' | 'presentation' | 'explainer')[];
    anyTasks?: string[];
    generalTasksOnly?: string[];
    unlessOutputs?: string[];
  }[];
  workflowConstraints?: readonly {
    task: string;
    contextAll: string[][];
    unlessContext?: string[];
    allowedSources?: string[];
    teachingAny?: string[];
    requireProcedure?: boolean;
  }[];
  unsupportedIntents?: readonly {
    contextAll: string[][];
    unlessContext?: string[];
    message: string;
  }[];
  refinements?: readonly {
    task: string;
    whenAll: string[];
    unlessAny?: string[];
    implicitOnly?: boolean;
    retainOutputs?: boolean;
  }[];
}

const VERB_FORMS: Record<string, string> = {
  creating: 'create',
  created: 'create',
  asking: 'ask',
  reusing: 'reuse',
  generates: 'generate',
  generating: 'generate',
  generated: 'generate',
  writing: 'write',
  written: 'write',
  writes: 'write',
  drafting: 'draft',
  drafted: 'draft',
  building: 'build',
  built: 'build',
  configuring: 'configure',
  configured: 'configure',
  comparing: 'compare',
  compared: 'compare',
  summarizing: 'summarize',
  summarising: 'summarize',
  summarize: 'summarize',
  summarise: 'summarize',
  analyzing: 'analyze',
  analysing: 'analyze',
  analysed: 'analyze',
  analyzed: 'analyze',
  analyse: 'analyze',
  editing: 'edit',
  edited: 'edit',
  proofreading: 'proofread',
  debugging: 'debug',
  planning: 'plan',
  planned: 'plan',
  organizing: 'organize',
  organised: 'organize',
  reviewing: 'review',
  reviewed: 'review',
  translating: 'translate',
  translated: 'translate',
  adapting: 'adapt',
  adapted: 'adapt',
  refining: 'refine',
  refined: 'refine',
  practising: 'practice',
  practicing: 'practice',
  rehearsing: 'rehearse',
  improving: 'improve',
  improved: 'improve',
  identifying: 'identify',
  consolidating: 'consolidate',
  automating: 'automate',
  turning: 'turn',
  converting: 'convert',
  repurposing: 'repurpose',
  producing: 'produce',
  produced: 'produce',
  explaining: 'explain',
};

export function languageWord(word: string): string {
  if (VERB_FORMS[word]) return VERB_FORMS[word];
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  return word.length > 3 && word.endsWith('s') && !/(ss|is|us)$/.test(word)
    ? word.slice(0, -1)
    : word;
}

export function languageTokens(text: string): string[] {
  return normalizeTerm(text.normalize('NFKC'))
    .split(' ')
    .filter(Boolean)
    .map(languageWord);
}

/** Preserve sentence scope without changing token offsets inside each sentence. */
export function promptWords(text: string): string[] {
  return text
    .replace(/[’']/g, "'")
    .replace(/\b(i|we|you|they)'d\b/gi, '$1 would')
    .replace(
      /\b(can|could|do|does|did|is|are|was|were|should|would|must|has|have|had)n't\b/gi,
      '$1 not',
    )
    .replace(/\bwon't\b/gi, 'will not')
    .replace(/\bcan't\b/gi, 'can not')
    .split(/[.!?;]+(?:\s+|$)/)
    .flatMap((sentence, index) => [
      ...(index ? ['\u0000'] : []),
      ...sentence
        .split(/[,—]+/)
        .flatMap((clause, clauseIndex) => [
          ...(clauseIndex ? ['\u0001'] : []),
          ...normalizeTerm(clause.normalize('NFKC')).split(' ').filter(Boolean),
        ]),
    ]);
}

export interface TaskIntentMention {
  target: string;
  start: number;
  end: number;
  outputs?: string[];
  implicitSource?: string;
  contextSpans?: { start: number; end: number }[];
  natural?: boolean;
  implicitSourceAlongside?: boolean;
  procedural?: boolean;
  preference?: boolean;
}

export function naturalTaskMentions(
  catalog: PublicCatalog,
  language: PromptLanguage | undefined,
  words: string[],
  blockedSpans: { start: number; end: number }[] = [],
): TaskIntentMention[] {
  const normalized = words.map(languageWord);
  const found: TaskIntentMention[] = [];
  const ruleKeys = new Set<string>();
  for (const refinement of language?.refinements ?? []) {
    if (
      !refinement.whenAll.length ||
      [
        refinement.task,
        ...refinement.whenAll,
        ...(refinement.unlessAny ?? []),
      ].some((task) => !catalog.tasks.includes(task))
    )
      throw new Error('Invalid task refinement.');
  }
  for (const rule of language?.tasks ?? []) {
    const key = JSON.stringify([
      rule.task,
      [...rule.phrases].sort(),
      [...(rule.context ?? [])].sort(),
      [...(rule.unlessContext ?? [])].sort(),
      (rule.contextAll ?? []).map((group) => [...group].sort()).sort(),
    ]);
    if (
      !catalog.tasks.includes(rule.task) ||
      !rule.phrases.length ||
      rule.phrases.some((phrase) => !languageTokens(phrase).length) ||
      (rule.context ?? []).some((phrase) => !languageTokens(phrase).length) ||
      (rule.unlessContext ?? []).some(
        (phrase) => !languageTokens(phrase).length,
      ) ||
      (rule.contextAll ?? []).some(
        (group) =>
          !group.length ||
          group.some((phrase) => !languageTokens(phrase).length),
      ) ||
      (rule.preference &&
        ((rule.outputs?.length ?? 0) > 0 ||
          rule.implicitSource !== undefined)) ||
      (rule.contextWindow !== undefined &&
        (!Number.isInteger(rule.contextWindow) || rule.contextWindow < 0)) ||
      (rule.contextDirection !== undefined &&
        !['before', 'after'].includes(rule.contextDirection)) ||
      (rule.implicitSourceAlongside && !rule.implicitSource) ||
      ruleKeys.has(key)
    )
      throw new Error('Invalid or duplicate natural task rule.');
    ruleKeys.add(key);
    const contains = (phrase: string) => {
      const parts = languageTokens(phrase);
      if (!parts.length) throw new Error('Empty natural task phrase.');
      return normalized.some((_, start) =>
        parts.every((part, offset) => normalized[start + offset] === part),
      );
    };
    if (rule.context?.length && !rule.context.some(contains)) continue;
    if (rule.unlessContext?.some(contains)) continue;
    if ((rule.contextAll ?? []).some((group) => !group.some(contains)))
      continue;
    for (const phrase of rule.phrases) {
      const parts = languageTokens(phrase);
      if (!parts.length) throw new Error('Empty natural task phrase.');
      for (
        let start = 0;
        start <= normalized.length - parts.length;
        start += 1
      ) {
        if (!parts.every((part, offset) => normalized[start + offset] === part))
          continue;
        if (
          rule.actionOnly &&
          /(?:ed|en)$/.test(words[start]) &&
          !['to', 'will', 'can', 'should'].includes(words[start - 1])
        )
          continue;
        if (
          blockedSpans.some(
            (span) => span.start <= start && span.end >= start + parts.length,
          )
        )
          continue;
        if (
          rule.contextWindow !== undefined &&
          rule.context?.length &&
          !rule.context.some((context) => {
            const parts = languageTokens(context);
            const from = Math.max(0, start - rule.contextWindow!);
            const to = Math.min(
              normalized.length,
              start + parts.length + rule.contextWindow!,
            );
            return normalized
              .slice(from, to)
              .some((_, offset) =>
                parts.every(
                  (part, index) => normalized[from + offset + index] === part,
                ),
              );
          })
        )
          continue;
        const contextSpans = (rule.context ?? []).flatMap((context) => {
          const parts = languageTokens(context);
          return normalized.flatMap((_, contextStart) =>
            parts.every(
              (part, offset) => normalized[contextStart + offset] === part,
            ) &&
            (rule.contextWindow === undefined ||
              !normalized
                .slice(
                  Math.min(start + parts.length, contextStart + parts.length),
                  Math.max(start, contextStart),
                )
                .some((word) => word === '\u0000' || word === '\u0001'))
              ? [{ start: contextStart, end: contextStart + parts.length }]
              : [],
          );
        });
        if (
          rule.contextWindow !== undefined &&
          rule.context?.length &&
          !contextSpans.length
        )
          continue;
        if (
          rule.contextDirection &&
          !contextSpans.some(
            (span) =>
              (rule.contextDirection === 'before'
                ? span.end <= start
                : span.start >= start + parts.length) &&
              (rule.contextWindow === undefined ||
                Math.min(
                  Math.abs(start - span.end),
                  Math.abs(span.start - start - parts.length),
                ) <= rule.contextWindow),
          )
        )
          continue;
        found.push({
          target: rule.task,
          start,
          end: start + parts.length,
          outputs: rule.outputs,
          implicitSource: rule.implicitSource,
          contextSpans,
          natural: true,
          implicitSourceAlongside: rule.implicitSourceAlongside,
          procedural: rule.procedural,
          preference: rule.preference,
        });
      }
    }
  }
  return found.sort(
    (a, b) =>
      a.start - b.start ||
      b.end - a.end ||
      (a.target < b.target ? -1 : a.target === b.target ? 0 : 1),
  );
}
