import sprintLogo from '../assets/ai-sprint-logo.png';
import { useCatalog } from '../data/useCatalog';
import { IntakeResults } from './IntakeResults';
import { DiscoveryHero } from './DiscoveryHero';
import { getUsageSession } from '../usage/usageSession';
import { RequestForm } from '../requests/RequestForm';
import './global.css';
import './intake-results.css';

const DEFAULT_ANALYTICS_URL =
  'https://script.google.com/macros/s/AKfycbzw_0TUPaW2VbEEiLonCU_AsG7KJkf7H2iB2zg4oG2dmq3SNZFv2zNY-LRW73sCFS7J/exec';

export function IntakeResultsPage() {
  const catalog = useCatalog();
  const analyticsUrl =
    import.meta.env.VITE_ADMIN_ANALYTICS_URL?.trim() ?? DEFAULT_ANALYTICS_URL;
  const analyticsAvailable =
    /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(
      analyticsUrl,
    );
  const usageSession =
    catalog.status === 'ready' ? getUsageSession(catalog.source) : null;

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="topbar">
        <div className="topbar-inner">
          <img
            className="brand-logo"
            src={sprintLogo}
            alt="AI for Nonprofits Sprint. Powered by Fund for the City of New York."
          />
          <p className="wordmark">AI video finder</p>
        </div>
      </header>
      <main className="intake-results-page" id="main-content">
        {catalog.status === 'loading' && (
          <DiscoveryHero>
            <div className="state-panel">
              <p role="status">Loading the catalog…</p>
            </div>
          </DiscoveryHero>
        )}
        {catalog.status === 'error' && (
          <DiscoveryHero>
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
          </DiscoveryHero>
        )}
        {catalog.status === 'ready' &&
          (catalog.items.length === 0 ? (
            <DiscoveryHero>
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
            </DiscoveryHero>
          ) : (
            <IntakeResults
              key={catalog.catalog.catalogVersion}
              catalog={catalog.items}
              publicCatalog={catalog.catalog}
              recommendationCatalog={
                catalog.source === 'remote' ? catalog.catalog : undefined
              }
              catalogNotice={
                catalog.source === 'fixture' ? (
                  <p className="catalog-notice demo-notice">Demo catalog</p>
                ) : null
              }
              usage={
                usageSession
                  ? { session: usageSession, catalog: catalog.catalog }
                  : undefined
              }
            />
          ))}
        <div className="page-body library-information">
          <div className="info-panels">
            <section className="info-panel" aria-labelledby="how-it-works">
              <h2 id="how-it-works">How we pick videos</h2>
              <p>
                Describe what you want to do, choose Deterministic or Haiku AI,
                then select Find videos. Deterministic matching compares your
                requested work and constraints with the catalog locally. Haiku
                AI assesses the complete catalog independently.
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
        <div className="footer-inner">
          <p>
            <strong>AI for Nonprofits Sprint</strong>
            <br />
            Fund for the City of New York
          </p>
          {analyticsAvailable && (
            <nav aria-label="Staff">
              <a
                className="admin-analytics-link"
                href={analyticsUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Admin analytics
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </nav>
          )}
        </div>
      </footer>
    </>
  );
}
