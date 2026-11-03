import { expect, it } from 'vitest';
import { discoveryCatalog } from '../../fixtures/discoveryCatalog';
import { deterministicSelection } from './deterministicSelection';
import { instructions } from '../engine/promptConfig/instructions';

function select(goal: string, catalog = discoveryCatalog) {
  return deterministicSelection(catalog, goal, {
    functionArea: null,
    tools: [],
    goalWords: goal.split(/\s+/),
  });
}

it.each(['Perplexity', 'perplexity', 'Help me learn Perplexity'])(
  'AC-12.23: %s discovers an unreviewed tool video in a partially reviewed catalog',
  (goal) => {
    // Include one configured review so the real caller enables instruction checks.
    const reviewed = instructions[0];
    const catalog = {
      ...discoveryCatalog,
      tasks: ['policy research', reviewed.task],
      tools: ['Perplexity'],
      synonyms: [],
      items: [
        {
          ...discoveryCatalog.items[0],
          youtubeId: 'fictionpp01',
          title: 'Fictional policy research with Perplexity',
          description: 'Find fictional policy documents with Perplexity.',
          tasks: ['policy research'],
          tools: ['Perplexity'],
        },
        {
          ...discoveryCatalog.items[2],
          youtubeId: reviewed.youtubeId,
          tasks: [reviewed.task],
          tools: [],
        },
      ],
    };
    expect(
      select(goal, catalog).results.map((row) => row.item.youtubeId),
    ).toEqual(['fictionpp01']);
    expect(select(goal, catalog).results[0].reason).toBe(
      'Browse videos tagged Perplexity.',
    );
    expect(
      select(goal, { ...catalog, items: [...catalog.items].reverse() }),
    ).toEqual(select(goal, catalog));
  },
);

it.each([
  'Copilot',
  'copilot',
  'Microsoft Copilot',
  'What can I do with Copilot?',
  'What can I create with Copilot?',
  'What can I make with Copilot?',
  'Tell me more about Copilot',
  'Help me with Copilot.',
  'Help me learn Copilot',
  'Help with Copilot',
  'Can you help me with Copilot?',
  'Could you help us learn how to use Copilot?',
  'Please help us get started with Microsoft Copilot.',
  'I need some help using Copilot',
  'We would like help learning about Copilot',
  'I want help getting started with Copilot',
  'HELP ME UNDERSTAND COPILOT, PLEASE!',
])('AC-12.23: discovers actual catalog tool matches for %s', (goal) => {
  expect(select(goal).results.map((row) => row.item.youtubeId)).toEqual([
    'fictioncp01',
  ]);
});
it.each(['NotebookLM', 'Claude', 'Fixture assistant'])(
  'AC-12.23: tool-help requests use the current catalog vocabulary for %s',
  (tool) => {
    const catalog = {
      ...discoveryCatalog,
      tools: [tool],
      synonyms: [
        { alias: 'Library helper', category: 'tool' as const, target: tool },
      ],
      items: discoveryCatalog.items.map((item, index) => ({
        ...item,
        tools: index === 0 ? [tool] : [],
        ...(index === 0
          ? {
              title: `Fictional feedback analysis with ${tool}`,
              description: `Use ${tool} to analyze feedback and summarize survey responses.`,
            }
          : {}),
      })),
    };
    for (const goal of [
      `Help me learn ${tool}.`,
      'Can you help me with Library helper?',
    ]) {
      const result = select(goal, catalog);
      expect(result.results.map((row) => row.item.youtubeId)).toEqual([
        'fictioncp01',
      ]);
      expect(result.results[0].reason).toBe(`Browse videos tagged ${tool}.`);
      expect(
        select(goal, { ...catalog, items: [...catalog.items].reverse() }),
      ).toEqual(result);
    }
  },
);
it('AC-12.23: help queries retain tool exclusions when selecting discovery videos', () => {
  const item = discoveryCatalog.items[0];
  const catalog = {
    ...discoveryCatalog,
    items: [
      { ...item, tools: ['CoPilot', 'ChatGPT'] },
      { ...item, youtubeId: 'fictioncp02' },
      ...discoveryCatalog.items.slice(1),
    ],
  };
  expect(
    select('Help me with Copilot without ChatGPT', catalog).results.map(
      (row) => row.item.youtubeId,
    ),
  ).toEqual(['fictioncp02']);
});
it('AC-12.23: discovers the placeholder topic without unrelated filler and is stable under catalog reordering', () => {
  const goal =
    'For example, I coordinate volunteers and need help planning outreach.';
  const result = select(goal);
  expect(result.results.map((row) => row.item.youtubeId)).toEqual([
    'fictionvo01',
  ]);
  expect(
    select(goal, {
      ...discoveryCatalog,
      items: [...discoveryCatalog.items].reverse(),
    }),
  ).toEqual(result);
});
it.each([
  'Copilot offline only',
  'Copilot using only ChatGPT',
  'Repair a bicycle with Copilot',
  'Coordinate volunteers without using ChatGPT',
  'Create a slide deck image with Copilot',
  'Unrecognized topic xyzzy',
  'Delete volunteer records with ChatGPT',
  'Book volunteer travel',
  'What can I create with Copilot? Delete volunteer records.',
  'Help me with Copilot to delete volunteer records.',
  'Can you help me learn Copilot and repair a bicycle?',
  'I need help with Copilot. Delete volunteer records.',
  'I need help with Copilot offline only',
  'Help me with only Copilot',
  'Help me with Copilot using only ChatGPT',
  'Help me with Copilot without using Copilot',
  'Help me with Copilot, but I do not want to use Copilot.',
  'Help me with Copilot to create a slide deck image',
  'Help me with Copilot using my uploaded spreadsheet',
  'I do not want help with Copilot',
])(
  'AC-12.23: discovery does not bypass constraints or invent task support: %s',
  (goal) => {
    expect(select(goal).results).toEqual([]);
  },
);
it('AC-12.23: excludes retired videos and every duplicate ID before limiting results', () => {
  const item = discoveryCatalog.items[0];
  expect(
    select('Copilot', {
      ...discoveryCatalog,
      items: [item, { ...item, status: 'retired' }],
    }).results,
  ).toEqual([]);
});
