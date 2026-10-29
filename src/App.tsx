import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import { IntakeResultsPage } from './pages/IntakeResultsPage';

const AnalyticsDemo = lazy(() =>
  import('./admin/demo').then((module) => ({ default: module.AnalyticsDemo })),
);

export function App() {
  return (
    <Routes>
      <Route
        path="/admin/analytics/preview"
        element={
          <Suspense fallback={<p>Loading synthetic analytics preview…</p>}>
            <AnalyticsDemo />
          </Suspense>
        }
      />
      <Route path="/" element={<IntakeResultsPage />} />
    </Routes>
  );
}
