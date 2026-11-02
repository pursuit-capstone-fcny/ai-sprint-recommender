import { expect, it } from 'vitest';
import { parsePublicCatalog } from '../contracts/publicCatalog';
import { deterministicSelection } from './deterministicSelection';
import { deterministicCatalog } from './deterministicCatalog';
import { recommendVideos } from '../engine/deterministicPrompt';
import { requiredPlatform } from '../engine/promptPlatform';

const catalog = parsePublicCatalog({
  schemaVersion: 1,
  catalogVersion: `sha256:${'b'.repeat(64)}`,
  functionAreas: ['Communications'],
  tasks: ['newsletter drafting'],
  tools: ['ChatGPT'],
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
  ['using only mailchimp', 'mailchimp'],
  ['using only Microsoft Excel for our team', 'Microsoft Excel'],
  ['in excel only', 'excel'],
  ['in english only', undefined],
  ['using only ai', undefined],
  ['with only a minute to spare', undefined],
  ['using only public information', undefined],
  ['in plain English only', undefined],
  ['using only our notes', undefined],
  ['with only supplied documents', undefined],
  ['using only text', undefined],
  ['in simple Spanish only', undefined],
  ['using only apple notes', 'apple notes'],
  ['in Microsoft Word only', 'Microsoft Word'],
  ['in Word only', 'Word'],
  ['using only FictionalWriter', 'FictionalWriter'],
  ['using only fictionalwriter', 'fictionalwriter'],
  ['using only mailchimp as my editor', 'mailchimp'],
  ['using only Microsoft Excel because we own it', 'Microsoft Excel'],
  ['using only Fictional Writer rather than ChatGPT', 'Fictional Writer'],
  ['using only Fictional AI', 'Fictional AI'],
  ['using not only Lightroom but also Photoshop', undefined],
  ['with not only mailchimp but also ChatGPT', undefined],
] as const)(
  'AC-12.21: scopes an exclusive platform independently of the dictionary: %s',
  (suffix, expected) => {
    expect(requiredPlatform(`Draft a newsletter ${suffix}`)).toBe(expected);
  },
);

it.each([
  'Draft a newsletter',
  'Draft a newsletter for donors',
  'Write a weekly newsletter',
  'Draft a newsletter in English only',
  'Create a newsletter',
  'Compose a newsletter',
  'Create a newsletter banner and draft a newsletter for donors',
  'Draft a newsletter, with a friendly tone',
  'Draft a newsletter please',
  'Draft a newsletter quickly',
  'Draft a newsletter using only public information',
  'Draft a newsletter in plain English only',
  'Draft a newsletter using only our notes',
  'Draft a newsletter with only supplied documents',
  'Draft a newsletter using only text',
  'Draft a newsletter using not only ChatGPT but also Claude',
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
  'Create a newsletter image',
  'Create a newsletter banner',
  'Create a newsletter summary',
  'Write a newsletter banner',
  'Draft a newsletter summary',
  'Create a newsletter cover image',
  'Compose a newsletter logo',
  'Summarize a newsletter',
  'Create a newsletter signup form',
  'Do not draft a newsletter. Repair a bicycle tire instead.',
  'Draft a newsletter without using ChatGPT',
  'Draft a newsletter in Excel only',
  'Draft a newsletter using only Excel',
  'Draft a newsletter using only mailchimp',
  'Draft a newsletter in excel only',
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
