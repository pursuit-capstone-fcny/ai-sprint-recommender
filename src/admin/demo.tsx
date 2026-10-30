import { AnalyticsDashboard } from './AnalyticsDashboard';
import { dashboardDemo } from '../../fixtures/dashboard-demo';
const loadDemo = async () => ({ ok: true as const, snapshot: dashboardDemo });
const demoClock = () => Date.parse('2026-10-29T16:00:00Z');
export function AnalyticsDemo() {
  return <AnalyticsDashboard demo load={loadDemo} clock={demoClock} />;
}
