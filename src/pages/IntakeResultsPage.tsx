import { useCatalog } from '../data/useCatalog';
import { IntakeResults } from './IntakeResults';
import './intake-results.css';

export function IntakeResultsPage() {
  const catalog = useCatalog();

  return (
    <main className="intake-results-page">
      <h1>Find your next AI video</h1>
      {catalog.status === 'loading' && <p>Loading the catalog…</p>}
      {catalog.status === 'error' && <p role="alert">{catalog.message}</p>}
      {catalog.status === 'ready' && <IntakeResults catalog={catalog.items} />}
    </main>
  );
}
