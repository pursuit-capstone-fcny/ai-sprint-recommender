import { useEffect, useMemo, useState } from 'react';
import type { PublicCatalog } from '../contracts/publicCatalog';
import { searchTopics, type TopicQuery } from '../engine/topicSearch';
import { createUsageSender } from '../usage/sendUsage';
import { createTopicUsage } from '../usage/topicUsage';
import type { TopicUsageConfig } from './snapshot';
import './topic-search.css';

const blank: TopicQuery = { topic: '', functionAreas: [], tools: [] };
export function TopicSearch({
  catalog,
  collection,
}: {
  catalog: PublicCatalog;
  collection?: TopicUsageConfig;
}) {
  const [topic, setTopic] = useState('');
  const [query, setQuery] = useState(blank);
  const [playing, setPlaying] = useState<string | null>(null);
  const [copy, setCopy] = useState<{ id: string; ok: boolean } | null>(null);
  const results = useMemo(() => searchTopics(catalog, query), [catalog, query]);
  const session = useMemo(
    () =>
      collection
        ? {
            sessionId: crypto.randomUUID(),
            src: 'team' as const,
            sender: createUsageSender(collection.url),
          }
        : null,
    [collection],
  );
  const usage = useMemo(
    () => (session ? createTopicUsage(session, catalog, query, results) : null),
    [session, catalog, query, results],
  );
  useEffect(() => {
    usage?.display();
  }, [usage]);
  useEffect(() => {
    if (!copy) return;
    const timer = setTimeout(() => setCopy(null), 3000);
    return () => clearTimeout(timer);
  }, [copy]);
  function apply(next: TopicQuery) {
    setQuery(next);
    setPlaying(null);
    setCopy(null);
  }
  function toggle(category: 'functionAreas' | 'tools', value: string) {
    apply({
      ...query,
      [category]: query[category].includes(value)
        ? query[category].filter((item) => item !== value)
        : [...query[category], value],
    });
  }
  return (
    <section className="staff-topic-search" aria-labelledby="topic-heading">
      <div className="analytics-table-heading">
        <div>
          <h2 id="topic-heading">Topic search</h2>
          <p>
            Find videos for a staff email or a topic collection. Search titles,
            descriptions and catalog tags.
          </p>
        </div>
      </div>
      <form
        className="topic-search-form"
        onSubmit={(event) => {
          event.preventDefault();
          apply({ ...query, topic: topic.trim() });
        }}
      >
        <label htmlFor="staff-topic">Topic</label>
        <div className="topic-search-input">
          <input
            id="staff-topic"
            type="search"
            maxLength={500}
            placeholder="For example, grant reports or presentations"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            aria-describedby="topic-search-help"
          />
          <button className="analytics-button analytics-primary" type="submit">
            Search videos
          </button>
        </div>
        <p id="topic-search-help">
          Leave the topic blank to browse the complete active library. All topic
          words must match.
        </p>
      </form>
      <div className="topic-filter-groups">
        {(['functionAreas', 'tools'] as const).map((category) => (
          <details key={category}>
            <summary>
              {category === 'functionAreas' ? 'Function areas' : 'Tools'}
              {query[category].length
                ? ` · ${query[category].length} selected`
                : ' · All'}
            </summary>
            <fieldset>
              <legend className="sr-only">
                {category === 'functionAreas'
                  ? 'Filter by function area'
                  : 'Filter by tool'}
              </legend>
              {catalog[category].map((value) => (
                <label key={value} className="analytics-check">
                  <input
                    type="checkbox"
                    checked={query[category].includes(value)}
                    onChange={() => toggle(category, value)}
                  />
                  {value}
                </label>
              ))}
              {!catalog[category].length && (
                <p>
                  No {category === 'tools' ? 'tools' : 'function areas'} in this
                  catalog.
                </p>
              )}
            </fieldset>
          </details>
        ))}
      </div>
      <div className="topic-search-actions">
        <button
          className="analytics-reset"
          disabled={!query.functionAreas.length && !query.tools.length}
          onClick={() => apply({ ...query, functionAreas: [], tools: [] })}
        >
          Clear filters
        </button>
        <button
          className="analytics-reset"
          onClick={() => {
            setTopic('');
            apply({ ...blank });
          }}
        >
          Browse all videos
        </button>
      </div>
      {collection && (
        <p className="topic-collection-notice">
          Staff topic searches log canonical tags, displayed videos and clicks
          as team traffic. Original topic wording is not logged. Retention:{' '}
          {collection.retentionDays}{' '}
          {collection.retentionDays === 1 ? 'day' : 'days'}.
        </p>
      )}
      <div className="topic-result-summary">
        <p role="status" aria-live="polite" aria-atomic="true">
          {results.length}{' '}
          {results.length === 1 ? 'matching video' : 'matching videos'}
          {query.topic ? ` for “${query.topic}”` : ' in the active library'}
        </p>
        <p>
          All matches shown
          {query.topic ? ', best matches first' : ', sorted by title'}.
        </p>
      </div>
      {results.length === 0 ? (
        <div className="analytics-empty">
          <h3>No matching videos</h3>
          <p>
            Try fewer topic words, clear the function and tool filters, or
            browse all videos.
          </p>
        </div>
      ) : (
        <ol className="topic-results">
          {results.map((match, index) => {
            const { item } = match;
            const url = `https://www.youtube.com/watch?v=${item.youtubeId}`;
            return (
              <li key={item.youtubeId}>
                <div className="topic-video-heading">
                  <span
                    className="topic-position"
                    aria-label={`Result ${index + 1}`}
                  >
                    {index + 1}
                  </span>
                  <h3>{item.title}</h3>
                </div>
                <p className="topic-description">{item.description}</p>
                <dl className="topic-video-tags">
                  {(['functionAreas', 'tools', 'tasks'] as const).map(
                    (category) =>
                      item[category].length > 0 && (
                        <div key={category}>
                          <dt>
                            {category === 'functionAreas'
                              ? 'Function'
                              : category === 'tools'
                                ? 'Tools'
                                : 'Tasks'}
                          </dt>
                          <dd>{item[category].join(', ')}</dd>
                        </div>
                      ),
                  )}
                </dl>
                <div className="topic-video-actions">
                  <button
                    className="analytics-button"
                    onClick={() => {
                      setPlaying(
                        playing === item.youtubeId ? null : item.youtubeId,
                      );
                      if (playing !== item.youtubeId)
                        usage?.click(index, 'embed');
                    }}
                    aria-expanded={playing === item.youtubeId}
                  >
                    {playing === item.youtubeId ? 'Close player' : 'Play video'}
                    <span className="sr-only">: {item.title}</span>
                  </button>
                  <a
                    className="analytics-button"
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => usage?.click(index, 'youtube')}
                    onAuxClick={(event) => {
                      if (event.button === 1) usage?.click(index, 'youtube');
                    }}
                  >
                    Watch on YouTube
                    <span className="sr-only">
                      : {item.title} (opens in a new tab)
                    </span>
                  </a>
                  <button
                    className="analytics-reset"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(url);
                        setCopy({ id: item.youtubeId, ok: true });
                      } catch {
                        setCopy({ id: item.youtubeId, ok: false });
                      }
                    }}
                  >
                    Copy link<span className="sr-only">: {item.title}</span>
                  </button>
                  {copy?.id === item.youtubeId && (
                    <span role="status">
                      {copy.ok
                        ? 'Link copied'
                        : 'Could not copy. Use the YouTube link instead.'}
                    </span>
                  )}
                </div>
                {playing === item.youtubeId && (
                  <iframe
                    className="topic-player"
                    src={`https://www.youtube-nocookie.com/embed/${item.youtubeId}?autoplay=1`}
                    title={item.title}
                    allow="autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                  />
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
