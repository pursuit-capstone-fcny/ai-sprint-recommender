import { expect, it } from 'vitest';
import { parsePublicCatalog } from '../contracts/publicCatalog';
import { recommendVideos } from '../engine/deterministicPrompt';
import { deterministicCatalog } from './deterministicCatalog';
import { deterministicSelection } from './deterministicSelection';
import { workflows } from '../engine/promptConfig/workflows';

const catalog = parsePublicCatalog({
  schemaVersion: 1,
  catalogVersion: `sha256:${'c'.repeat(64)}`,
  functionAreas: ['Communications', 'Fundraising'],
  tasks: ['presentation creation', 'fundraising copy'],
  tools: ['ChatGPT'],
  synonyms: [
    { alias: 'Fictional Writer', category: 'tool', target: 'ChatGPT' },
  ],
  adjacentTools: [],
  items: [
    {
      youtubeId: 'fictionsl01',
      title: 'Fictional slide creation walkthrough',
      description:
        'Use ChatGPT to outline a presentation, refine it and build a slide deck from the outline.',
      tasks: ['presentation creation'],
      functionAreas: ['Communications'],
      tools: ['ChatGPT'],
      status: 'active',
      startHere: false,
      addedAt: null,
      lengthSeconds: 120,
    },
    {
      youtubeId: 'fictionfr01',
      title: 'Fictional fundraising writing walkthrough',
      description: 'Draft a fundraising appeal letter.',
      tasks: ['fundraising copy'],
      functionAreas: ['Fundraising'],
      tools: ['ChatGPT'],
      status: 'active',
      startHere: true,
      addedAt: null,
      lengthSeconds: 120,
    },
  ],
});

const select = (goal: string) =>
  deterministicSelection(catalog, goal, {
    functionArea: null,
    goalWords: goal.split(' '),
    tools: [],
  });

it.each([
  'I want to create a slide deck to support my fundraising goal',
  'Create a slide deck',
  'Create a presentation',
  'Create slides',
  'Build slides for a fundraising campaign',
  'Make a slide deck for donors',
  'Draft a presentation for the board',
  'Generate a slideshow',
  'Design a slide presentation',
  'Create a slide deck, with a friendly tone',
  'Create a slide deck using not only ChatGPT but also Claude',
  'Create a slide deck image and draft a presentation for donors',
])('AC-12.22: recognizes ordinary presentation creation: %s', (goal) => {
  const result = select(goal);
  expect(result.results.map((row) => row.item.youtubeId)).toEqual([
    'fictionsl01',
  ]);
  expect(result.results[0].item.tasks).toEqual(['presentation creation']);
});

it.each([
  'Create a slide deck image',
  'Create a slide deck summary',
  'Create a presentation logo',
  'Create an image for a slide deck',
  'Summarize a slide deck',
  'Review a presentation',
  'Do not create a slide deck. Repair a bicycle instead.',
  'Create a slide deck without using ChatGPT',
  'Create a slide deck using only mailchimp',
  'Create a slide deck in excel only',
  'Create a slide deck using only ChatGPT',
  'Create a slide deck offline only',
  'Create a slide deck that works offline',
  'Build a wooden deck for our office',
])(
  'AC-12.22: preserves presentation scope and explicit constraints: %s',
  (goal) => {
    expect(select(goal).results).toEqual([]);
  },
);

it.each([
  ['Use ChatGPT to outline a presentation and build the slide deck.', 0],
  [
    'Use Fictional Writer to outline a presentation and build the slide deck.',
    0,
  ],
  ['Use an assistant to outline a presentation without using ChatGPT.', 1],
] as const)(
  'AC-12.22: honors explicit public tool evidence despite missing tags: %s',
  (description, count) => {
    const source = {
      ...catalog,
      items: [{ ...catalog.items[0], tools: [], description }],
    };
    const result = recommendVideos(deterministicCatalog(source), {
      prompt: 'Create a slide deck without using ChatGPT',
    });
    expect(result.recommendations).toHaveLength(count);
  },
);

it.each([
  ['mentioned', 0],
  ['walkthrough', 1],
] as const)('AC-12.22: requires instructional evidence: %s', (form, count) => {
  const result = recommendVideos(
    deterministicCatalog(catalog),
    { prompt: 'Create a slide deck' },
    {
      instructions: [
        { youtubeId: 'fictionsl01', task: 'Presentation creation', form },
      ],
    },
  );
  expect(result.recommendations).toHaveLength(count);
});

it.each([
  ['Create slides from a document', 1],
  ['Create a slide deck from an audio recording', 0],
] as const)(
  'AC-12.22: retains explicit source compatibility: %s',
  (prompt, count) => {
    const result = recommendVideos(
      deterministicCatalog(catalog),
      { prompt },
      {
        workflows: {
          ...workflows,
          workflows: [
            {
              youtubeId: 'fictionsl01',
              task: 'Presentation creation',
              source: 'document',
              output: 'presentation',
            },
          ],
        },
      },
    );
    expect(result.recommendations).toHaveLength(count);
    if (count)
      expect(result.recommendations[0].reason).toContain(
        'document → presentation',
      );
  },
);
