// Experimental revision of the expanded deterministic rules. No grades or semantic scores are inputs.
import type {
  PublicCatalog,
  PublicCatalogItem,
} from '../contracts/publicCatalog';
import type {
  PromptInterpretation,
  PromptOptions,
  PromptRequest,
  PromptResult,
} from './prompt';
import { expandCandidates, type ExpansionPolicy } from './candidateExpansion';
import { languageTokens, promptWords } from './promptLanguage';
import { promptPolarity } from './promptPolarity';

export interface ExpansionRefinementPolicy {
  minimumProcedureStrength: number;
  requireCompanionSourceMatch: boolean;
  numericChart: {
    tasks: string[];
    chartTerms: string[];
    measureTerms: string[];
    requiredTask: string;
  };
  interviewResearch: {
    tasksAll: string[];
    conductingCues: string[];
    applicantCues: string[];
    applicantTask: string;
    researchTask: string;
  };
  assistantDesign: {
    assistantTerms: string[];
    educationTerms: string[];
    conceptualCues: string[];
    learningFormat: string;
    courseTasks: string[];
    assistantTask: string;
  };
  immediateWriting: {
    tasks: string[];
    setupTasks: string[];
    assistantTask: string;
    assistantOutput: string;
  };
}
export interface RecommendationOperations {
  numericChart: boolean;
  conductingInterview: boolean;
  educationalAssistantExplanation: boolean;
  immediateWriting: boolean;
}
export function recommendationOperations(
  prompt: string,
  interpreted: PromptInterpretation,
  policy: ExpansionRefinementPolicy,
): RecommendationOperations {
  const words = promptPolarity(promptWords(prompt)).positiveWords.flatMap(
    languageTokens,
  );
  const contains = (phrase: string) => {
    const parts = languageTokens(phrase);
    return words.some((_, start) =>
      parts.every((part, index) => words[start + index] === part),
    );
  };
  const any = (terms: string[]) => terms.some(contains);
  const numeric = policy.numericChart,
    interview = policy.interviewResearch,
    assistant = policy.assistantDesign,
    writing = policy.immediateWriting;
  return {
    numericChart:
      interpreted.desiredOutputs.includes('chart') ||
      (!interpreted.sourceMaterials.includes('chart') &&
        numeric.tasks.some((task) => interpreted.tasks.includes(task)) &&
        any(numeric.chartTerms) &&
        any(numeric.measureTerms)),
    conductingInterview:
      interview.tasksAll.every((task) => interpreted.tasks.includes(task)) &&
      any(interview.conductingCues) &&
      !any(interview.applicantCues),
    educationalAssistantExplanation:
      any(assistant.assistantTerms) &&
      any(assistant.educationTerms) &&
      (interpreted.learningFormats.some(
        (format) => format === assistant.learningFormat,
      ) ||
        any(assistant.conceptualCues)),
    immediateWriting:
      writing.tasks.some((task) => interpreted.tasks.includes(task)) &&
      !writing.setupTasks.some((task) => interpreted.tasks.includes(task)),
  };
}
export function assessExpandedRecommendation({
  item,
  interpretation,
  operations,
  evidence,
  options,
  policy,
}: {
  item: PublicCatalogItem;
  interpretation: PromptInterpretation;
  operations: RecommendationOperations;
  evidence?: { tier?: number; source?: string };
  options: PromptOptions;
  policy: ExpansionRefinementPolicy;
}) {
  const failures: string[] = [];
  if (
    policy.requireCompanionSourceMatch &&
    evidence?.tier === 1 &&
    evidence.source &&
    interpretation.sourceMaterials.length &&
    !interpretation.sourceMaterials.includes(evidence.source)
  )
    failures.push(
      'A companion task with the same output does not establish transfer from a different specified source.',
    );
  if (operations.numericChart) {
    const task = policy.numericChart.requiredTask;
    const form = options.instructions?.find(
      (row) => row.youtubeId === item.youtubeId && row.task === task,
    )?.form;
    const score = {
      demonstrated: 1,
      walkthrough: 0.75,
      explained: 0.5,
      mentioned: 0,
    }[form ?? 'mentioned'];
    if (!item.tasks.includes(task) || score < policy.minimumProcedureStrength)
      failures.push(
        'The requested numeric chart needs procedural chart-creation evidence, not general survey analysis.',
      );
  }
  if (
    operations.conductingInterview &&
    item.tasks.includes(policy.interviewResearch.applicantTask) &&
    !item.tasks.includes(policy.interviewResearch.researchTask)
  )
    failures.push(
      'Job-applicant preparation does not establish research for conducting an interview.',
    );
  if (
    operations.educationalAssistantExplanation &&
    policy.assistantDesign.courseTasks.some((task) =>
      item.tasks.includes(task),
    ) &&
    !item.tasks.includes(policy.assistantDesign.assistantTask)
  )
    failures.push(
      'Creating course materials does not establish an explanation of assistant design.',
    );
  const setup = policy.immediateWriting;
  if (
    operations.immediateWriting &&
    item.tasks.includes(setup.assistantTask) &&
    options.workflows?.workflows.some(
      (flow) =>
        flow.youtubeId === item.youtubeId &&
        flow.task === setup.assistantTask &&
        flow.output === setup.assistantOutput,
    )
  )
    failures.push(
      'Configuring a reusable writing assistant is a different operation from drafting this one-off document.',
    );
  return { allowed: failures.length === 0, failures };
}
export function expandedDeterministicRecommendations({
  catalog,
  request,
  options,
  current,
  expansionPolicy,
  refinementPolicy,
}: {
  catalog: PublicCatalog;
  request: PromptRequest;
  options: PromptOptions;
  current: PromptResult;
  expansionPolicy: ExpansionPolicy;
  refinementPolicy: ExpansionRefinementPolicy;
}) {
  // Open the candidate pool before filtering, so the eight-result cap cannot hide a useful survivor.
  const expanded = expandCandidates({
    catalog,
    request: { ...request, limit: catalog.items.length },
    options,
    current,
    policy: expansionPolicy,
  });
  const operations = recommendationOperations(
    request.prompt,
    current.interpretation,
    refinementPolicy,
  );
  const decisions = expanded.recommendations.map((row) => {
    const item = catalog.items.find(
      (item) => item.youtubeId === row.youtubeId,
    )!;
    const evidence = expanded.audit.find(
      (candidate) => candidate.youtubeId === row.youtubeId,
    )?.evidence;
    const assessment = assessExpandedRecommendation({
      item,
      interpretation: current.interpretation,
      operations,
      evidence,
      options,
      policy: refinementPolicy,
    });
    return {
      youtubeId: row.youtubeId,
      rank: row.rank,
      origin: row.origin,
      reason: row.reason,
      ...(evidence ? { evidence } : {}),
      expandedRank: row.rank,
      ...assessment,
    };
  });
  return {
    operations,
    decisions,
    candidateAudit: expanded.audit,
    recommendations: decisions
      .filter((row) => row.allowed)
      .slice(0, request.limit ?? expansionPolicy.resultLimit)
      .map((row, index) => ({ ...row, rank: index + 1 })),
  };
}
