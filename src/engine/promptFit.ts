import type {
  PublicCatalog,
  PublicCatalogItem,
} from '../contracts/publicCatalog';
import { languageTokens, type PromptLanguage } from './promptLanguage';
import type { VideoWorkflow } from './workflow';

/** Apply task/topic and unsupported-outcome constraints independently of ranking. */
export function preparePromptFit(
  catalog: PublicCatalog,
  positiveWords: string[],
  tasks: readonly string[],
  language?: PromptLanguage,
  evidence: {
    instructionForm?: (youtubeId: string, task: string) => string | undefined;
    learningFormat?: (youtubeId: string) => string | undefined;
    artifactIds?: readonly string[];
    requestedOutputs?: readonly string[];
  } = {},
) {
  const contains = (words: string[], phrase: string) => {
    const parts = languageTokens(phrase);
    return words.some((_, start) =>
      parts.every((part, offset) => words[start + offset] === part),
    );
  };
  const words = positiveWords.map((word) => languageTokens(word)[0] ?? word);
  const validGroups = (groups: string[][]) =>
    groups.every(
      (group) =>
        group.length && group.every((phrase) => languageTokens(phrase).length),
    );
  const matches = (groups: string[][]) =>
    groups.every((group) => group.some((phrase) => contains(words, phrase)));
  const filters = language?.candidateConstraints ?? [];
  const procedural = (id: string, task: string) =>
    ['demonstrated', 'walkthrough'].includes(
      evidence.instructionForm?.(id, task) ?? '',
    );
  for (const rule of filters) {
    if (
      !(
        rule.excludeTasks?.length ||
        rule.teachingAny?.length ||
        rule.requireTools?.length ||
        rule.proceduralTasks?.length ||
        rule.requireFormats?.length ||
        rule.anyTasks?.length
      ) ||
      [
        ...(rule.whenTasks ?? []),
        ...(rule.excludeTasks ?? []),
        ...(rule.proceduralTasks ?? []),
        ...(rule.anyTasks ?? []),
        ...(rule.generalTasksOnly ?? []),
      ].some((task) => !catalog.tasks.includes(task)) ||
      (rule.requireTools ?? []).some((tool) => !catalog.tools.includes(tool)) ||
      (rule.unlessOutputs ?? []).some(
        (output) =>
          !output ||
          (evidence.artifactIds && !evidence.artifactIds.includes(output)),
      ) ||
      (rule.requireFormats ?? []).some(
        (format) =>
          !['demo', 'walkthrough', 'presentation', 'explainer'].includes(
            format,
          ),
      ) ||
      !validGroups(rule.contextAll ?? []) ||
      [...(rule.unlessContext ?? []), ...(rule.teachingAny ?? [])].some(
        (phrase) => !languageTokens(phrase).length,
      )
    )
      throw new Error('Invalid candidate relevance constraint.');
  }
  const warnings: string[] = [];
  const workflowFilters = language?.workflowConstraints ?? [];
  for (const rule of workflowFilters) {
    if (
      !catalog.tasks.includes(rule.task) ||
      !rule.contextAll.length ||
      !validGroups(rule.contextAll) ||
      !(
        rule.allowedSources?.length ||
        rule.teachingAny?.length ||
        rule.requireProcedure
      ) ||
      (rule.allowedSources ?? []).some(
        (source) =>
          !source ||
          (evidence.artifactIds && !evidence.artifactIds.includes(source)),
      ) ||
      [...(rule.teachingAny ?? []), ...(rule.unlessContext ?? [])].some(
        (phrase) => !languageTokens(phrase).length,
      )
    )
      throw new Error('Invalid workflow relevance constraint.');
  }
  for (const rule of language?.unsupportedIntents ?? []) {
    if (
      !rule.contextAll.length ||
      !validGroups(rule.contextAll) ||
      (rule.unlessContext ?? []).some(
        (phrase) => !languageTokens(phrase).length,
      ) ||
      !rule.message.trim()
    )
      throw new Error('Invalid unsupported-intent constraint.');
    if (
      matches(rule.contextAll) &&
      !(rule.unlessContext ?? []).some((phrase) => contains(words, phrase))
    )
      warnings.push(rule.message);
  }
  const active = filters.filter(
    (rule) =>
      (!rule.whenTasks?.length ||
        rule.whenTasks.some((task) => tasks.includes(task))) &&
      matches(rule.contextAll ?? []) &&
      !(rule.unlessContext ?? []).some((phrase) => contains(words, phrase)) &&
      !(rule.unlessOutputs ?? []).some((output) =>
        evidence.requestedOutputs?.includes(output),
      ),
  );
  const activeWorkflows = workflowFilters.filter(
    (rule) =>
      matches(rule.contextAll) &&
      !(rule.unlessContext ?? []).some((phrase) => contains(words, phrase)),
  );
  return {
    warnings: [...new Set(warnings)].sort(),
    allows(item: PublicCatalogItem) {
      const teaching = languageTokens(
        `${item.title} ${item.description} ${item.tasks.join(' ')}`,
      );
      return active.every(
        (rule) =>
          !(rule.excludeTasks ?? []).some((task) =>
            item.tasks.includes(task),
          ) &&
          (!rule.teachingAny?.length ||
            rule.teachingAny.some((phrase) => contains(teaching, phrase))) &&
          (rule.requireTools ?? []).every((tool) =>
            item.tools.includes(tool),
          ) &&
          (rule.proceduralTasks ?? []).every((task) =>
            procedural(item.youtubeId, task),
          ) &&
          (!rule.requireFormats?.length ||
            rule.requireFormats.some(
              (format) => format === evidence.learningFormat?.(item.youtubeId),
            )) &&
          (!rule.anyTasks?.length ||
            rule.anyTasks.some((task) => item.tasks.includes(task)) ||
            (!!rule.generalTasksOnly?.length &&
              item.tasks.length > 0 &&
              item.tasks.every(
                (task) => rule.generalTasksOnly?.includes(task) ?? false,
              ))),
      );
    },
    allowsWorkflow(flow: VideoWorkflow) {
      const item = catalog.items.find(
        (item) => item.youtubeId === flow.youtubeId,
      );
      if (!item) return false;
      const teaching = languageTokens(
        `${item.title} ${item.description} ${item.tasks.join(' ')}`,
      );
      return activeWorkflows.every(
        (rule) =>
          rule.task !== flow.task ||
          ((!rule.allowedSources?.length ||
            rule.allowedSources.includes(flow.source)) &&
            (!rule.requireProcedure || procedural(flow.youtubeId, flow.task)) &&
            (!rule.teachingAny?.length ||
              rule.teachingAny.some((phrase) => contains(teaching, phrase)))),
      );
    },
  };
}
