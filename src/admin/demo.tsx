import { AnalyticsDashboard } from './AnalyticsDashboard';
import { parsePublicCatalog } from '../contracts/publicCatalog';
import { dashboardDemo } from '../../fixtures/dashboard-demo';
const catalog = parsePublicCatalog({
  schemaVersion: 1,
  catalogVersion: `sha256:${'d'.repeat(64)}`,
  functionAreas: ['Fundraising', 'Operations'],
  tools: ['ChatGPT', 'Sheets'],
  tasks: [],
  synonyms: [],
  adjacentTools: [],
  items: dashboardDemo.facts
    .filter((fact) => fact.entity === 'video' && fact.dateKey === 0)
    .map((fact, index) => ({
      youtubeId: fact.youtubeId,
      title: fact.title,
      description: 'Fictional demonstration for the staff library preview.',
      functionAreas: [index % 2 ? 'Fundraising' : 'Operations'],
      tools: [index % 3 ? 'ChatGPT' : 'Sheets'],
      tasks: [],
      addedAt: null,
      lengthSeconds: null,
      status: 'active',
      startHere: false,
    })),
});
const loadDemo = async () => ({
  ok: true as const,
  snapshot: { ...dashboardDemo, catalog },
});
const demoClock = () => Date.parse('2026-10-29T16:00:00Z');
export function AnalyticsDemo() {
  return <AnalyticsDashboard demo load={loadDemo} clock={demoClock} />;
}
