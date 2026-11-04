import { useEffect, useMemo, useState } from 'react';
import {
  DashboardFiltersSchema,
  categoryName,
  queryDashboard,
  type DashboardFilters,
  type DashboardRow,
  type DashboardView,
} from './query';
import type {
  DashboardResponse,
  DashboardSnapshot,
  SheetConnection,
} from './snapshot';
import { loadPrivateDashboard } from './transport';
import { TopicSearch } from './TopicSearch';
import { csvFilename, downloadCsv, toCsv } from './csv';
import '../pages/global.css';
import './dashboard.css';

const connectionErrors = {
  ACCESS_DENIED:
    'Google access required. Sign in with an account that can read the private Sheet.',
  REPORT_UNAVAILABLE:
    'The Sheet could not be loaded. Reload data to try again.',
  SOURCE_NOT_CONFIGURED:
    'The library Sheet has not been configured. Contact the library owner.',
  SHARING_TOO_BROAD:
    'The library Sheet must use Restricted sharing with named people. Ask its owner to update sharing, then reload.',
};
const realClock = () => Date.now();
const views: { id: DashboardView; label: string; description: string }[] = [
  {
    id: 'video',
    label: 'Videos',
    description: 'Which videos appear, and which receive clicks?',
  },
  {
    id: 'tag',
    label: 'Tags & keywords',
    description:
      'Compare catalog-tag appearances with canonical keyword searches.',
  },
  {
    id: 'association',
    label: 'Keyword associations',
    description:
      'Keywords searched when a video appeared. Co-occurrence does not prove why it was recommended.',
  },
];
function defaults(snapshot: DashboardSnapshot): DashboardFilters {
  return {
    startDate: snapshot.startDate ?? '2026-01-01',
    endDate: snapshot.endDate ?? '2026-01-01',
    source: 'all',
    mode: 'all',
    includeTeam: false,
    includeHistorical: false,
    query: '',
    category: 'all',
    tag: '',
    activity: 'all',
  };
}
const dateLabel = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      }).format(new Date(value))
    : 'Unavailable';
const number = (value: number) => value.toLocaleString('en-US');
const textFields: (keyof DashboardRow)[] = ['title', 'tag', 'category'];
const numberClass = (key: keyof DashboardRow) =>
  textFields.includes(key) ? undefined : 'analytics-number';
const stateCopy = {
  error:
    'The reporting refresh failed. Ask the reporting owner to repair it, then reload.',
  refreshing: 'The report is being updated. Reload in a moment.',
  cleared:
    'The reporting owner has cleared this report. There is no data to display.',
  stale:
    'This report is out of date. Reload data to read the Sheet again. If it stays stale, contact the reporting owner.',
};
export function AnalyticsDashboard({
  load = loadPrivateDashboard,
  clock = realClock,
  demo = false,
}: {
  load?: () => Promise<DashboardResponse>;
  clock?: () => number;
  demo?: boolean;
}) {
  const [connection, setConnection] = useState<SheetConnection | null>(null);
  const acceptResponse = (response: DashboardResponse) => {
    if (!response.ok) {
      setError(connectionErrors[response.error]);
      return;
    }
    const next = response.snapshot;
    setSnapshot(next);
    setConnection(response.connection ?? null);
    setPage(0);
    setDraft((current) => current ?? defaults(next));
    setFilters((current) => current ?? defaults(next));
  };
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [reload, setReload] = useState(0);
  const [topicView, setTopicView] = useState(false);
  const [showDirect, setShowDirect] = useState(false);
  const [view, setView] = useState<DashboardView>('video');
  const [draft, setDraft] = useState<DashboardFilters | null>(null),
    [filters, setFilters] = useState<DashboardFilters | null>(null),
    [filterError, setFilterError] = useState('');
  const [sort, setSort] = useState<{ key: keyof DashboardRow; desc: boolean }>({
      key: 'appearances',
      desc: true,
    }),
    [page, setPage] = useState(0);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setSnapshot(null);
    setConnection(null);
    load()
      .then((response) => {
        if (!active) return;
        acceptResponse(response);
      })
      .catch(() => {
        if (active)
          setError(
            'The report could not be loaded. Try again or contact the reporting owner.',
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // Only a loader/reload change starts a request; response handling uses state setters.
  }, [load, reload]);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (
      snapshot &&
      ['ready', 'empty'].includes(snapshot.state) &&
      snapshot.staleAt &&
      Date.parse(snapshot.staleAt) <= clock()
    )
      setSnapshot({ ...snapshot, state: 'stale', facts: [] });
  }, [snapshot, clock, tick]);
  const ready = Boolean(
    snapshot &&
    ['ready', 'empty'].includes(snapshot.state) &&
    (!snapshot.staleAt || Date.parse(snapshot.staleAt) > clock()),
  );
  const rows = useMemo(
    () =>
      ready && snapshot && filters
        ? queryDashboard(snapshot.facts, view, filters)
        : [],
    [ready, snapshot, filters, view],
  );
  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const x = a[sort.key],
          y = b[sort.key];
        const value =
          typeof x === 'number' && typeof y === 'number'
            ? x - y
            : String(x).localeCompare(String(y));
        return (sort.desc ? -value : value) || a.key.localeCompare(b.key);
      }),
    [rows, sort],
  );
  useEffect(() => setPage(0), [filters, view, sort]);
  const tags = useMemo(
    () =>
      snapshot
        ? [
            ...new Set(
              snapshot.facts
                .filter(
                  (f) =>
                    f.entity === 'tag' &&
                    (!draft ||
                      draft.category === 'all' ||
                      f.category === draft.category),
                )
                .map((f) => f.tag),
            ),
          ].sort()
        : [],
    [snapshot, draft],
  );
  const current = views.find((v) => v.id === view)!;
  const noun =
    view === 'video' ? 'video' : view === 'tag' ? 'tag' : 'association';
  const fields: { key: keyof DashboardRow; label: string }[] =
    view === 'tag'
      ? [
          { key: 'tag', label: 'Canonical tag' },
          { key: 'category', label: 'Category' },
          { key: 'searches', label: 'Keyword searches' },
          { key: 'appearances', label: 'Appearances' },
          { key: 'embedClicks', label: 'Embed clicks' },
          { key: 'youtubeClicks', label: 'YouTube clicks' },
        ]
      : view === 'association'
        ? [
            { key: 'title', label: 'Video' },
            { key: 'tag', label: 'Search keyword' },
            { key: 'category', label: 'Category' },
            { key: 'appearances', label: 'Appearances' },
            { key: 'embedClicks', label: 'Embed clicks' },
            { key: 'youtubeClicks', label: 'YouTube clicks' },
          ]
        : [
            { key: 'title', label: 'Video' },
            { key: 'appearances', label: 'Appearances' },
            { key: 'embedClicks', label: 'Embed clicks' },
            { key: 'youtubeClicks', label: 'YouTube clicks' },
            { key: 'directViews', label: 'Direct views' },
            { key: 'directEmbedClicks', label: 'Direct embed clicks' },
            { key: 'directYoutubeClicks', label: 'Direct YouTube clicks' },
          ];
  const visibleFields = fields.filter(
    (f) =>
      showDirect ||
      !['directViews', 'directEmbedClicks', 'directYoutubeClicks'].includes(
        f.key,
      ),
  );
  const update = <K extends keyof DashboardFilters>(
    key: K,
    value: DashboardFilters[K],
  ) => setDraft((d) => (d ? { ...d, [key]: value } : d));
  const changeView = (next: DashboardView) => {
    setView(next);
    setFilterError('');
    if (next !== 'tag') {
      setDraft((d) =>
        d?.activity === 'zero-searches' ? { ...d, activity: 'all' } : d,
      );
      setFilters((f) =>
        f?.activity === 'zero-searches' ? { ...f, activity: 'all' } : f,
      );
    }
  };
  const [exportStatus, setExportStatus] = useState('');
  // Exports every filtered row in the current sort, with the visible columns.
  const tableCsv = () =>
    toCsv(
      visibleFields.map((f) => f.label),
      sorted.map((row) =>
        visibleFields.map((f) => {
          const value = row[f.key];
          if (f.key === 'category') return categoryName(row.category);
          if (typeof value === 'number')
            return snapshot?.collectionAvailable === false
              ? 'Unavailable'
              : value;
          return String(value);
        }),
      ),
    );
  const downloadTable = () => {
    if (!filters) return;
    downloadCsv(
      csvFilename(view, filters.startDate, filters.endDate),
      tableCsv(),
    );
    setExportStatus(
      'CSV download started. If nothing downloaded, use Copy as CSV.',
    );
  };
  const copyTable = async () => {
    try {
      await navigator.clipboard.writeText(tableCsv());
      setExportStatus('CSV copied. Paste it into a spreadsheet.');
    } catch {
      setExportStatus('Copying is blocked in this window.');
    }
  };
  const showKeywords = (id: string) => {
    changeView('association');
    setDraft((d) =>
      d ? { ...d, query: id, category: 'all', tag: '', activity: 'all' } : d,
    );
    setFilters((f) =>
      f ? { ...f, query: id, category: 'all', tag: '', activity: 'all' } : f,
    );
  };
  return (
    <div className="analytics-app">
      {demo && (
        <div className="analytics-demo" role="note">
          Synthetic demo. Fictional videos and counts only; no live analytics is
          loaded.
        </div>
      )}
      <header className="analytics-header">
        <div>
          <a href="#main" className="analytics-skip">
            Skip to report
          </a>
          <span className="analytics-brand">FCNY / AI Sprint</span>
          <h1>Library analytics</h1>
        </div>
        <button
          className="analytics-button"
          disabled={loading}
          onClick={() => setReload((r) => r + 1)}
        >
          {loading ? 'Loading report…' : 'Reload data'}
        </button>
      </header>
      <div className="analytics-meta">
        <span>
          {snapshot?.environment === 'production'
            ? 'Production reporting'
            : snapshot?.environment === 'test'
              ? 'Test reporting'
              : snapshot?.environment === 'connected'
                ? 'Connected Sheet'
                : 'Private staff reporting'}
        </span>
        <span>Updated {dateLabel(snapshot?.refreshedAt ?? null)}</span>
        <span>Reporting dates use America/New_York</span>
      </div>
      {!demo && connection && (
        <section className="analytics-connection" aria-label="Library Sheet">
          <p>
            Library Sheet:{' '}
            <a href={connection.url} target="_blank" rel="noreferrer">
              {connection.title}
            </a>
          </p>
        </section>
      )}
      {error && (
        <div className="analytics-notice analytics-error" role="alert">
          {error}
        </div>
      )}
      {snapshot && !ready && (
        <div className="analytics-notice analytics-error" role="alert">
          {stateCopy[snapshot.state as keyof typeof stateCopy] ??
            stateCopy.stale}
        </div>
      )}
      {snapshot && ready && !topicView && (
        <>
          <div className="analytics-context">
            <p>
              Recorded appearances and clicks, not completed watches. Team
              traffic is excluded unless you include it.
            </p>
            <p>
              Percentage watched: <strong>Unavailable</strong>
            </p>
          </div>
          {(snapshot.unmappedEvents > 0 || snapshot.unattributedEvents > 0) && (
            <div className="analytics-notice" role="note">
              Coverage needs attention: {number(snapshot.unmappedEvents)} events
              lack historical metadata; {number(snapshot.unattributedEvents)}{' '}
              events have no keyword attribution. Missing data is not assigned
              guessed tags.
            </div>
          )}
          {!snapshot.collectionAvailable && (
            <div className="analytics-notice" role="note">
              Usage collection is not available in this Sheet. Inventory is
              shown below, but usage counts and unused-content filters are
              unavailable until usage events are collected.
            </div>
          )}
          {snapshot.pendingTagReviews > 0 && (
            <div className="analytics-notice" role="note">
              {snapshot.pendingTagReviews} videos have tags awaiting approval.
              Proposed tags are excluded from canonical tag analytics.
            </div>
          )}
          {snapshot.conservativeWindow && (
            <div className="analytics-notice" role="note">
              No approved reporting policy was found. Any available usage is
              limited to the last 24 hours. Connecting does not enable tracking
              or extend retention.
            </div>
          )}
          {snapshot.state === 'empty' && snapshot.collectionAvailable && (
            <div className="analytics-notice" role="note">
              No retained usage events yet. Active videos and tags are listed
              with zero recorded activity.
            </div>
          )}
        </>
      )}
      <div
        className={`analytics-layout${topicView ? ' topic-search-layout' : ''}`}
      >
        <details className="analytics-filters" open hidden={topicView}>
          <summary>Filters</summary>
          {draft && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const parsed = DashboardFiltersSchema.safeParse(draft);
                if (!parsed.success) {
                  setFilterError(
                    'Enter valid dates with the start date on or before the end date.',
                  );
                  return;
                }
                setFilterError('');
                setFilters(parsed.data);
              }}
            >
              <fieldset disabled={!ready || loading}>
                <legend className="sr-only">Filter the report</legend>
                <label>
                  From
                  <input
                    type="date"
                    required
                    disabled={snapshot?.collectionAvailable === false}
                    value={draft.startDate}
                    onChange={(e) => update('startDate', e.target.value)}
                  />
                </label>
                <label>
                  Through
                  <input
                    type="date"
                    required
                    disabled={snapshot?.collectionAvailable === false}
                    value={draft.endDate}
                    onChange={(e) => update('endDate', e.target.value)}
                  />
                </label>
                <label>
                  Traffic source
                  <select
                    disabled={snapshot?.collectionAvailable === false}
                    value={draft.source}
                    onChange={(e) =>
                      update(
                        'source',
                        e.target.value as DashboardFilters['source'],
                      )
                    }
                  >
                    {[
                      'all',
                      'website',
                      'email',
                      'session',
                      'pilot',
                      'team',
                      'other',
                    ].map((s) => (
                      <option key={s} value={s}>
                        {s === 'all'
                          ? 'All sources'
                          : s[0].toUpperCase() + s.slice(1)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Discovery mode
                  <select
                    disabled={snapshot?.collectionAvailable === false}
                    value={draft.mode}
                    onChange={(e) =>
                      update('mode', e.target.value as DashboardFilters['mode'])
                    }
                  >
                    <option value="all">All modes</option>
                    <option value="recommendations">Recommendations</option>
                    <option value="topic">Topic browsing</option>
                    <option value="direct">Direct video views</option>
                  </select>
                </label>
                <label>
                  {view === 'tag' ? 'Find a tag' : 'Find a video or keyword'}
                  <input
                    type="search"
                    maxLength={200}
                    placeholder={
                      view === 'tag' ? 'Tag wording' : 'Video title or ID'
                    }
                    value={draft.query}
                    onChange={(e) => update('query', e.target.value)}
                  />
                </label>
                {view !== 'video' && (
                  <>
                    <label>
                      Tag category
                      <select
                        value={draft.category}
                        onChange={(e) =>
                          setDraft((d) =>
                            d
                              ? {
                                  ...d,
                                  category: e.target
                                    .value as DashboardFilters['category'],
                                  tag: '',
                                }
                              : d,
                          )
                        }
                      >
                        <option value="all">All categories</option>
                        {['functionArea', 'tool', 'task'].map((c) => (
                          <option key={c} value={c}>
                            {categoryName(c)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {view === 'association'
                        ? 'Search keyword'
                        : 'Canonical tag'}
                      <select
                        value={draft.tag}
                        onChange={(e) => update('tag', e.target.value)}
                      >
                        <option value="">All tags</option>
                        {tags.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                )}
                <label>
                  Recorded activity
                  <select
                    disabled={snapshot?.collectionAvailable === false}
                    value={draft.activity}
                    onChange={(e) =>
                      update(
                        'activity',
                        e.target.value as DashboardFilters['activity'],
                      )
                    }
                  >
                    <option value="all">All activity</option>
                    <option value="zero-appearances">Zero appearances</option>
                    <option value="no-clicks">Appeared, no clicks</option>
                    {view === 'tag' && (
                      <option value="zero-searches">
                        Zero keyword searches
                      </option>
                    )}
                  </select>
                </label>
                <label className="analytics-check">
                  <input
                    type="checkbox"
                    disabled={snapshot?.collectionAvailable === false}
                    checked={draft.includeTeam}
                    onChange={(e) => update('includeTeam', e.target.checked)}
                  />
                  Include team traffic
                </label>
                <label className="analytics-check">
                  <input
                    type="checkbox"
                    checked={draft.includeHistorical}
                    onChange={(e) =>
                      update('includeHistorical', e.target.checked)
                    }
                  />
                  Include retired or historical items
                </label>
                {draft &&
                  filters &&
                  JSON.stringify(draft) !== JSON.stringify(filters) && (
                    <p className="analytics-pending" role="status">
                      Filters changed. Apply to update the report.
                    </p>
                  )}
                {filterError && (
                  <p className="analytics-field-error" role="alert">
                    {filterError}
                  </p>
                )}
                <button
                  className="analytics-button analytics-primary"
                  type="submit"
                >
                  Apply filters
                </button>
                <button
                  className="analytics-reset"
                  type="button"
                  onClick={() => {
                    if (snapshot) {
                      const initial = defaults(snapshot);
                      setDraft(initial);
                      setFilters(initial);
                      setFilterError('');
                    }
                  }}
                >
                  Reset filters
                </button>
              </fieldset>
            </form>
          )}
          {!draft && <p>Filters will be available when the report loads.</p>}
        </details>
        <main id="main" className="analytics-main" tabIndex={-1}>
          <nav aria-label="Analytics views" className="analytics-tabs">
            {views.map((v) => (
              <button
                key={v.id}
                aria-current={!topicView && view === v.id ? 'page' : undefined}
                onClick={() => {
                  setTopicView(false);
                  changeView(v.id);
                }}
              >
                {v.label}
              </button>
            ))}
            <button
              aria-current={topicView ? 'page' : undefined}
              onClick={() => setTopicView(true)}
            >
              Topic search
            </button>
          </nav>
          {topicView ? (
            loading ? (
              <p role="status">Loading library…</p>
            ) : ready && snapshot?.catalog ? (
              <TopicSearch
                key={snapshot.catalog.catalogVersion}
                catalog={snapshot.catalog}
                collection={demo ? undefined : snapshot.topicUsage}
              />
            ) : (
              <div className="analytics-empty">
                <h2>Topic search unavailable</h2>
                <p>
                  Reload data to load the published library. The private
                  dashboard must include current catalog metadata.
                </p>
              </div>
            )
          ) : (
            <>
              <div className="analytics-table-heading">
                <div>
                  <h2>{current.label}</h2>
                  <p>{current.description}</p>
                </div>
                <p role="status" aria-live="polite">
                  {ready
                    ? `${number(rows.length)} ${noun}${rows.length === 1 ? '' : 's'}`
                    : 'Report unavailable'}
                </p>
              </div>
              {view === 'video' && (
                <button
                  className="analytics-reset analytics-direct-toggle"
                  aria-pressed={showDirect}
                  onClick={() => setShowDirect((value) => !value)}
                >
                  {showDirect
                    ? 'Hide direct-view metrics'
                    : 'Show direct-view metrics'}
                </button>
              )}
              {loading ? (
                <div className="analytics-loading" role="status">
                  Loading restricted analytics…
                  <div />
                  <div />
                  <div />
                </div>
              ) : !ready ? (
                <div className="analytics-empty">
                  <h3>
                    {error
                      ? 'Report access unavailable'
                      : 'No report to display'}
                  </h3>
                  <p>
                    Use Reload data after access or reporting health has been
                    restored. Counts are hidden while the report is unavailable.
                  </p>
                </div>
              ) : (
                <>
                  {snapshot &&
                    filters &&
                    ((snapshot.startDate &&
                      filters.startDate < snapshot.startDate) ||
                      (snapshot.endDate &&
                        filters.endDate > snapshot.endDate)) && (
                      <div className="analytics-notice" role="note">
                        This selection extends beyond reporting coverage. Only
                        retained data is included.
                      </div>
                    )}
                  <div className="analytics-export">
                    <button
                      className="analytics-reset"
                      disabled={rows.length === 0}
                      onClick={downloadTable}
                    >
                      Download CSV
                    </button>
                    <button
                      className="analytics-reset"
                      disabled={rows.length === 0}
                      onClick={copyTable}
                    >
                      Copy as CSV
                    </button>
                    <span role="status" aria-live="polite">
                      {exportStatus}
                    </span>
                  </div>
                  <div
                    className="analytics-table-scroll"
                    role="region"
                    aria-label={`${current.label} results`}
                    tabIndex={0}
                  >
                    <table>
                      <caption className="sr-only">
                        Recorded activity from {filters?.startDate} through{' '}
                        {filters?.endDate}. Clicks do not prove watches.
                      </caption>
                      <thead>
                        <tr>
                          {visibleFields.map((f) => (
                            <th
                              key={f.key}
                              scope="col"
                              className={numberClass(f.key)}
                              aria-sort={
                                sort.key === f.key
                                  ? sort.desc
                                    ? 'descending'
                                    : 'ascending'
                                  : 'none'
                              }
                            >
                              <button
                                onClick={() =>
                                  setSort((s) => ({
                                    key: f.key,
                                    desc:
                                      s.key === f.key
                                        ? !s.desc
                                        : typeof rows[0]?.[f.key] === 'number',
                                  }))
                                }
                              >
                                {f.label}
                                {sort.key === f.key ? (
                                  <span aria-hidden="true">
                                    {sort.desc ? ' ↓' : ' ↑'}
                                  </span>
                                ) : null}
                              </button>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sorted.slice(page * 25, (page + 1) * 25).map((row) => (
                          <tr key={row.key}>
                            {visibleFields.map((f) => (
                              <td key={f.key} className={numberClass(f.key)}>
                                {f.key === 'title' ? (
                                  <>
                                    <strong>{row.title}</strong>
                                    <small>
                                      {row.youtubeId}
                                      {!row.active ? ' · Historical' : ''}
                                    </small>
                                    {view === 'video' && (
                                      <button
                                        className="analytics-row-link"
                                        onClick={() =>
                                          showKeywords(row.youtubeId)
                                        }
                                      >
                                        View keywords
                                      </button>
                                    )}
                                  </>
                                ) : f.key === 'category' ? (
                                  categoryName(row.category)
                                ) : typeof row[f.key] === 'number' ? (
                                  snapshot?.collectionAvailable === false ? (
                                    'Unavailable'
                                  ) : (
                                    number(row[f.key] as number)
                                  )
                                ) : (
                                  String(row[f.key])
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {rows.length === 0 && (
                    <div className="analytics-empty">
                      <h3>No items match these filters</h3>
                      <p>
                        Try a wider date range, another source, or reset the
                        filters. A zero means no recorded activity in this
                        period, not never used.
                      </p>
                    </div>
                  )}
                  <div className="analytics-pagination">
                    <span>
                      {rows.length
                        ? `${page * 25 + 1}–${Math.min((page + 1) * 25, rows.length)} of ${number(rows.length)}`
                        : '0 results'}
                    </span>
                    <div>
                      <button
                        className="analytics-button"
                        disabled={page === 0}
                        onClick={() => setPage((p) => p - 1)}
                      >
                        Previous
                      </button>
                      <button
                        className="analytics-button"
                        disabled={(page + 1) * 25 >= rows.length}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </>
              )}
              <footer className="analytics-footnote">
                Canonical keywords only; original search wording is not
                retained.{' '}
                {snapshot?.retainedFrom
                  ? `Retained receipts: ${dateLabel(snapshot.retainedFrom)} to ${dateLabel(snapshot.retainedThrough)}.`
                  : ''}{' '}
                Anonymous delivery is best effort, so counts are estimates.
              </footer>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
