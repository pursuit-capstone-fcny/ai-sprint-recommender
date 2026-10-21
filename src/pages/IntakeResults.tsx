import { useEffect, useMemo, useState } from 'react';
import type { CatalogItem } from '../contracts/catalogItem';
import type { IntakeProfile } from '../contracts/intakeProfile';
import { rank } from '../engine';
import type { PublicCatalog } from '../contracts/publicCatalog';
import { createRecommendationUsage } from '../usage/usageContext';
import type { UsageSession } from '../usage/usageSession';
import { IntakeForm } from './IntakeForm';
import { RESULTS_HEADING_ID, ResultsList } from './ResultsList';

const PAGE_SIZE = 3;
const EMPTY_PROFILE: IntakeProfile = {
  functionArea: null,
  goalWords: [],
  tools: [],
};
function displayedResults(
  catalog: CatalogItem[],
  profile: IntakeProfile,
  count: number,
) {
  const matches = rank(catalog, profile, { topN: count }).slice(0, count);
  return matches[0]?.matchType === 'fallback'
    ? matches
    : matches.filter((match) => match.matchType === 'strong');
}

function splitGoalWords(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

function availableToolsFrom(catalog: CatalogItem[]): string[] {
  const tools = new Set<string>();
  for (const item of catalog) {
    for (const tool of item.tools) tools.add(tool);
  }
  return [...tools].sort((a, b) => a.localeCompare(b));
}

interface IntakeResultsProps {
  catalog: CatalogItem[];
  availableFunctionAreas?: readonly string[];
  availableTools?: string[];
  usage?: { session: UsageSession; catalog: PublicCatalog };
}

export function IntakeResults({
  catalog,
  availableFunctionAreas,
  availableTools: dictionaryTools,
  usage,
}: IntakeResultsProps) {
  const [functionArea, setFunctionArea] = useState<string | null>(null);
  const [goalText, setGoalText] = useState('');
  const [tools, setTools] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<IntakeProfile | null>(null);
  const profile = submitted ?? EMPTY_PROFILE;

  const availableTools = useMemo(
    () => dictionaryTools ?? availableToolsFrom(catalog),
    [catalog, dictionaryTools],
  );

  const results = useMemo(
    () => displayedResults(catalog, profile, visibleCount),
    [catalog, profile, visibleCount],
  );
  const isGlobalFallback = results[0]?.matchType === 'fallback';
  const usageSession = usage?.session;
  const usageCatalog = usage?.catalog;
  const usageContext = useMemo(
    () =>
      usageSession && usageCatalog
        ? createRecommendationUsage(
            usageSession,
            usageCatalog,
            profile,
            displayedResults(catalog, profile, PAGE_SIZE),
            submitted !== null,
          )
        : null,
    [usageSession, usageCatalog, profile, catalog, submitted],
  );
  useEffect(() => {
    usageContext?.display(results);
  }, [usageContext, results]);

  const canShowMore = useMemo(() => {
    if (isGlobalFallback) return false;
    const nextWindow = rank(catalog, profile, {
      topN: visibleCount + PAGE_SIZE,
    });
    return nextWindow
      .slice(visibleCount, visibleCount + PAGE_SIZE)
      .some((match) => match.matchType === 'strong');
  }, [catalog, profile, visibleCount, isGlobalFallback]);

  function handleToggleTool(tool: string) {
    setTools((current) =>
      current.includes(tool)
        ? current.filter((t) => t !== tool)
        : [...current, tool],
    );
  }

  function handleClearFilters() {
    setFunctionArea(null);
    setGoalText('');
    setTools([]);
    setPlayingId(null);
    setVisibleCount(PAGE_SIZE);
    setSubmitted(null);
  }

  function handleFindVideos() {
    setSubmitted({
      functionArea,
      goalWords: splitGoalWords(goalText),
      tools: [...tools],
    });
    setVisibleCount(PAGE_SIZE);
    setPlayingId(null);
    const heading = document.getElementById(RESULTS_HEADING_ID);
    if (!heading) return;
    const reduceMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    heading.scrollIntoView?.({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'start',
    });
    heading.focus({ preventScroll: true });
  }

  return (
    <>
      <form
        className="search-panel"
        aria-labelledby="search-panel-title"
        onSubmit={(event) => {
          event.preventDefault();
          handleFindVideos();
        }}
      >
        <div className="panel-head">
          <h2 id="search-panel-title">What are you working on?</h2>
        </div>
        <IntakeForm
          functionArea={functionArea}
          onFunctionAreaChange={setFunctionArea}
          goalText={goalText}
          onGoalTextChange={setGoalText}
          availableTools={availableTools}
          availableFunctionAreas={availableFunctionAreas}
          selectedTools={tools}
          onToggleTool={handleToggleTool}
        />
        {usageContext && (
          <p className="usage-notice">
            Test preview: we log search tags, displayed videos, clicks, time and
            source with a random ID for this page visit. Your typed goal is not
            logged. Logs are kept for one day; cleanup runs hourly.
          </p>
        )}
        <div className="form-actions">
          <button type="submit" className="btn btn-primary">
            Find videos
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleClearFilters}
          >
            Clear
          </button>
        </div>
      </form>
      <ResultsList
        results={results}
        playingId={playingId}
        onPlay={setPlayingId}
        canShowMore={canShowMore}
        onShowMore={() => setVisibleCount((count) => count + PAGE_SIZE)}
        showClosestMatch={profile.functionArea !== null}
        onVideoClick={(match, index, target) =>
          usageContext?.click(match, index, target)
        }
      />
    </>
  );
}
