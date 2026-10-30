import type {
  PublicCatalog,
  PublicCatalogItem,
} from '../contracts/publicCatalog';
import { prepareInstructions, type PromptOptions } from './prompt';
import { languageTokens } from './promptLanguage';
import {
  containsPhrase,
  type CandidateRequirement,
  type interpretOperation,
} from './taskIntent';

const strength = {
  demonstrated: 1,
  walkthrough: 0.75,
  explained: 0.5,
  mentioned: 0,
};
type Intent = ReturnType<typeof interpretOperation>;
function requirement(
  item: PublicCatalogItem,
  rule: CandidateRequirement,
  intent: Intent,
  options: PromptOptions,
  instructions: ReturnType<typeof prepareInstructions>,
) {
  const teaching = languageTokens(`${item.title} ${item.description}`);
  if (
    rule.when?.length &&
    !rule.when.some((phrase) => containsPhrase(intent.positive, phrase))
  )
    return null;
  if (
    rule.allTasks?.some((task) => !item.tasks.includes(task)) ||
    rule.excludeTasks?.some((task) => item.tasks.includes(task)) ||
    rule.excludeTeaching?.some((phrase) => containsPhrase(teaching, phrase)) ||
    (rule.teaching?.length &&
      !rule.teaching.some((phrase) => containsPhrase(teaching, phrase)))
  )
    return null;
  const relevant = rule.tasks.filter(
    (task) =>
      item.tasks.includes(task) &&
      !intent.interpretation.excludedTasks.includes(task),
  );
  const taught = relevant.filter((task) => {
    const form = instructions.get(JSON.stringify([item.youtubeId, task]));
    return (
      !options.instructions ||
      (form &&
        strength[form] >=
          (rule.minimumStrength ??
            (intent.operation?.explanatory ? 0.5 : 0.75)))
    );
  });
  const flows =
    options.workflows?.workflows.filter(
      (row) => row.youtubeId === item.youtubeId && taught.includes(row.task),
    ) ?? [];
  const sameSource = (source: string) =>
    intent.interpretation.sourceMaterials.some(
      (requested) =>
        requested === source ||
        (['survey', 'spreadsheet'].includes(requested) &&
          ['survey', 'spreadsheet'].includes(source)),
    );
  if (
    rule.requireSourceMatch &&
    intent.interpretation.sourceMaterials.length &&
    !flows.some((flow) => sameSource(flow.source))
  )
    return null;
  if (
    rule.requireOutputMatch &&
    intent.interpretation.desiredOutputs.length &&
    !flows.some(
      (flow) =>
        intent.interpretation.desiredOutputs.includes(flow.output) &&
        (!intent.interpretation.sourceMaterials.length ||
          sameSource(flow.source)),
    )
  )
    return null;
  return taught.length ? { priority: rule.priority, taught } : null;
}

/** Compatibility is evaluated before ranking and before the result cap, for every catalog item. */
export function compatibleCandidates(
  catalog: PublicCatalog,
  intent: Intent,
  options: PromptOptions,
) {
  const instructions = prepareInstructions(catalog, options.instructions);
  if (!intent.operation) return [];
  const operation = intent.operation;
  const frequency = new Map<string, number>();
  for (const item of catalog.items)
    for (const token of new Set(
      languageTokens(`${item.title} ${item.description}`),
    ))
      frequency.set(token, (frequency.get(token) ?? 0) + 1);
  const query = new Set(intent.positive.filter((word) => word.length > 3));
  for (const group of [
    ['average', 'mean'],
    [
      'january',
      'february',
      'march',
      'april',
      'may',
      'june',
      'july',
      'august',
      'september',
      'october',
      'november',
      'december',
      'month',
    ],
  ])
    if (group.some((word) => query.has(word)))
      for (const word of group) query.add(word);
  const ids = new Map<string, number>();
  for (const item of catalog.items)
    ids.set(item.youtubeId, (ids.get(item.youtubeId) ?? 0) + 1);
  const rows = catalog.items.flatMap((item) => {
    if (
      item.status !== 'active' ||
      ids.get(item.youtubeId) !== 1 ||
      item.tools.some((tool) =>
        intent.interpretation.excludedTools.includes(tool),
      )
    )
      return [];
    if (
      intent.requiredTool &&
      !item.tools.some((tool) =>
        languageTokens(tool).includes(intent.requiredTool!.toLowerCase()),
      )
    )
      return [];
    const teaching = languageTokens(`${item.title} ${item.description}`);
    if (
      intent.constraints.some(
        (rule) =>
          rule.tasks?.some((task) => !item.tasks.includes(task)) ||
          rule.tools?.some((tool) => !item.tools.includes(tool)) ||
          rule.teaching?.some(
            (group) =>
              !group.some((phrase) => containsPhrase(teaching, phrase)),
          ),
      )
    )
      return [];
    if (intent.language && !teaching.includes(intent.language)) return [];
    const evidence = operation.candidates
      .map((rule) => requirement(item, rule, intent, options, instructions))
      .filter((row) => row !== null)
      .sort((a, b) => b.priority - a.priority)[0];
    if (!evidence) return [];
    const format = options.learningFormats?.videos.find(
      (row) => row.youtubeId === item.youtubeId,
    );
    const formatScore = intent.interpretation.learningFormats.reduce(
      (n, value) =>
        Math.max(
          n,
          format?.primary === value
            ? 2
            : format?.secondary.includes(value)
              ? 1
              : 0,
        ),
      0,
    );
    const lexical = [...new Set(teaching)]
      .filter((token) => query.has(token))
      .reduce(
        (sum, token) =>
          sum +
          Math.log(1 + catalog.items.length / (frequency.get(token) ?? 1)),
        0,
      );
    const flow = options.workflows?.workflows
      .filter(
        (row) =>
          row.youtubeId === item.youtubeId &&
          evidence.taught.includes(row.task),
      )
      .sort((a, b) =>
        `${a.task}:${a.source}:${a.output}`.localeCompare(
          `${b.task}:${b.source}:${b.output}`,
          'en',
        ),
      )[0];
    const sourceMatch = flow?.source === operation.source;
    const toolScore = intent.interpretation.tools.filter((tool) =>
      item.tools.includes(tool),
    ).length;
    return [
      {
        item,
        priority: evidence.priority,
        formatScore,
        lexical,
        toolScore,
        sourceMatch,
        reason: `Teaches ${evidence.taught.join(' and ')} for ${operation.tasks.join(' / ')}.${flow ? ` Example: ${flow.source} → ${flow.output}.` : ''}${evidence.priority < 100 ? ' Covers a transferable component; additional steps may be needed.' : ''}`,
      },
    ];
  });
  return rows.sort(
    (a, b) =>
      b.priority - a.priority ||
      b.formatScore - a.formatScore ||
      b.toolScore - a.toolScore ||
      b.lexical - a.lexical ||
      Number(b.sourceMatch) - Number(a.sourceMatch) ||
      (a.item.youtubeId < b.item.youtubeId ? -1 : 1),
  );
}
