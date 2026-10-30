import { normalizeTerm, type PublicCatalog } from '../contracts/publicCatalog';
import { interpretWorkflowIntent } from './workflowIntent';
import {
  languageTokens,
  languageWord,
  type PromptLanguage,
  type TaskIntentMention,
} from './promptLanguage';

export interface ArtifactType {
  id: string;
  label: string;
  aliases: string[];
  tasks: string[];
  verbs?: string[];
  supports?: string[];
  supportingTasks?: string[];
}

export interface VideoWorkflow {
  youtubeId: string;
  source: string;
  output: string;
  task: string;
  stage?: 'produce' | 'review';
}

export interface WorkflowConfig {
  artifacts: readonly ArtifactType[];
  workflows: readonly VideoWorkflow[];
}

export interface WorkflowMatch extends VideoWorkflow {
  relation:
    | 'source-to-output'
    | 'output-review'
    | 'preparation'
    | 'alternative-source'
    | 'supporting-step';
  sourceLabel: string;
  outputLabel: string;
  sourceMatch: boolean;
  sourceSpecified: boolean;
  outputMatch: boolean;
  priority: number;
  supportOrder: number;
  taskCompatibility: 'exact' | 'related' | 'unspecified';
  supportingTask?: string;
}

/** A survey workflow can teach one analysis component; other shared nouns do not establish compatibility. */
export function compatibleTask(requested: string, taught: string): boolean {
  return (
    requested === taught ||
    (['Qualitative analysis', 'Quantitative analysis'].includes(requested) &&
      taught === 'Survey analysis') ||
    (requested === 'Role play' && taught === 'Difficult conversations')
  );
}

function phraseTokens(value: string): string[] {
  return normalizeTerm(value.normalize('NFKC')).split(' ').filter(Boolean);
}

function ordinal(a: string, b: string): number {
  return a === b ? 0 : a < b ? -1 : 1;
}

/** Internal seam: validate reviewed pairs, interpret roles, then match each item. */
export function prepareWorkflows(
  catalog: PublicCatalog,
  config: WorkflowConfig | undefined,
  inputWords: string[],
  allTaskMentions: TaskIntentMention[],
  intentEnabled = true,
  language?: PromptLanguage,
  toolSpans: { start: number; end: number }[] = [],
  requestedTools: readonly string[] = [],
) {
  const taskMentions = allTaskMentions.filter((mention) => !mention.preference);
  const preferences = new Set(
    allTaskMentions
      .filter((mention) => mention.preference)
      .map((mention) => mention.target),
  );
  const words = intentEnabled ? inputWords : [];
  const artifacts = new Map<string, ArtifactType>();
  const aliasKeys = new Set<string>();
  for (const annotation of config ? (language?.artifacts ?? []) : []) {
    if (!config?.artifacts.some((type) => type.id === annotation.artifact))
      throw new Error('Unknown natural artifact reference.');
  }
  for (const original of config?.artifacts ?? []) {
    const additions =
      language?.artifacts.filter(
        (row) =>
          row.artifact === original.id &&
          (!row.context?.length ||
            row.context.some((context) => {
              const parts = languageTokens(context),
                normalized = words.map(
                  (word) => languageTokens(word)[0] ?? word,
                );
              return normalized.some((_, start) =>
                parts.every(
                  (part, offset) => normalized[start + offset] === part,
                ),
              );
            })),
      ) ?? [];
    const type = {
      ...original,
      aliases: [
        ...original.aliases,
        ...additions.flatMap((row) => row.aliases),
      ],
      verbs: [
        ...(original.verbs ?? []),
        ...additions.flatMap((row) => row.inputVerbs ?? []),
      ],
      supportingTasks: additions.flatMap(
        (row) => row.supportingWhenTasks ?? [],
      ),
    };
    if (
      !type.id ||
      artifacts.has(type.id) ||
      !type.label ||
      !type.aliases.length
    )
      throw new Error('Invalid workflow artifact vocabulary.');
    artifacts.set(type.id, type);
    for (const alias of type.aliases) {
      const tokens = phraseTokens(alias);
      const key = tokens.join(' ');
      if (!key || aliasKeys.has(key))
        throw new Error('Duplicate or empty workflow artifact alias.');
      aliasKeys.add(key);
    }
  }
  for (const type of artifacts.values()) {
    if (
      type.tasks.some((task) => !catalog.tasks.includes(task)) ||
      (type.supportingTasks ?? []).some(
        (task) => !catalog.tasks.includes(task),
      ) ||
      (type.supports ?? []).some((id) => !artifacts.has(id))
    )
      throw new Error('Invalid workflow artifact reference.');
  }
  const byVideo = new Map<string, VideoWorkflow[]>();
  const flowKeys = new Set<string>();
  for (const flow of config?.workflows ?? []) {
    const key = JSON.stringify([
      flow.youtubeId,
      flow.source,
      flow.output,
      flow.task,
      flow.stage ?? 'produce',
    ]);
    if (
      !artifacts.has(flow.source) ||
      !artifacts.has(flow.output) ||
      !catalog.items.some(
        (item) =>
          item.youtubeId === flow.youtubeId && item.tasks.includes(flow.task),
      ) ||
      (flow.stage !== undefined &&
        flow.stage !== 'produce' &&
        flow.stage !== 'review') ||
      flowKeys.has(key)
    ) {
      throw new Error('Invalid or duplicate source/output workflow evidence.');
    }
    flowKeys.add(key);
    byVideo.set(flow.youtubeId, [...(byVideo.get(flow.youtubeId) ?? []), flow]);
  }
  if (config)
    for (const rule of language?.tasks ?? []) {
      if (
        (rule.outputs ?? []).some((id) => !artifacts.has(id)) ||
        (rule.implicitSource && !artifacts.has(rule.implicitSource))
      )
        throw new Error('Unknown natural task artifact reference.');
    }
  const supportKeys = new Set<string>();
  for (const rule of language?.taskSupports ?? []) {
    const key = JSON.stringify([
      rule.requestedTask,
      rule.taughtTask,
      [...rule.outputs].sort(),
      rule.requiresPreference ?? false,
    ]);
    if (
      !catalog.tasks.includes(rule.requestedTask) ||
      !catalog.tasks.includes(rule.taughtTask) ||
      (rule.requiresTasks ?? []).some(
        (task) => !catalog.tasks.includes(task),
      ) ||
      (rule.teachingAny ?? []).some(
        (phrase) => !languageTokens(phrase).length,
      ) ||
      (rule.contextAll ?? []).some(
        (group) =>
          !group.length ||
          group.some((phrase) => !languageTokens(phrase).length),
      ) ||
      !rule.outputs.length ||
      new Set(rule.outputs).size !== rule.outputs.length ||
      (config && rule.outputs.some((output) => !artifacts.has(output))) ||
      supportKeys.has(key)
    )
      throw new Error('Invalid or duplicate supporting task relation.');
    supportKeys.add(key);
  }
  const intent = interpretWorkflowIntent(
    artifacts,
    words,
    taskMentions,
    intentEnabled,
    toolSpans,
    language?.refinements,
  );
  const sourceTypes = new Set(intent.sourceTypes);
  const outputTypes = new Set(intent.outputTypes);
  const requestedTasks = new Set(
    taskMentions
      .filter(
        (mention) =>
          !intent.isSourceTask(mention) &&
          !intent.suppressedTasks.has(mention.target),
      )
      .map((mention) => mention.target),
  );

  function match(
    youtubeId: string,
    eligibleTask: (task: string, requireProcedure?: boolean) => boolean = () =>
      true,
    eligibleFlow: (flow: VideoWorkflow) => boolean = () => true,
  ): WorkflowMatch | undefined {
    const matches: WorkflowMatch[] = [];
    for (const flow of byVideo.get(youtubeId) ?? []) {
      if (!eligibleFlow(flow)) continue;
      if (!eligibleTask(flow.task)) continue;
      if (intent.preferReview && flow.stage !== 'review') continue;
      const sourceMatch = sourceTypes.has(flow.source);
      const outputMatch = outputTypes.has(flow.output);
      const item = catalog.items.find((item) => item.youtubeId === youtubeId)!;
      const support = [...(language?.taskSupports ?? [])]
        .sort((a, b) => ordinal(a.taughtTask, b.taughtTask))
        .find(
          (rule) =>
            requestedTasks.has(rule.requestedTask) &&
            (rule.contextAll ?? []).every((group) =>
              group.some((phrase) => {
                const parts = languageTokens(phrase);
                const positive = words.map(languageWord);
                return positive.some((_, start) =>
                  parts.every(
                    (part, offset) => positive[start + offset] === part,
                  ),
                );
              }),
            ) &&
            (!rule.requiresPreference || preferences.has(rule.taughtTask)) &&
            item.tasks.includes(rule.taughtTask) &&
            eligibleTask(rule.taughtTask, true) &&
            (!rule.requiresToolMatch ||
              requestedTools.some((tool) => item.tools.includes(tool))) &&
            (!rule.requiresRequestedOutput || outputTypes.has(flow.output)) &&
            (!rule.requiresSourceMatch || sourceMatch) &&
            (rule.requiresTasks ?? []).every(
              (task) => item.tasks.includes(task) && eligibleTask(task, true),
            ) &&
            (!rule.teachingAny?.length ||
              rule.teachingAny.some((phrase) => {
                const parts = languageTokens(phrase);
                const teaching = languageTokens(
                  `${item.title} ${item.description}`,
                );
                return teaching.some((_, start) =>
                  parts.every(
                    (part, offset) => teaching[start + offset] === part,
                  ),
                );
              })) &&
            rule.outputs.includes(flow.output),
        );
      const supportOrder = Math.min(
        ...[...outputTypes].map((id) => {
          const index = artifacts.get(id)!.supports?.indexOf(flow.output) ?? -1;
          return index < 0 ? Infinity : index;
        }),
      );
      let relation: WorkflowMatch['relation'];
      let priority: number;
      if (outputMatch && (!sourceTypes.size || sourceMatch)) {
        relation =
          flow.stage === 'review' ? 'output-review' : 'source-to-output';
        priority =
          flow.stage === 'review'
            ? intent.preferReview
              ? 0
              : 1
            : intent.preferReview
              ? 1
              : 0;
      } else if (
        sourceTypes.size &&
        sourceMatch &&
        Number.isFinite(supportOrder)
      ) {
        relation = 'preparation';
        priority = 2;
      } else if (outputMatch && flow.stage !== 'review') {
        relation = 'alternative-source';
        priority = 3;
      } else if (support && flow.stage !== 'review') {
        relation = 'supporting-step';
        priority = 3.5;
      } else continue;
      // A common artifact is insufficient when the user requested another task.
      // Source-aligned preparation remains a separately labeled supporting step.
      const taskRelation = requestedTasks.has(flow.task)
        ? 'exact'
        : support ||
            [...requestedTasks].some((task) => compatibleTask(task, flow.task))
          ? 'related'
          : 'unspecified';
      if (
        requestedTasks.size &&
        taskRelation === 'unspecified' &&
        relation !== 'preparation'
      )
        continue;
      matches.push({
        ...flow,
        relation,
        priority: priority + (taskRelation === 'related' ? 0.5 : 0),
        taskCompatibility: taskRelation,
        ...(support ? { supportingTask: support.taughtTask } : {}),
        sourceMatch,
        outputMatch,
        sourceSpecified: intent.explicitSourceTypes.has(flow.source),
        sourceLabel: artifacts.get(flow.source)!.label,
        outputLabel: artifacts.get(flow.output)!.label,
        supportOrder: Number.isFinite(supportOrder) ? supportOrder : 0,
      });
    }
    return matches.sort(
      (a, b) =>
        a.priority - b.priority ||
        a.supportOrder - b.supportOrder ||
        ordinal(a.task, b.task) ||
        ordinal(a.source, b.source) ||
        ordinal(a.output, b.output) ||
        ordinal(a.stage ?? 'produce', b.stage ?? 'produce'),
    )[0];
  }
  return {
    sourceTypes: [...sourceTypes].sort(),
    outputTypes: [...outputTypes].sort(),
    intermediateTypes: intent.intermediateTypes,
    supportingTypes: intent.supportingTypes,
    consumed: intent.consumed,
    isSourceTask: intent.isSourceTask,
    isSuppressedTask: (task: string) => intent.suppressedTasks.has(task),
    match,
    hasOutput: outputTypes.size > 0,
    hasEvidence: (id: string) => byVideo.has(id),
  };
}
