// Expand the deterministic candidate pool using reviewed task and workflow evidence.
import type { PublicCatalog } from '../contracts/publicCatalog';
import type { PromptOptions, PromptRequest, PromptResult } from './prompt';
import { preparePromptFit } from './promptFit';
import { promptPolarity } from './promptPolarity';
import { languageTokens, promptWords } from './promptLanguage';
import { compatibleTask } from './workflow';

export interface ExpansionComponent {
  requestedTasks: string[];
  taughtTasks: string[];
  outputs: string[];
  sources?: string[];
  flowTasks?: string[];
  requiresTasks?: string[];
  requireSourceMatch?: boolean;
  requireSharedTopic?: boolean;
  requireAudience?: boolean;
  explanatory?: boolean;
  contextAll?: string[][];
  teachingAll?: string[][];
}
export interface ExpansionPolicy {
  resultLimit: number;
  minimumProcedureStrength: number;
  explanatoryTasks: string[];
  sharedTopicGroups: string[][];
  audienceGroup: string[];
  components: ExpansionComponent[];
}
interface Evidence {
  tier: number;
  requestedTask: string;
  taughtTask: string;
  flowTask?: string;
  source?: string;
  output?: string;
  sourceSpecified: boolean;
  sourceMatch: boolean;
  instructionStrength: number;
  formatAffinity: number;
  toolMatches: number;
  componentIndex?: number;
}
export interface ExpansionDecision {
  youtubeId: string;
  status: 'current' | 'rejected' | 'admitted' | 'returned' | 'no-room';
  reason: string;
  evidence?: Evidence;
}
const strength: Record<string, number> = {
  demonstrated: 1,
  walkthrough: 0.75,
  explained: 0.5,
  mentioned: 0,
};
const ordinal = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function expandCandidates({
  catalog,
  request,
  options,
  current,
  policy,
}: {
  catalog: PublicCatalog;
  request: PromptRequest;
  options: PromptOptions;
  current: PromptResult;
  policy: ExpansionPolicy;
}) {
  const interpreted = current.interpretation;
  const words = promptPolarity(
    promptWords(request.prompt),
  ).positiveWords.flatMap(languageTokens);
  const contains = (haystack: readonly string[], phrase: string) => {
    const parts = languageTokens(phrase);
    return haystack.some((_, start) =>
      parts.every((part, index) => haystack[start + index] === part),
    );
  };
  const groupsMatch = (groups: string[][], text: readonly string[]) =>
    groups.every((group) => group.some((phrase) => contains(text, phrase)));
  const instruction = (id: string, task: string) =>
    strength[
      options.instructions?.find(
        (row) => row.youtubeId === id && row.task === task,
      )?.form ?? 'mentioned'
    ] ?? 0;
  const fit = preparePromptFit(
    catalog,
    words,
    interpreted.tasks,
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
      requestedOutputs: interpreted.desiredOutputs,
    },
  );
  const baseline = current.recommendations.slice(
    0,
    request.limit ?? policy.resultLimit,
  );
  const originalIds = new Set(baseline.map((row) => row.item.youtubeId));
  const limit = request.limit ?? policy.resultLimit;
  const proposals = catalog.items.map(({ youtubeId }) => ({ youtubeId }));
  const audit: ExpansionDecision[] = [];
  for (const candidate of proposals) {
    const decision: ExpansionDecision = {
      ...candidate,
      status: 'rejected',
      reason: '',
    };
    audit.push(decision);
    if (originalIds.has(candidate.youtubeId)) {
      decision.status = 'current';
      decision.reason = 'Already protected in the current list.';
      continue;
    }
    if (!baseline.length) {
      decision.reason = 'No current result to anchor a conservative expansion.';
      continue;
    }
    if (!interpreted.tasks.length) {
      decision.reason =
        'No positive recognized task; similarity alone cannot establish intent.';
      continue;
    }
    const copies = catalog.items.filter(
      (item) => item.youtubeId === candidate.youtubeId,
    );
    if (copies.length !== 1 || copies[0].status !== 'active') {
      decision.reason = 'Not a unique active catalog item.';
      continue;
    }
    const item = copies[0];
    if (
      item.tasks.some((task) => interpreted.excludedTasks.includes(task)) ||
      item.tools.some((tool) => interpreted.excludedTools.includes(tool))
    ) {
      decision.reason = 'Explicit task or tool exclusion.';
      continue;
    }
    if (fit.warnings.length || !fit.allows(item)) {
      decision.reason = 'Current candidate or unsupported-intent constraint.';
      continue;
    }
    if (
      item.tasks.includes('Language learning') &&
      !interpreted.tasks.includes('Language learning')
    ) {
      decision.reason =
        'A specialist language lesson cannot substitute for a general workplace or teaching task.';
      continue;
    }
    const teaching = languageTokens(`${item.title} ${item.description}`);
    const format = options.learningFormats?.videos.find(
      (row) => row.youtubeId === item.youtubeId,
    );
    const formatAffinity = interpreted.learningFormats.some(
      (value) => value === format?.primary,
    )
      ? 2
      : interpreted.learningFormats.some((value) =>
            format?.secondary.includes(value),
          )
        ? 1
        : 0;
    const toolMatches = interpreted.tools.filter((tool) =>
      item.tools.includes(tool),
    ).length;
    const candidates: Evidence[] = [];
    const flows = (options.workflows?.workflows ?? []).filter(
      (flow) =>
        flow.youtubeId === item.youtubeId &&
        fit.allowsWorkflow(flow) &&
        flow.stage !== 'review',
    );
    for (const task of interpreted.tasks) {
      const needed = policy.explanatoryTasks.includes(task)
        ? 0.5
        : policy.minimumProcedureStrength;
      if (
        !item.tasks.includes(task) ||
        instruction(item.youtubeId, task) < needed
      )
        continue;
      for (const flow of flows) {
        if (instruction(item.youtubeId, flow.task) < needed) continue;
        if (
          interpreted.desiredOutputs.length &&
          !interpreted.desiredOutputs.includes(flow.output)
        )
          continue;
        const exact = compatibleTask(task, flow.task);
        candidates.push({
          tier: exact ? 0 : 1,
          requestedTask: task,
          taughtTask: task,
          flowTask: flow.task,
          source: flow.source,
          output: flow.output,
          sourceSpecified: interpreted.sourceMaterials.length > 0,
          sourceMatch: interpreted.sourceMaterials.includes(flow.source),
          instructionStrength: Math.min(
            instruction(item.youtubeId, task),
            instruction(item.youtubeId, flow.task),
          ),
          formatAffinity,
          toolMatches,
        });
      }
    }
    for (const [componentIndex, rule] of policy.components.entries()) {
      const requested = rule.requestedTasks.find((task) =>
        interpreted.tasks.includes(task),
      );
      if (
        !requested ||
        !groupsMatch(rule.contextAll ?? [], words) ||
        !groupsMatch(rule.teachingAll ?? [], teaching)
      )
        continue;
      if (
        rule.requireSharedTopic &&
        !policy.sharedTopicGroups.some(
          (group) =>
            group.some((term) => contains(words, term)) &&
            group.some((term) => contains(teaching, term)),
        )
      )
        continue;
      if (
        rule.requireAudience &&
        !(
          policy.audienceGroup.some((term) => contains(words, term)) &&
          policy.audienceGroup.some((term) => contains(teaching, term))
        )
      )
        continue;
      const minimum = rule.explanatory ? 0.5 : policy.minimumProcedureStrength;
      if (
        (rule.requiresTasks ?? []).some(
          (task) =>
            !item.tasks.includes(task) ||
            instruction(item.youtubeId, task) < minimum,
        )
      )
        continue;
      for (const task of rule.taughtTasks) {
        if (
          !item.tasks.includes(task) ||
          instruction(item.youtubeId, task) < minimum
        )
          continue;
        if (!rule.outputs.length) {
          candidates.push({
            tier: 2,
            requestedTask: requested,
            taughtTask: task,
            sourceSpecified: false,
            sourceMatch: false,
            instructionStrength: instruction(item.youtubeId, task),
            formatAffinity,
            toolMatches,
            componentIndex,
          });
          continue;
        }
        for (const flow of flows) {
          if (
            !(rule.flowTasks ?? rule.taughtTasks).includes(flow.task) ||
            !rule.outputs.includes(flow.output) ||
            (rule.sources?.length && !rule.sources.includes(flow.source)) ||
            (rule.requireSourceMatch &&
              !interpreted.sourceMaterials.includes(flow.source)) ||
            instruction(item.youtubeId, flow.task) < minimum
          )
            continue;
          candidates.push({
            tier: 2,
            requestedTask: requested,
            taughtTask: task,
            flowTask: flow.task,
            source: flow.source,
            output: flow.output,
            sourceSpecified: interpreted.sourceMaterials.length > 0,
            sourceMatch: interpreted.sourceMaterials.includes(flow.source),
            instructionStrength: Math.min(
              instruction(item.youtubeId, task),
              instruction(item.youtubeId, flow.task),
            ),
            formatAffinity,
            toolMatches,
            componentIndex,
          });
        }
      }
    }
    candidates.sort(
      (a, b) =>
        a.tier - b.tier ||
        Number(b.sourceMatch) - Number(a.sourceMatch) ||
        b.instructionStrength - a.instructionStrength ||
        b.formatAffinity - a.formatAffinity ||
        b.toolMatches - a.toolMatches ||
        ordinal(a.taughtTask, b.taughtTask) ||
        ordinal(a.flowTask ?? '', b.flowTask ?? '') ||
        ordinal(a.source ?? '', b.source ?? '') ||
        ordinal(a.output ?? '', b.output ?? ''),
    );
    const evidence = candidates[0];
    if (!evidence) {
      decision.reason =
        'No eligible requested task/output or registered supporting component with instructional evidence.';
      continue;
    }
    decision.status = 'admitted';
    decision.evidence = evidence;
    decision.reason = `Supporting ${evidence.taughtTask} method for ${evidence.requestedTask}${evidence.output ? `: ${evidence.source} → ${evidence.output}` : ''}. ${evidence.sourceSpecified && !evidence.sourceMatch ? 'Different starting material; ' : ''}This is an additional method, not a complete-workflow or native-tool guarantee.`;
  }
  const admitted = audit
    .filter((row) => row.status === 'admitted')
    .sort((a, b) => {
      const x = a.evidence!,
        y = b.evidence!;
      return (
        x.tier - y.tier ||
        Number(y.sourceMatch) - Number(x.sourceMatch) ||
        y.instructionStrength - x.instructionStrength ||
        y.formatAffinity - x.formatAffinity ||
        y.toolMatches - x.toolMatches ||
        ordinal(a.youtubeId, b.youtubeId)
      );
    });
  const additions = admitted.slice(0, Math.max(0, limit - baseline.length));
  const selected = new Set(additions.map((row) => row.youtubeId));
  for (const row of admitted)
    row.status = selected.has(row.youtubeId) ? 'returned' : 'no-room';
  return {
    recommendations: [
      ...baseline.map((row, index) => ({
        youtubeId: row.item.youtubeId,
        rank: index + 1,
        origin: 'current',
        reason: row.reason,
      })),
      ...additions.map((row, index) => ({
        youtubeId: row.youtubeId,
        rank: baseline.length + index + 1,
        origin: 'expanded',
        reason: row.reason,
        evidence: row.evidence,
      })),
    ],
    audit,
    protectedCount: baseline.length,
    proposed: proposals.length,
    admitted: admitted.length,
  };
}
