import { Route, Routes } from 'react-router';
import { IntakeResultsPage } from './pages/IntakeResultsPage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<IntakeResultsPage />} />
    </Routes>
  );
}
