import { parsePublicCatalog } from '../src/contracts/publicCatalog';

export const discoveryCatalog = parsePublicCatalog({
  schemaVersion: 1,
  catalogVersion: `sha256:${'d'.repeat(64)}`,
  functionAreas: ['Operations'],
  tasks: ['survey analysis', 'volunteer onboarding', 'Other work'],
  tools: ['CoPilot', 'ChatGPT'],
  synonyms: [
    { alias: 'Microsoft Copilot', category: 'tool', target: 'CoPilot' },
  ],
  adjacentTools: [],
  items: [
    {
      youtubeId: 'fictioncp01',
      title: 'Fictional feedback analysis with Copilot',
      description:
        'Use CoPilot to analyze feedback and summarize survey responses.',
      tasks: ['survey analysis'],
      tools: ['CoPilot'],
    },
    {
      youtubeId: 'fictionvo01',
      title: 'Fictional volunteer outreach and orientation',
      description:
        'Plan volunteer outreach and create welcoming orientation materials with ChatGPT.',
      tasks: ['volunteer onboarding'],
      tools: ['ChatGPT'],
    },
    {
      youtubeId: 'fictionxx01',
      title: 'Fictional unrelated overview',
      description: 'An overview of a different topic.',
      tasks: ['Other work'],
      tools: ['ChatGPT'],
    },
  ].map((item) => ({
    ...item,
    functionAreas: ['Operations'],
    status: 'active',
    startHere: false,
    addedAt: null,
    lengthSeconds: 120,
  })),
});
