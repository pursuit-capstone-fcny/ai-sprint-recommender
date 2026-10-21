import { useCatalog } from '../data/useCatalog';
import { IntakeResults } from './IntakeResults';
import './intake-results.css';

export function IntakeResultsPage() {
  const catalog = useCatalog();

  return (
    <main className="intake-results-page">
      <h1>Find your next AI video</h1>
      {catalog.status === 'loading' && (
        <p role="status">Loading the catalog…</p>
      )}
      {catalog.status === 'error' && (
        <div>
          <p role="alert">{catalog.message}</p>
          <button type="button" onClick={catalog.retry}>
            Try again
          </button>
        </div>
      )}
      {catalog.status === 'ready' && (
        <>
          {catalog.source === 'fixture' && <p>Demo catalog</p>}
          {catalog.items.length === 0 ? (
            <div>
              <p role="status">No videos available</p>
              <button type="button" onClick={catalog.retry}>
                Refresh catalog
              </button>
            </div>
          ) : (
            <IntakeResults
              catalog={catalog.items}
              availableFunctionAreas={catalog.catalog.functionAreas}
              availableTools={catalog.catalog.tools}
            />
          )}
        </>
      )}
    </main>
  );
}
