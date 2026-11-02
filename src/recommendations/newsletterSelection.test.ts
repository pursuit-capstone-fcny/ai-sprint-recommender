import { expect, it } from 'vitest';
import { parsePublicCatalog } from '../contracts/publicCatalog';
import { deterministicSelection } from './deterministicSelection';
import { deterministicCatalog } from './deterministicCatalog';
import { recommendVideos } from '../engine/deterministicPrompt';

const catalog = parsePublicCatalog({
  schemaVersion: 1,
  catalogVersion: `sha256:${'b'.repeat(64)}`,
  functionAreas: ['Communications'],
  tasks: ['newsletter drafting'],
  tools: ['ChatGPT', 'Excel'],
  synonyms: [],
  adjacentTools: [],
  items: [
    {
      youtubeId: 'fictionnl01',
      title: 'Fictional weekly newsletter walkthrough',
      description:
        'Demonstrate using ChatGPT to draft short newsletter articles and adapt the reading level for adult learners.',
      functionAreas: ['Communications'],
      tasks: ['newsletter drafting'],
      tools: ['ChatGPT'],
      addedAt: null,
      lengthSeconds: 120,
      status: 'active',
      startHere: false,
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
  'Draft a newsletter',
  'Draft a newsletter for donors',
  'Write a weekly newsletter',
])(
  'AC-12.21: returns newsletter instruction for a general writing request: %s',
  (goal) => {
    const result = select(goal);
    expect(result.results.map((row) => row.item.youtubeId)).toEqual([
      'fictionnl01',
    ]);
    expect(result.results[0].item.tasks).toEqual(['newsletter drafting']);
  },
);

it('AC-12.21: retains the specific newsletter adaptation operation', () => {
  const result = select(
    'Draft a weekly newsletter for adult learners and adapt the reading level',
  );
  expect(result.results.map((row) => row.item.youtubeId)).toEqual([
    'fictionnl01',
  ]);
  expect(result.results[0].reason).toContain(
    'Newsletter writing / Plain language',
  );
});

it.each([
  ['mentioned', 0],
  ['walkthrough', 1],
] as const)(
  'AC-12.21: applies reviewed instructional strength: %s',
  (form, count) => {
    const result = recommendVideos(
      deterministicCatalog(catalog),
      { prompt: 'Draft a newsletter' },
      {
        instructions: [
          { youtubeId: 'fictionnl01', task: 'Newsletter writing', form },
        ],
      },
    );
    expect(result.recommendations).toHaveLength(count);
  },
);

it.each([
  'Create an image for a newsletter',
  'Summarize a newsletter',
  'Create a newsletter signup form',
  'Do not draft a newsletter. Repair a bicycle tire instead.',
  'Draft a newsletter without using ChatGPT',
  'Draft a newsletter in Excel only',
  'Draft a newsletter using only ChatGPT',
  "Draft a newsletter using Excel's own controls",
  'Draft a newsletter offline only',
  'Draft a newsletter that works offline',
])(
  'AC-12.21: preserves operation scope and explicit constraints: %s',
  (goal) => {
    expect(select(goal).results).toEqual([]);
  },
);
