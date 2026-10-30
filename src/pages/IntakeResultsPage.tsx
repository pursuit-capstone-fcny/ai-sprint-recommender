import { useCatalog } from '../data/useCatalog';
import { IntakeResults } from './IntakeResults';
import { recommendationsEnabled } from '../recommendations/requestRecommendations';
import { getUsageSession } from '../usage/usageSession';
import { RequestForm } from '../requests/RequestForm';
import './global.css';
import './intake-results.css';

export function IntakeResultsPage() {
  const catalog = useCatalog();
  const usageSession =
    catalog.status === 'ready' ? getUsageSession(catalog.source) : null;

  const llmEnabled =
    recommendationsEnabled() &&
    catalog.status === 'ready' &&
    catalog.source === 'remote';

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true" />
            <span className="wordmark">
              <strong>Sprint</strong> <span aria-hidden="true">/</span> AI video
              finder
            </span>
          </div>
          <span className="topbar-note">AI for Nonprofits Sprint</span>
        </div>
      </header>
      <main className="intake-results-page">
        <div className="hero">
          <div className="hero-inner">
            <p className="eyebrow">AI Sprint video library</p>
            <h1>Find the right AI video for your work.</h1>
            <p className="hero-lede">
              Tell us about your work, your role or what your organization does.
              We'll suggest Sprint videos to help you get started.
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
              {catalog.source === 'fixture' ? (
                <p className="catalog-notice demo-notice">Demo catalog</p>
              ) : (
                catalog.items.length > 0 && (
                  <p className="catalog-notice library-status">
                    {catalog.items.length}{' '}
                    {catalog.items.length === 1 ? 'video' : 'videos'} loaded
                  </p>
                )
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
                  <RequestForm fallback />
                </div>
              ) : (
                <IntakeResults
                  key={catalog.catalog.catalogVersion}
                  catalog={catalog.items}
                  recommendationCatalog={
                    catalog.source === 'remote' ? catalog.catalog : undefined
                  }
                  availableFunctionAreas={catalog.catalog.functionAreas}
                  availableTools={catalog.catalog.tools}
                  usage={
                    usageSession
                      ? { session: usageSession, catalog: catalog.catalog }
                      : undefined
                  }
                />
              )}
            </>
          )}

          <div className="info-panels">
            <section className="info-panel" aria-labelledby="how-it-works">
              <h2 id="how-it-works">How we pick videos</h2>
              <p>
                {llmEnabled
                  ? 'Describe your work and select Find videos. AI suggestions compare your description and any optional refinements with the video catalog. If AI suggestions are unavailable, we use standard matching. No follow-up interview is required.'
                  : 'Describe your work and select Find videos. Standard matching uses words in your description to look for related tasks, video titles and descriptions. You can optionally refine by function area or tool. If nothing matches, we suggest videos to start with. No follow-up interview is required.'}
              </p>
            </section>
            <section className="info-panel" aria-labelledby="about-library">
              <h2 id="about-library">About these videos</h2>
              <p>
                Every video here was made by the AI for Nonprofits Sprint. The
                Sprint team adds new ones each month.
              </p>
            </section>
          </div>
        </div>
      </main>
      <footer className="site-footer">
        <span>AI for Nonprofits Sprint · Fund for the City of New York</span>
        <nav aria-label="Staff">
          <a
            className="admin-analytics-link"
            href="https://script.google.com/macros/s/AKfycbzw_0TUPaW2VbEEiLonCU_AsG7KJkf7H2iB2zg4oG2dmq3SNZFv2zNY-LRW73sCFS7J/exec"
            target="_blank"
            rel="noopener noreferrer"
          >
            Admin analytics
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </nav>
      </footer>
    </>
  );
}
