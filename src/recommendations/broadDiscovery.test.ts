import { expect, it } from 'vitest';
import { discoveryCatalog } from '../../fixtures/discoveryCatalog';
import { deterministicSelection } from './deterministicSelection';

function select(goal: string, catalog = discoveryCatalog) {
  return deterministicSelection(catalog, goal, {
    functionArea: null,
    tools: [],
    goalWords: goal.split(/\s+/),
  });
}

it.each([
  'Copilot',
  'copilot',
  'Microsoft Copilot',
  'What can I do with Copilot?',
])('AC-12.23: discovers actual catalog tool matches for %s', (goal) => {
  expect(select(goal).results.map((row) => row.item.youtubeId)).toEqual([
    'fictioncp01',
  ]);
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
