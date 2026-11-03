import { parsePublicCatalog } from '../src/contracts/publicCatalog';

export const topicCatalog = parsePublicCatalog({
  schemaVersion: 1,
  catalogVersion: `sha256:${'b'.repeat(64)}`,
  functionAreas: ['Fundraising', 'Operations'],
  tools: ['ChatGPT', 'Sheets', 'Claude'],
  tasks: ['presentation creation', 'fundraising', 'budget planning'],
  synonyms: [
    { alias: 'pitch deck', category: 'task', target: 'presentation creation' },
    { alias: 'giving', category: 'task', target: 'fundraising' },
  ],
  adjacentTools: [],
  items: Array.from({ length: 14 }, (_, index) => ({
    youtubeId: `topic${String(index).padStart(6, '0')}`,
    title: `Presentation ${String(index + 1).padStart(2, '0')}`,
    description: 'Fictional public demonstration of fundraising presentations.',
    functionAreas: [index % 2 ? 'Operations' : 'Fundraising'],
    tools: [index % 3 ? 'ChatGPT' : 'Sheets'],
    tasks: ['presentation creation', 'fundraising'],
    addedAt: null,
    lengthSeconds: null,
    status: 'active',
    startHere: index === 0,
  })),
});
