import { describe, expect, it } from 'vitest';
import { parsePublicCatalog } from '../contracts/publicCatalog';
import {
  recommendFromPrompt,
  type PromptRequest,
  type TaskInstruction,
} from './prompt';
import type { LearningFormatConfig } from './learningFormat';
import type { WorkflowConfig } from './workflow';

const catalog = parsePublicCatalog({
  schemaVersion: 1,
  catalogVersion: `sha256:${'c'.repeat(64)}`,
  tasks: ['AI policy', 'Presentation creation'],
  tools: [],
  functionAreas: [],
  adjacentTools: [],
  synonyms: [
    {
      alias: 'presentation',
      category: 'task',
      target: 'Presentation creation',
    },
    { alias: 'slides', category: 'task', target: 'Presentation creation' },
  ],
  items: [
    {
      youtubeId: 'formatTalk1',
      title: 'AI policy principles',
      tasks: ['AI policy'],
    },
    {
      youtubeId: 'formatDemo1',
      title: 'AI policy drafting',
      tasks: ['AI policy'],
    },
    {
      youtubeId: 'formatDeck1',
      title: 'Generate a slide deck',
      tasks: ['Presentation creation'],
    },
    {
      youtubeId: 'formatWalk1',
      title: 'Walk through a deck workflow',
      tasks: ['Presentation creation'],
    },
  ].map((row) => ({
    ...row,
    description: 'A fictional teaching example.',
    tools: [],
    functionAreas: [],
    addedAt: null,
    lengthSeconds: 240,
    status: 'active',
    startHere: false,
  })),
});
const learningFormats: LearningFormatConfig = {
  formats: [
    { id: 'demo', label: 'Demonstration', aliases: ['demo', 'demonstration'] },
    {
      id: 'walkthrough',
      label: 'Walkthrough',
      aliases: ['walkthrough', 'tutorial', 'step by step guide'],
    },
    {
      id: 'presentation',
      label: 'Presentation',
      aliases: ['presentation', 'talk'],
      ambiguousArtifact: true,
    },
    {
      id: 'explainer',
      label: 'Explainer',
      aliases: ['explainer'],
      ambiguousArtifact: true,
    },
  ],
  videos: [
    {
      youtubeId: 'formatTalk1',
      primary: 'presentation',
      secondary: ['explainer'],
    },
    { youtubeId: 'formatDemo1', primary: 'demo', secondary: ['walkthrough'] },
    { youtubeId: 'formatDeck1', primary: 'demo', secondary: ['walkthrough'] },
    { youtubeId: 'formatWalk1', primary: 'walkthrough', secondary: [] },
  ],
};
const instructions: TaskInstruction[] = [
  { youtubeId: 'formatTalk1', task: 'AI policy', form: 'explained' },
  { youtubeId: 'formatDemo1', task: 'AI policy', form: 'demonstrated' },
  {
    youtubeId: 'formatDeck1',
    task: 'Presentation creation',
    form: 'demonstrated',
  },
  {
    youtubeId: 'formatWalk1',
    task: 'Presentation creation',
    form: 'walkthrough',
  },
];
const workflows: WorkflowConfig = {
  artifacts: [
    { id: 'document', label: 'Document', aliases: ['document'], tasks: [] },
    {
      id: 'presentation',
      label: 'Slides',
      aliases: ['presentation', 'slides'],
      tasks: ['Presentation creation'],
    },
    {
      id: 'policy',
      label: 'Policy draft',
      aliases: ['AI policy'],
      tasks: ['AI policy'],
    },
  ],
  workflows: [
    {
      youtubeId: 'formatDeck1',
      source: 'document',
      output: 'presentation',
      task: 'Presentation creation',
    },
    {
      youtubeId: 'formatWalk1',
      source: 'document',
      output: 'presentation',
      task: 'Presentation creation',
    },
    {
      youtubeId: 'formatDemo1',
      source: 'document',
      output: 'policy',
      task: 'AI policy',
    },
  ],
};
const options = { instructions, workflows, learningFormats };
const run = (prompt: string, request: Partial<PromptRequest> = {}) =>
  recommendFromPrompt(catalog, { prompt, limit: 8, ...request }, options);

describe('learning format preference', () => {
  it('AC-PM.33: an unrecognized topic is not a request to browse any talk', () => {
    const result = run(
      'Show me a talk explaining what staff should and should not put into AI tools.',
    );
    expect(result.interpretation.learningFormats).toEqual(['presentation']);
    expect(result.recommendations).toEqual([]);
  });
  it('AC-PM.32: rejecting slide production does not govern a later talk request', () => {
    const result = run(
      "I don't need tips on creating slides. I want a short talk about AI policy.",
    );
    expect(result.interpretation.learningFormats).toEqual(['presentation']);
    expect(result.interpretation.tasks).toEqual(['AI policy']);
    expect(result.interpretation.desiredOutputs).toEqual([]);
    expect(result.recommendations[0].item.youtubeId).toBe('formatTalk1');
  });
  it('AC-PM.32: a negated lecture is not a positive presentation preference', () => {
    const result = run(
      'Show me a tutorial, not a presentation, about AI policy.',
    );
    expect(result.interpretation.learningFormats).toEqual(['walkthrough']);
    expect(result.interpretation.tasks).toEqual(['AI policy']);
    expect(result.interpretation.desiredOutputs).toEqual([]);
  });
  it.each([
    'Show me a presentation about AI policy.',
    'Presentation about AI policy.',
    'I want to watch a presentation on AI policy.',
  ])(
    'AC-PM.16: %s requests a format and topic, without slide creation',
    (prompt) => {
      const result = run(prompt);
      expect(result.interpretation).toMatchObject({
        learningFormats: ['presentation'],
        tasks: ['AI policy'],
        desiredOutputs: [],
      });
      expect(result.recommendations[0].item.youtubeId).toBe('formatTalk1');
      expect(result.recommendations.map((row) => row.item.youtubeId)).toEqual([
        'formatTalk1',
        'formatDemo1',
      ]);
    },
  );

  it.each([
    'Create a presentation about AI policy.',
    'I need a presentation about AI policy.',
    'Show me how to create a presentation about AI policy.',
  ])(
    'AC-PM.16: %s requests slide creation, without a presentation format preference',
    (prompt) => {
      const result = run(prompt);
      expect(result.interpretation.learningFormats).toEqual([]);
      expect(result.interpretation.desiredOutputs).toEqual(['presentation']);
      expect(result.recommendations[0].item.youtubeId).toBe('formatDeck1');
      expect(
        result.recommendations.some(
          (row) => row.item.youtubeId === 'formatDemo1',
        ),
      ).toBe(false);
    },
  );

  it('AC-PM.16: a presentation can also be source material', () => {
    const result = run(
      'I have a presentation and need to turn it into a document.',
    );
    expect(result.interpretation.learningFormats).toEqual([]);
    expect(result.interpretation.sourceMaterials).toEqual(['presentation']);
    expect(result.interpretation.desiredOutputs).toEqual(['document']);
    expect(result.interpretation.tasks).not.toContain('Presentation creation');
  });

  it('AC-PM.17: format preference can change a relevant tie without overriding workflow fit', () => {
    const neutral = run('Turn a document into slides.');
    const preferred = run(
      'Show me a walkthrough of turning a document into slides.',
    );
    expect(neutral.recommendations[0].item.youtubeId).toBe('formatDeck1');
    expect(preferred.interpretation).toMatchObject({
      learningFormats: ['walkthrough'],
      sourceMaterials: ['document'],
      desiredOutputs: ['presentation'],
      keywords: [],
    });
    expect(preferred.recommendations[0].item.youtubeId).toBe('formatWalk1');
    expect(preferred.recommendations[1].evidence.learningFormat.affinity).toBe(
      0.5,
    );
    expect(
      preferred.recommendations.some(
        (row) => row.item.youtubeId === 'formatDemo1',
      ),
    ).toBe(false);
  });

  it('AC-PM.17: an explicit field overrides the inferred preference', () => {
    const result = run(
      'Show me a walkthrough of turning a document into slides.',
      { learningFormat: 'demo' },
    );
    expect(result.interpretation.learningFormats).toEqual(['demo']);
    expect(result.recommendations[0].item.youtubeId).toBe('formatDeck1');
  });

  it('AC-PM.17: a demo can teach presentation creation without being a presentation', () => {
    const result = run('Show me a demo of how to create slides.');
    expect(result.interpretation).toMatchObject({
      learningFormats: ['demo'],
      desiredOutputs: ['presentation'],
    });
    expect(result.recommendations[0].item.youtubeId).toBe('formatDeck1');
  });

  it('AC-PM.17: stronger keyword relevance precedes format in lexical discovery', () => {
    const result = run('Show me a presentation about fictional drafting.');
    expect(result.recommendations[0].item.youtubeId).toBe('formatDemo1');
    expect(result.recommendations[0].evidence.kind).toBe('keyword');
  });

  it('AC-PM.17: a format request alone browses that format', () => {
    const result = run('Show me a demo.');
    expect(result.recommendations.map((row) => row.item.youtubeId)).toEqual([
      'formatDeck1',
      'formatDemo1',
    ]);
    expect(
      result.recommendations.every(
        (row) => row.evidence.kind === 'format' && row.matchType === 'fallback',
      ),
    ).toBe(true);
  });

  it('AC-PM.18: absent preferences and unknown metadata receive no format credit', () => {
    const neutral = run('Turn a document into slides.');
    const without = recommendFromPrompt(
      catalog,
      { prompt: 'Turn a document into slides.', limit: 8 },
      { instructions, workflows },
    );
    expect(neutral.recommendations.map((row) => row.item.youtubeId)).toEqual(
      without.recommendations.map((row) => row.item.youtubeId),
    );
    expect(
      neutral.recommendations.every(
        (row) => row.evidence.learningFormat.affinity === 0,
      ),
    ).toBe(true);
    const unknown = recommendFromPrompt(
      catalog,
      { prompt: 'Show me a presentation about AI policy.' },
      { instructions },
    );
    expect(unknown.interpretation.learningFormats).toEqual(['presentation']);
    expect(unknown.recommendations[0].evidence.learningFormat).toMatchObject({
      primary: null,
      affinity: 0,
    });
  });

  it('AC-PM.18: order changes do not mutate or change the results', () => {
    const snapshot = JSON.stringify(options);
    const request = {
      prompt: 'Show me a walkthrough of turning a document into slides.',
      limit: 8,
    };
    const reversed = {
      ...options,
      learningFormats: {
        formats: [...learningFormats.formats].reverse().map((format) => ({
          ...format,
          aliases: [...format.aliases].reverse(),
        })),
        videos: [...learningFormats.videos].reverse(),
      },
    };
    expect(recommendFromPrompt(catalog, request, reversed)).toEqual(
      recommendFromPrompt(catalog, request, options),
    );
    expect(JSON.stringify(options)).toBe(snapshot);
  });

  it.each([
    {
      ...learningFormats,
      videos: [...learningFormats.videos, learningFormats.videos[0]],
    },
    {
      ...learningFormats,
      videos: [{ ...learningFormats.videos[0], youtubeId: 'unknown0001' }],
    },
    {
      ...learningFormats,
      videos: [
        { ...learningFormats.videos[0], secondary: ['presentation' as const] },
      ],
    },
    {
      ...learningFormats,
      formats: [...learningFormats.formats, learningFormats.formats[0]],
    },
  ])(
    'AC-PM.18: invalid or duplicate format references fail validation',
    (metadata) => {
      expect(() =>
        recommendFromPrompt(
          catalog,
          { prompt: '' },
          { learningFormats: metadata },
        ),
      ).toThrow();
    },
  );
});
