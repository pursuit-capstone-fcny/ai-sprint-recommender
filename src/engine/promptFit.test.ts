import { describe, expect, it } from 'vitest';
import { parsePublicCatalog } from '../contracts/publicCatalog';
import { preparePromptFit } from './promptFit';
import { promptWords, type PromptLanguage } from './promptLanguage';
import { promptPolarity } from './promptPolarity';

const catalog = parsePublicCatalog({
  schemaVersion: 1,
  catalogVersion: `sha256:${'f'.repeat(64)}`,
  tasks: [
    'Role play',
    'Lesson planning',
    'Language learning',
    'Data structuring',
  ],
  tools: [],
  functionAreas: [],
  synonyms: [],
  adjacentTools: [],
  items: [
    {
      youtubeId: 'fitLanguage',
      tasks: ['Role play', 'Lesson planning', 'Language learning'],
      description: 'Practice a language conversation.',
    },
    {
      youtubeId: 'fitGeneral1',
      tasks: ['Role play', 'Lesson planning'],
      description: 'Plan general lessons and rehearse workplace conversations.',
    },
    {
      youtubeId: 'fitColumn01',
      tasks: ['Data structuring'],
      description: 'Separate unstructured names into columns.',
    },
    {
      youtubeId: 'fitForm0001',
      tasks: ['Data structuring'],
      description: 'Capture quick contacts in a form.',
    },
  ].map((item) => ({
    ...item,
    title: 'Fictional example',
    tools: [],
    functionAreas: [],
    addedAt: null,
    lengthSeconds: 100,
    status: 'active',
    startHere: false,
  })),
});
const language: PromptLanguage = {
  tasks: [],
  artifacts: [],
  candidateConstraints: [
    {
      whenTasks: ['Role play', 'Lesson planning'],
      excludeTasks: ['Language learning'],
      unlessContext: ['language practice'],
    },
    {
      whenTasks: ['Data structuring'],
      contextAll: [
        ['split', 'separate'],
        ['cell', 'pasted'],
      ],
      teachingAny: ['column', 'unstructured'],
    },
  ],
  unsupportedIntents: [
    {
      contextAll: [['guaranteed approval']],
      unlessContext: ['myth', 'why'],
      message: 'Cannot establish guaranteed outcomes.',
    },
  ],
};
const fit = (text: string, tasks: string[], config = language) =>
  preparePromptFit(
    catalog,
    promptPolarity(promptWords(text)).positiveWords,
    tasks,
    config,
  );

describe('bounded relevance constraints', () => {
  it('AC-PM.42: workflow eligibility checks the selected step, source and instruction rather than an unrelated item tag', () => {
    const config: PromptLanguage = {
      tasks: [],
      artifacts: [],
      workflowConstraints: [
        {
          task: 'Data structuring',
          contextAll: [['worksheet']],
          allowedSources: ['context'],
          requireProcedure: true,
          teachingAny: ['column'],
        },
      ],
    };
    const evidence = {
      artifactIds: ['context', 'document'],
      instructionForm: (id: string) =>
        id === 'fitColumn01' ? 'walkthrough' : 'explained',
    };
    const result = preparePromptFit(
      catalog,
      promptWords('Make a worksheet.'),
      ['Data structuring'],
      config,
      evidence,
    );
    const flow = {
      youtubeId: 'fitColumn01',
      source: 'context',
      output: 'document',
      task: 'Data structuring',
    };
    expect(result.allowsWorkflow(flow)).toBe(true);
    expect(result.allowsWorkflow({ ...flow, source: 'document' })).toBe(false);
    expect(result.allowsWorkflow({ ...flow, youtubeId: 'fitForm0001' })).toBe(
      false,
    );
    expect(
      preparePromptFit(
        catalog,
        promptWords('Make a worksheet.'),
        ['Data structuring'],
        config,
      ).allowsWorkflow(flow),
    ).toBe(false);
  });
  it('AC-PM.42: topic-format constraints can yield to an explicit production output', () => {
    const config: PromptLanguage = {
      tasks: [],
      artifacts: [],
      candidateConstraints: [
        {
          whenTasks: ['Role play'],
          excludeTasks: ['Language learning'],
          unlessOutputs: ['document'],
        },
      ],
    };
    const result = preparePromptFit(
      catalog,
      promptWords('Practice a role.'),
      ['Role play'],
      config,
      { artifactIds: ['document'], requestedOutputs: ['document'] },
    );
    expect(result.allows(catalog.items[0])).toBe(true);
    expect(
      preparePromptFit(
        catalog,
        promptWords('Practice a role.'),
        ['Role play'],
        config,
      ).allows(catalog.items[0]),
    ).toBe(false);
  });
  it.each(['Role play', 'Lesson planning'])(
    'AC-PM.38: generic %s does not imply specialist language tutoring',
    (task) => {
      const generic = fit('Help with workplace practice.', [task]);
      expect(generic.allows(catalog.items[0])).toBe(false);
      expect(generic.allows(catalog.items[1])).toBe(true);
      expect(
        fit('Help with language practice.', [task]).allows(catalog.items[0]),
      ).toBe(true);
    },
  );
  it('AC-PM.38: a task/topic constraint requires matching teaching content', () => {
    const result = fit('Split the pasted names from a cell.', [
      'Data structuring',
    ]);
    expect(result.allows(catalog.items[2])).toBe(true);
    expect(result.allows(catalog.items[3])).toBe(false);
    expect(
      fit('We do not need to split the pasted names.', [
        'Data structuring',
      ]).allows(catalog.items[3]),
    ).toBe(true);
  });
  it('AC-PM.39: unsupported outcomes are distinct from negation and discussion', () => {
    expect(fit('I need guaranteed approval.', []).warnings).toHaveLength(1);
    expect(fit('I do not need guaranteed approval.', []).warnings).toEqual([]);
    expect(
      fit('Explain why guaranteed approval is a myth.', []).warnings,
    ).toEqual([]);
  });
  it('AC-PM.38/39: rules are order-independent and inputs remain unchanged', () => {
    const snapshot = JSON.stringify({ catalog, language });
    const reversed = {
      ...language,
      candidateConstraints: [
        ...(language.candidateConstraints ?? []),
      ].reverse(),
    };
    for (const item of catalog.items)
      expect(
        fit('Split pasted names.', ['Data structuring'], reversed).allows(item),
      ).toBe(fit('Split pasted names.', ['Data structuring']).allows(item));
    expect(JSON.stringify({ catalog, language })).toBe(snapshot);
  });
  it.each([
    {
      ...language,
      candidateConstraints: [
        { whenTasks: ['Unknown task'], excludeTasks: ['Language learning'] },
      ],
    },
    { ...language, candidateConstraints: [{ teachingAny: [''] }] },
    {
      ...language,
      candidateConstraints: [
        { contextAll: [[]], excludeTasks: ['Language learning'] },
      ],
    },
    {
      ...language,
      unsupportedIntents: [{ contextAll: [], message: 'Unsupported' }],
    },
    {
      ...language,
      workflowConstraints: [
        {
          task: 'Unknown task',
          contextAll: [['worksheet']],
          requireProcedure: true,
        },
      ],
    },
    { ...language, candidateConstraints: [{ requireTools: ['Unknown tool'] }] },
    {
      ...language,
      candidateConstraints: [{ proceduralTasks: ['Unknown task'] }],
    },
  ])(
    'AC-PM.38/39: invalid configuration fails rather than silently filtering',
    (config) => {
      expect(() => fit('', [], config)).toThrow();
    },
  );
});
