import catalog from './public-catalog.json';

export const searchEvent = {
  schemaVersion: 1,
  eventId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  sessionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  searchId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  type: 'search',
  time: '2026-10-20T12:00:00.000Z',
  mode: 'recommendations',
  src: 'website',
  catalogVersion: catalog.catalogVersion,
  recommendationEngine: 'rules',
  llmFallbackReason: 'not-requested',
  functionArea: 'Fundraising',
  tools: ['ChatGPT'],
  tasks: ['grant reports'],
  resultCount: 2,
  strongMatchCount: 1,
  fallbackType: 'none',
};

export const impressionEvent = {
  schemaVersion: 1,
  eventId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  sessionId: searchEvent.sessionId,
  searchId: searchEvent.searchId,
  type: 'impression',
  time: searchEvent.time,
  mode: 'topic',
  catalogVersion: catalog.catalogVersion,
  youtubeId: catalog.items[0].youtubeId,
  rank: 1,
  matchType: 'strong',
};
