import { useCatalog } from '../data/useCatalog';
import { IntakeResults } from './IntakeResults';
import './global.css';
import './intake-results.css';

export function IntakeResultsPage() {
  const catalog = useCatalog();

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              AI
            </span>
            FCNY Sprint Recommender
          </div>
          <span className="topbar-note">Short videos for your next sprint</span>
        </div>
      </header>
      <main className="intake-results-page">
        <div className="hero">
          <div className="hero-inner">
            <p className="eyebrow">AI Sprint videos</p>
            <h1>Find your next AI video</h1>
            <p className="hero-lede">
              Tell us your area, goal and tools. We'll line up the videos that
              fit best.
            </p>
          </div>
        </div>
        <div className="page-body">
          {catalog.status === 'loading' && (
            <div className="state-panel">
              <p role="status">Loading the catalog…</p>
            </div>
          )}
          {catalog.status === 'error' && (
            <div className="state-panel">
              <p role="alert">{catalog.message}</p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={catalog.retry}
              >
                Try again
              </button>
            </div>
          )}
          {catalog.status === 'ready' && (
            <>
              {catalog.source === 'fixture' && (
                <p className="demo-notice">Demo catalog</p>
              )}
              {catalog.items.length === 0 ? (
                <div className="state-panel">
                  <p role="status">No videos available</p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={catalog.retry}
                  >
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
        </div>
      </main>
    </>
  );
}
