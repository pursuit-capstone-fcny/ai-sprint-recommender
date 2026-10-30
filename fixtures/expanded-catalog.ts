import { parsePublicCatalog } from '../src/contracts/publicCatalog';
import { toCatalogItem } from '../src/contracts/catalogItem';
import fixture from './public-catalog.json';

// Fictional public metadata for count boundaries and model/rules UI checks.
export const expandedPublicCatalog = parsePublicCatalog({
  ...fixture,
  functionAreas: ['Operations'],
  tasks: Array.from({ length: 12 }, (_, index) => `report task ${index}`),
  tools: ['ChatGPT'],
  synonyms: [],
  adjacentTools: [],
  items: Array.from({ length: 12 }, (_, index) => ({
    ...fixture.items[0],
    youtubeId: `expanded${String(index).padStart(3, '0')}`,
    title: `[Fixture] Video ${index}`,
    description: 'Fictional public video for result-count checks.',
    functionAreas: ['Operations'],
    tasks: [`report task ${index}`],
    tools: ['ChatGPT'],
    startHere: index >= 8,
    addedAt: '2026-01-01',
  })),
});
export const expandedCatalog = expandedPublicCatalog.items.map(toCatalogItem);
