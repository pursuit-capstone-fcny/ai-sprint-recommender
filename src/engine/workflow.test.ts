import { describe, expect, it } from 'vitest';
import { parsePublicCatalog } from '../contracts/publicCatalog';
import { recommendFromPrompt } from './prompt';
import type { WorkflowConfig } from './workflow';

const ids = [
  'flowForward',
  'flowReverse',
  'flowSummary',
  'flowReview1',
  'flowDataPpt',
  'flowCase123',
  'flowMixed12',
];
const tasks = [
  'Presentation creation',
  'Document summary',
  'Document drafting',
];
const source = parsePublicCatalog({
  schemaVersion: 1,
  catalogVersion: `sha256:${'b'.repeat(64)}`,
  tasks,
  tools: [],
  functionAreas: [],
  adjacentTools: [],
  synonyms: [
    { alias: 'presentation', category: 'task', target: tasks[0] },
    { alias: 'slides', category: 'task', target: tasks[0] },
    { alias: 'summary', category: 'task', target: tasks[1] },
    { alias: 'summarize', category: 'task', target: tasks[1] },
  ],
  items: ids.map((youtubeId) => ({
    youtubeId,
    title: 'A short long document presentation',
    description: 'Fictional source and output workflows for a board.',
    functionAreas: [],
    tasks,
    tools: [],
    addedAt: null,
    lengthSeconds: 100,
    status: 'active',
    startHere: false,
  })),
});

const workflows: WorkflowConfig = {
  artifacts: [
    {
      id: 'document',
      label: 'Written document',
      aliases: ['document', 'report'],
      tasks: [tasks[2]],
    },
    {
      id: 'presentation',
      label: 'Slides',
      aliases: ['presentation', 'slides', 'slide deck'],
      tasks: [tasks[0]],
      supports: ['summary'],
    },
    {
      id: 'summary',
      label: 'Summary',
      aliases: ['summary'],
      verbs: ['summarize'],
      tasks: [tasks[1]],
    },
    { id: 'data', label: 'Survey data', aliases: ['survey data'], tasks: [] },
    {
      id: 'context',
      label: 'Brief instruction',
      aliases: ['instruction'],
      tasks: [],
    },
    { id: 'notes', label: 'Case note', aliases: ['case note'], tasks: [] },
  ],
  workflows: [
    {
      youtubeId: ids[0],
      source: 'document',
      output: 'presentation',
      task: tasks[0],
    },
    {
      youtubeId: ids[1],
      source: 'presentation',
      output: 'document',
      task: tasks[2],
    },
    {
      youtubeId: ids[2],
      source: 'presentation',
      output: 'summary',
      task: tasks[1],
    },
    {
      youtubeId: ids[3],
      source: 'document',
      output: 'presentation',
      task: tasks[0],
      stage: 'review',
    },
    {
      youtubeId: ids[4],
      source: 'data',
      output: 'presentation',
      task: tasks[0],
    },
    { youtubeId: ids[5], source: 'context', output: 'notes', task: tasks[2] },
    {
      youtubeId: ids[6],
      source: 'document',
      output: 'summary',
      task: tasks[1],
    },
    {
      youtubeId: ids[6],
      source: 'data',
      output: 'presentation',
      task: tasks[0],
    },
  ],
};

function run(prompt: string, config = workflows) {
  return recommendFromPrompt(
    source,
    { prompt, limit: 20 },
    { workflows: config },
  );
}

describe('source/output prompt interpretation', () => {
  it('AC-PM.28: understanding an introductory workflow can prefer prepared-output review', () => {
    const result = run(
      'I want to understand an introductory document-to-slides setup.',
    );
    expect(result.recommendations[0].item.youtubeId).toBe(ids[3]);
    expect(result.recommendations[0].evidence.workflow?.relation).toBe(
      'output-review',
    );
  });
  it.each([
    'Turn a document into a presentation.',
    'Create slides from a report.',
    'Create slides using a report.',
    'Create slides based on a report.',
    'I have a long document and need to turn it into a short presentation for our board.',
    'document to slides',
  ])('AC-PM.12: interprets the direction of %s', (prompt) => {
    const result = run(prompt);
    expect(result.interpretation.sourceMaterials).toEqual(['document']);
    expect(result.interpretation.desiredOutputs).toEqual(['presentation']);
    expect(result.recommendations[0].item.youtubeId).toBe(ids[0]);
  });

  it('AC-PM.12: reversing source and output changes the winning workflow', () => {
    const result = run('Turn a presentation into a document.');
    expect(result.interpretation.sourceMaterials).toEqual(['presentation']);
    expect(result.interpretation.desiredOutputs).toEqual(['document']);
    expect(result.interpretation.tasks).not.toContain(tasks[0]);
    expect(result.recommendations[0].item.youtubeId).toBe(ids[1]);
  });

  it('AC-PM.12: summarize names the output while its object is the source', () => {
    const result = run('Summarize a presentation.');
    expect(result.interpretation.sourceMaterials).toEqual(['presentation']);
    expect(result.interpretation.desiredOutputs).toEqual(['summary']);
    expect(result.interpretation.tasks).toEqual([tasks[1]]);
    expect(result.recommendations[0].item.youtubeId).toBe(ids[2]);
  });

  it('AC-PM.12: a summary of a presentation requests a summary rather than new slides', () => {
    const result = run('Create a summary of a presentation.');
    expect(result.interpretation.sourceMaterials).toEqual(['presentation']);
    expect(result.interpretation.desiredOutputs).toEqual(['summary']);
    expect(result.interpretation.tasks).toEqual([tasks[1]]);
    expect(result.recommendations[0].item.youtubeId).toBe(ids[2]);
  });

  it('AC-PM.12: source dimensions are not promoted to desired tasks through their aliases', () => {
    const result = run('I have a presentation and need a summary.');
    expect(result.interpretation.tasks).toEqual([tasks[1]]);
    expect(result.recommendations[0].item.youtubeId).toBe(ids[2]);
  });

  it('AC-PM.13: modifiers do not create relevance for a different output', () => {
    const result = run(
      'Turn a long document into a short presentation for the board.',
    );
    expect(result.interpretation.keywords).toEqual(['board']);
    expect(
      result.recommendations.some((match) => match.item.youtubeId === ids[5]),
    ).toBe(false);
  });

  it('AC-PM.13: review, preparation and different starting material are labeled as fallbacks', () => {
    const result = run('Turn a document into slides.');
    const review = result.recommendations.find(
      (match) => match.item.youtubeId === ids[3],
    );
    expect(review?.evidence.workflow?.relation).toBe('output-review');
    expect(review?.matchType).toBe('fallback');
    const alternative = result.recommendations.find(
      (match) => match.item.youtubeId === ids[4],
    );
    expect(alternative?.evidence.workflow?.relation).toBe('alternative-source');
    expect(alternative?.evidence.workflow?.sourceMatch).toBe(false);
    expect(alternative?.matchType).toBe('fallback');
    expect(result.recommendations[0].matchType).toBe('strong');
  });

  it('AC-PM.13: two different pairs cannot be combined into an invented transformation', () => {
    const mixed = run('Turn a document into slides.').recommendations.find(
      (match) => match.item.youtubeId === ids[6],
    );
    expect(mixed?.evidence.workflow?.relation).toBe('preparation');
    expect(mixed?.evidence.workflow?.output).toBe('summary');
    expect(mixed?.matchType).toBe('fallback');
  });

  it('AC-PM.13: an unspecified source is not claimed as a confirmed source match', () => {
    const result = run('Make slides.');
    expect(result.interpretation.sourceMaterials).toEqual([]);
    expect(result.recommendations[0].evidence.workflow?.sourceMatch).toBe(
      false,
    );
    expect(result.recommendations[0].reason).toContain('example starts with');
  });

  it('AC-PM.13: mention-only tasks cannot establish workflow evidence', () => {
    const result = recommendFromPrompt(
      source,
      { prompt: 'Turn a document into slides.' },
      {
        workflows,
        instructions: [
          { youtubeId: ids[0], task: tasks[0], form: 'mentioned' },
        ],
      },
    );
    expect(
      result.recommendations.some((match) => match.item.youtubeId === ids[0]),
    ).toBe(false);
  });

  it('AC-PM.14: rejects invalid pair references and duplicate pairs', () => {
    expect(() =>
      run('slides', {
        ...workflows,
        workflows: [...workflows.workflows, workflows.workflows[0]],
      }),
    ).toThrow('Invalid or duplicate');
    expect(() =>
      run('slides', {
        ...workflows,
        workflows: [{ ...workflows.workflows[0], source: 'unknown' }],
      }),
    ).toThrow('Invalid or duplicate');
  });

  it('AC-PM.14: reordered metadata gives identical results without mutation', () => {
    const original = JSON.stringify(workflows);
    expect(
      run('Turn a document into slides.', {
        artifacts: [...workflows.artifacts].reverse(),
        workflows: [...workflows.workflows].reverse(),
      }),
    ).toEqual(run('Turn a document into slides.'));
    expect(JSON.stringify(workflows)).toBe(original);
  });
});
