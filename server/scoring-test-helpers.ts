import type { PublicCatalog } from '../src/contracts/publicCatalog';
import type { RecommendationRequest } from '../src/contracts/recommendation';
import type { CatalogAssessment } from './full-catalog-scoring';

export function catalogFixture(count = 89): PublicCatalog {
  return {
    schemaVersion: 1,
    catalogVersion: `sha256:${'b'.repeat(64)}`,
    functionAreas: ['Operations', 'Learning'],
    tasks: ['Record checking', 'Document drafting'],
    tools: ['Fixture editor', 'Fixture spreadsheet'],
    synonyms: [],
    adjacentTools: [],
    items: Array.from({ length: count }, (_, index) => ({
      youtubeId: `scoring${String(index).padStart(4, '0')}`,
      title: `Fixture video ${index}`,
      description: `Demonstrate fictional operation ${index}. Check records before drafting a report.`,
      functionAreas: [index % 2 ? 'Learning' : 'Operations'],
      tasks: [index % 2 ? 'Document drafting' : 'Record checking'],
      tools: [index % 2 ? 'Fixture editor' : 'Fixture spreadsheet'],
      addedAt: null,
      lengthSeconds: null,
      status: 'active',
      startHere: false,
    })),
  };
}
export function inputFixture(): RecommendationRequest {
  return {
    goal: 'Check the records and draft a report using the approved editor.',
    functionArea: null,
    tools: [],
    catalogVersion: `sha256:${'b'.repeat(64)}`,
  };
}

export function assessmentFixture(): CatalogAssessment {
  return {
    noWork: false,
    goalType: 'task',
    picks: [0, 1].map((position) => ({
      position,
      rationale: 'Teaches checking the records before writing.',
      grade: 3,
      quote: 'Check records before drafting a report.',
    })),
  };
}
