import { describe, expect, it } from 'vitest';
import { parsePublicCatalog } from '../contracts/publicCatalog';
import { recommendFromPrompt } from './prompt';
import type { PromptLanguage } from './promptLanguage';
import type { WorkflowConfig } from './workflow';

const catalog = parsePublicCatalog({
  schemaVersion: 1,
  catalogVersion: `sha256:${'d'.repeat(64)}`,
  tasks: [
    'Editing proofreading',
    'Document summary',
    'Presentation creation',
    'App building',
  ],
  tools: ['Example Writer'],
  functionAreas: [],
  adjacentTools: [],
  synonyms: [
    { alias: 'slides', category: 'task', target: 'Presentation creation' },
    {
      alias: 'presentation',
      category: 'task',
      target: 'Presentation creation',
    },
  ],
  items: [
    { youtubeId: 'naturalEdit', tasks: ['Editing proofreading'] },
    { youtubeId: 'naturalSum1', tasks: ['Document summary'] },
    { youtubeId: 'naturalDeck', tasks: ['Presentation creation'] },
    { youtubeId: 'naturalApp1', tasks: ['App building'] },
  ].map((row) => ({
    ...row,
    title: 'Fictional teaching example',
    description: 'A fictional workflow.',
    tools: ['Example Writer'],
    functionAreas: [],
    status: 'active',
    startHere: false,
    addedAt: null,
    lengthSeconds: 100,
  })),
});
const language: PromptLanguage = {
  tasks: [
    {
      task: 'Editing proofreading',
      phrases: ['proofread', 'add comments'],
      context: ['document', 'report'],
      outputs: ['edited'],
    },
    {
      task: 'Document summary',
      phrases: ['summarize', 'condense'],
      outputs: ['summary'],
    },
    {
      task: 'App building',
      phrases: ['build an app', 'build a prototype'],
      outputs: ['app'],
      implicitSource: 'context',
    },
  ],
  artifacts: [
    { artifact: 'document', aliases: ['annual statement'] },
    {
      artifact: 'edited',
      aliases: ['tracked changes'],
      inputVerbs: ['proofread'],
    },
  ],
};
const workflows: WorkflowConfig = {
  artifacts: [
    {
      id: 'document',
      label: 'Document',
      aliases: ['document', 'report'],
      tasks: [],
    },
    {
      id: 'summary',
      label: 'Summary',
      aliases: ['summary'],
      tasks: ['Document summary'],
      verbs: ['summarize'],
    },
    {
      id: 'presentation',
      label: 'Slides',
      aliases: ['presentation', 'slides'],
      tasks: ['Presentation creation'],
    },
    {
      id: 'edited',
      label: 'Edited document',
      aliases: ['edited document'],
      tasks: ['Editing proofreading'],
    },
    {
      id: 'app',
      label: 'App',
      aliases: ['app', 'prototype'],
      tasks: ['App building'],
    },
    { id: 'context', label: 'Work brief', aliases: ['work brief'], tasks: [] },
  ],
  workflows: [
    {
      youtubeId: 'naturalEdit',
      source: 'document',
      output: 'edited',
      task: 'Editing proofreading',
    },
    {
      youtubeId: 'naturalSum1',
      source: 'document',
      output: 'summary',
      task: 'Document summary',
    },
    {
      youtubeId: 'naturalDeck',
      source: 'document',
      output: 'presentation',
      task: 'Presentation creation',
    },
    {
      youtubeId: 'naturalApp1',
      source: 'context',
      output: 'app',
      task: 'App building',
    },
  ],
};
const run = (prompt: string, vocabulary = language) =>
  recommendFromPrompt(
    catalog,
    { prompt, limit: 8 },
    { language: vocabulary, workflows },
  );

describe('natural task language and local material roles', () => {
  it.each([
    "I have a report. I don't need a slide deck; summarize the document.",
    "I have a report. I'm not trying to create another presentation, summarize the document.",
    'Summarize the report rather than build an app.',
    'Without creating a presentation or building an app, summarize the report.',
  ])(
    'AC-PM.32: negated alternatives cannot produce materials in %s',
    (prompt) => {
      const result = run(prompt);
      expect(result.interpretation.tasks).toEqual(['Document summary']);
      expect(result.interpretation.desiredOutputs).toEqual(['summary']);
      expect(result.recommendations.map((row) => row.item.youtubeId)).toEqual([
        'naturalSum1',
      ]);
    },
  );
  it('AC-PM.32: not-only coordination retains both affirmative requests', () => {
    const result = run('Not only create slides but summarize this report.');
    expect(result.interpretation.excludedTasks).toEqual([]);
    expect(result.interpretation.tasks).toEqual([
      'Document summary',
      'Presentation creation',
    ]);
  });
  it('AC-PM.32: a negated material cannot suppress a separately requested result of the same task', () => {
    const result = run(
      'Summarize the report, not another summary of the document.',
    );
    expect(result.interpretation.tasks).toContain('Document summary');
    expect(result.interpretation.sourceMaterials).toEqual(['document']);
  });
  it.each([
    'I have a report. Use Example Writer to proofread it and return tracked changes.',
    'I have a document. Using Example Writer, proofread it and add comments.',
    'I have an annual statement. Proofread the report using Example Writer.',
  ])(
    'AC-PM.24/25: %s keeps the source, tool and editing result distinct',
    (prompt) => {
      const result = run(prompt);
      expect(result.interpretation).toMatchObject({
        tasks: ['Editing proofreading'],
        tools: ['Example Writer'],
        sourceMaterials: ['document'],
        desiredOutputs: ['edited'],
      });
      expect(result.recommendations[0].item.youtubeId).toBe('naturalEdit');
    },
  );
  it('AC-PM.24: a shared action needs its task context', () => {
    expect(
      run('Add comments to this code.').interpretation.tasks,
    ).not.toContain('Editing proofreading');
    expect(run('Add comments to this report.').interpretation.tasks).toContain(
      'Editing proofreading',
    );
  });
  it('AC-PM.24: ordinary inflections share the same alias', () => {
    const result = run(
      'I have a work brief and need help building a prototype.',
    );
    expect(result.interpretation.tasks).toContain('App building');
    expect(result.recommendations[0].item.youtubeId).toBe('naturalApp1');
  });
  it('AC-PM.25: sentence boundaries prevent a tool phrase reversing later outputs', () => {
    const result = run(
      'I have a report. Create a summary. Using Example Writer, create slides.',
    );
    expect(result.interpretation.sourceMaterials).toEqual(['document']);
    expect(result.interpretation.desiredOutputs).toEqual([
      'presentation',
      'summary',
    ]);
  });
  it('AC-PM.25: clarification is not a request for a question-answer artifact', () => {
    const result = run(
      'I have a document. Ask clarifying questions before creating slides.',
    );
    expect(result.interpretation.desiredOutputs).toEqual(['presentation']);
  });
  it('AC-PM.25: a source deck is not a request to create slides', () => {
    const result = run('I have a presentation and need to summarize it.');
    expect(result.interpretation.tasks).toEqual(['Document summary']);
    expect(result.interpretation.sourceMaterials).toEqual(['presentation']);
    expect(result.interpretation.desiredOutputs).toEqual(['summary']);
  });
  it('AC-PM.24/25: exclusions apply to natural aliases and action outputs', () => {
    const result = run('I have a report. Do not proofread the document.');
    expect(result.interpretation.tasks).not.toContain('Editing proofreading');
    expect(result.interpretation.excludedTasks).toContain(
      'Editing proofreading',
    );
    expect(result.interpretation.desiredOutputs).not.toContain('edited');
  });
  it('AC-PM.24/25: rule ordering does not change results or mutate vocabulary', () => {
    const snapshot = JSON.stringify(language);
    const reversed = {
      tasks: [...language.tasks]
        .reverse()
        .map((rule) => ({ ...rule, phrases: [...rule.phrases].reverse() })),
      artifacts: [...language.artifacts].reverse(),
    };
    expect(
      run('I have a report. Proofread it and create a summary.', reversed),
    ).toEqual(run('I have a report. Proofread it and create a summary.'));
    expect(JSON.stringify(language)).toBe(snapshot);
  });
  it.each([
    { ...language, tasks: [...language.tasks, language.tasks[0]] },
    { ...language, tasks: [{ task: 'Unknown task', phrases: ['test'] }] },
    { ...language, tasks: [{ ...language.tasks[0], contextWindow: -1 }] },
    { ...language, tasks: [{ ...language.tasks[0], outputs: ['unknown'] }] },
    { ...language, tasks: [{ ...language.tasks[0], contextAll: [[]] }] },
    { ...language, tasks: [{ ...language.tasks[0], preference: true }] },
    {
      ...language,
      taskSupports: [
        {
          requestedTask: 'Unknown task',
          taughtTask: 'Document summary',
          outputs: ['summary'],
        },
      ],
    },
    {
      ...language,
      taskSupports: [
        {
          requestedTask: 'Editing proofreading',
          taughtTask: 'Document summary',
          outputs: ['unknown'],
        },
      ],
    },
  ])('AC-PM.24: rejects invalid language references and guards', (metadata) => {
    expect(() => run('', metadata)).toThrow();
  });
});
