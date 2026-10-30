import { describe, expect, it } from 'vitest';
import { precisionPolicy as refinementPolicy } from './promptConfig/precisionPolicy';
import type { PublicCatalogItem } from '../contracts/publicCatalog';
import type { PromptInterpretation, PromptOptions } from './prompt';
import {
  assessExpandedRecommendation,
  recommendationOperations,
  type RecommendationOperations,
} from './expandedPrecision';

const interpretation = (
  overrides: Partial<PromptInterpretation> = {},
): PromptInterpretation => ({
  tasks: [],
  taskPreferences: [],
  tools: [],
  functionAreas: [],
  keywords: [],
  excludedTasks: [],
  excludedTools: [],
  sourceMaterials: [],
  desiredOutputs: [],
  intermediateMaterials: [],
  supportingMaterials: [],
  learningFormats: [],
  ...overrides,
});
const item = (tasks: string[]): PublicCatalogItem => ({
  youtubeId: 'testLesson1',
  title: 'Fictional lesson',
  description: 'Fictional procedural example.',
  tasks,
  tools: [],
  functionAreas: [],
  status: 'active',
  startHere: false,
  addedAt: null,
  lengthSeconds: 120,
});
const operations = (
  overrides: Partial<RecommendationOperations> = {},
): RecommendationOperations => ({
  numericChart: false,
  conductingInterview: false,
  educationalAssistantExplanation: false,
  immediateWriting: false,
  ...overrides,
});
const assess = (
  candidate: PublicCatalogItem,
  intent: PromptInterpretation,
  ops: RecommendationOperations,
  options: PromptOptions = {},
  evidence?: { tier?: number; source?: string },
) =>
  assessExpandedRecommendation({
    item: candidate,
    interpretation: intent,
    operations: ops,
    options,
    evidence,
    policy: refinementPolicy,
  });

describe('expanded deterministic operation and role refinements', () => {
  it('AC-PM.48: requires a matching source for companion-task evidence, while preserving explicit component transfers', () => {
    const candidate = item(['Report generation']);
    const intent = interpretation({
      tasks: ['Report generation'],
      sourceMaterials: ['survey'],
      desiredOutputs: ['analysis'],
    });
    expect(
      assess(
        candidate,
        intent,
        operations(),
        {},
        { tier: 1, source: 'spreadsheet' },
      ).allowed,
    ).toBe(false);
    expect(
      assess(candidate, intent, operations(), {}, { tier: 1, source: 'survey' })
        .allowed,
    ).toBe(true);
    expect(
      assess(
        candidate,
        intent,
        operations(),
        {},
        { tier: 2, source: 'spreadsheet' },
      ).allowed,
    ).toBe(true);
  });
  it('AC-PM.48: recognizes numeric chart requests without turning a source chart or negated chart into an output demand', () => {
    const intent = interpretation({
      tasks: ['Survey analysis'],
      desiredOutputs: ['analysis'],
    });
    expect(
      recommendationOperations(
        'Please graph the mean satisfaction scores.',
        intent,
        refinementPolicy,
      ).numericChart,
    ).toBe(true);
    expect(
      recommendationOperations(
        'Summarize the feedback; do not create a bar chart of average scores.',
        intent,
        refinementPolicy,
      ).numericChart,
    ).toBe(false);
    expect(
      recommendationOperations(
        'We have a graph of average scores and need a narrative summary.',
        { ...intent, sourceMaterials: ['chart'], desiredOutputs: ['summary'] },
        refinementPolicy,
      ).numericChart,
    ).toBe(false);
  });
  it('AC-PM.48: keeps procedural chart components and rejects general or mention-only chart evidence', () => {
    const broad = item(['Survey analysis']);
    const chart = item(['Survey analysis', 'Chart creation']);
    const intent = interpretation({ tasks: ['Survey analysis'] });
    const taught: PromptOptions = {
      instructions: [
        {
          youtubeId: chart.youtubeId,
          task: 'Chart creation',
          form: 'walkthrough',
        },
      ],
    };
    expect(
      assess(broad, intent, operations({ numericChart: true }), taught).allowed,
    ).toBe(false);
    expect(
      assess(chart, intent, operations({ numericChart: true }), {
        instructions: [
          {
            youtubeId: chart.youtubeId,
            task: 'Chart creation',
            form: 'mentioned',
          },
        ],
      }).allowed,
    ).toBe(false);
    expect(
      assess(chart, intent, operations({ numericChart: true }), taught).allowed,
    ).toBe(true);
  });
  it('AC-PM.48: separates conducting an interview from preparing as a job applicant', () => {
    const intent = interpretation({
      tasks: ['Interview preparation', 'Research'],
    });
    const applicant = item(['Cover letter writing', 'Interview preparation']);
    const conducting = recommendationOperations(
      'We will interview a program director using their public statements.',
      intent,
      refinementPolicy,
    );
    expect(conducting.conductingInterview).toBe(true);
    expect(assess(applicant, intent, conducting).allowed).toBe(false);
    const job = recommendationOperations(
      'Research the employer before my interview for this analyst job.',
      intent,
      refinementPolicy,
    );
    expect(job.conductingInterview).toBe(false);
    expect(assess(applicant, intent, job).allowed).toBe(true);
  });
  it('AC-PM.48: distinguishes an educational agent explanation from course production without excluding a useful agent walkthrough', () => {
    const intent = interpretation({ learningFormats: ['explainer'] });
    const ops = recommendationOperations(
      'Explain the design tradeoffs of an assistant for a personalized course.',
      intent,
      refinementPolicy,
    );
    expect(ops.educationalAssistantExplanation).toBe(true);
    expect(
      assess(item(['Curriculum design', 'Lesson planning']), intent, ops)
        .allowed,
    ).toBe(false);
    expect(
      assess(item(['Custom assistants', 'Lesson planning']), intent, ops)
        .allowed,
    ).toBe(true);
  });
  it('AC-PM.48: rejects assistant setup for one-off drafting but permits an explicitly requested reusable helper', () => {
    const candidate = item(['Custom assistants', 'Document drafting']);
    const workflow: PromptOptions = {
      workflows: {
        artifacts: [],
        workflows: [
          {
            youtubeId: candidate.youtubeId,
            task: 'Custom assistants',
            source: 'context',
            output: 'assistant',
          },
        ],
      },
    };
    const oneOff = interpretation({ tasks: ['Reimbursement documentation'] });
    const ops = recommendationOperations(
      'Draft a letter from this outline.',
      oneOff,
      refinementPolicy,
    );
    expect(ops.immediateWriting).toBe(true);
    expect(assess(candidate, oneOff, ops, workflow).allowed).toBe(false);
    const setup = interpretation({
      tasks: ['Document drafting', 'Custom assistants'],
    });
    const setupOps = recommendationOperations(
      'Build a reusable assistant for these letters.',
      setup,
      refinementPolicy,
    );
    expect(setupOps.immediateWriting).toBe(false);
    expect(assess(candidate, setup, setupOps, workflow).allowed).toBe(true);
  });
});
