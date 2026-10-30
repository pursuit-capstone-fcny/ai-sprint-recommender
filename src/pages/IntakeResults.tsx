import { useEffect, useMemo, useRef, useState } from 'react';
import type { CatalogItem } from '../contracts/catalogItem';
import type { IntakeProfile } from '../contracts/intakeProfile';
import { rank } from '../engine';
import { feedbackQuestion } from '../feedback/vote';
import {
  recommendationsEnabled,
  requestRecommendations,
} from '../recommendations/requestRecommendations';
import {
  rulesSelection,
  selectRecommendations,
  selectRulesResults,
  type RecommendationSelection,
} from '../recommendations/selectRecommendations';
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
  recommendationCatalog?: PublicCatalog;
}

export function IntakeResults({
  catalog,
  availableFunctionAreas,
  availableTools: dictionaryTools,
  usage,
  recommendationCatalog,
}: IntakeResultsProps) {
  const [functionArea, setFunctionArea] = useState<string | null>(null);
  const [goalText, setGoalText] = useState('');
  const [tools, setTools] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [completed, setCompleted] = useState<{
    profile: IntakeProfile;
    selection: RecommendationSelection;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const profile = completed?.profile ?? EMPTY_PROFILE;
  const selection = useMemo(
    () =>
      completed?.selection ??
      rulesSelection(catalog, EMPTY_PROFILE, 'not-requested'),
    [catalog, completed],
  );
  const llmEnabled =
    recommendationsEnabled() && recommendationCatalog !== undefined;
  useEffect(() => () => pending.current?.abort(), []);

  const availableTools = useMemo(
    () => dictionaryTools ?? availableToolsFrom(catalog),
    [catalog, dictionaryTools],
  );

  const results = useMemo(
    () =>
      selection.recommendationEngine === 'llm'
        ? selection.results.slice(0, visibleCount)
        : selectRulesResults(catalog, profile, visibleCount),
    [catalog, profile, visibleCount, selection],
  );
  const isGlobalFallback = results[0]?.matchType === 'fallback';
  const usageSession = usage?.session;
  const usageCatalog = usage?.catalog;
  const question = feedbackQuestion();
  const usageContext = useMemo(
    () =>
      usageSession && usageCatalog
        ? createRecommendationUsage(
            usageSession,
            usageCatalog,
            profile,
            selection.results.slice(0, PAGE_SIZE),
            completed !== null,
            selection,
          )
        : null,
    [usageSession, usageCatalog, profile, selection, completed],
  );
  useEffect(() => {
    usageContext?.display(results);
  }, [usageContext, results]);

  const canShowMore = useMemo(() => {
    if (selection.recommendationEngine === 'llm')
      return selection.results.length > visibleCount;
    if (isGlobalFallback) return false;
    const nextWindow = rank(catalog, profile, {
      topN: visibleCount + PAGE_SIZE,
    });
    return nextWindow
      .slice(visibleCount, visibleCount + PAGE_SIZE)
      .some((match) => match.matchType === 'strong');
  }, [catalog, profile, visibleCount, isGlobalFallback, selection]);

  function cancelPending() {
    pending.current?.abort();
    pending.current = null;
    setLoading(false);
  }

  function handleToggleTool(tool: string) {
    cancelPending();
    setTools((current) =>
      current.includes(tool)
        ? current.filter((t) => t !== tool)
        : [...current, tool],
    );
  }

  function handleClearFilters() {
    cancelPending();
    setFunctionArea(null);
    setGoalText('');
    setTools([]);
    setPlayingId(null);
    setVisibleCount(PAGE_SIZE);
    setCompleted(null);
  }

  function handleFindVideos() {
    cancelPending();
    const nextProfile = {
      functionArea,
      goalWords: splitGoalWords(goalText),
      tools: [...tools],
    };
    const blank =
      functionArea === null && !goalText.trim() && tools.length === 0;
    if (!llmEnabled || blank || !recommendationCatalog) {
      setCompleted({
        profile: nextProfile,
        selection: rulesSelection(
          catalog,
          nextProfile,
          blank ? 'not-requested' : 'disabled',
        ),
      });
    } else {
      const controller = new AbortController();
      pending.current = controller;
      setLoading(true);
      void requestRecommendations(
        {
          functionArea,
          goal: goalText,
          tools: [...tools],
          catalogVersion: recommendationCatalog.catalogVersion,
        },
        controller.signal,
      ).then((response) => {
        if (pending.current !== controller || controller.signal.aborted) return;
        pending.current = null;
        setLoading(false);
        setCompleted({
          profile: nextProfile,
          selection: selectRecommendations(
            catalog,
            nextProfile,
            recommendationCatalog.catalogVersion,
            response,
          ),
        });
      });
    }
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
        aria-describedby={llmEnabled ? 'ai-disclosure' : undefined}
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
          onFunctionAreaChange={(value) => {
            cancelPending();
            setFunctionArea(value);
          }}
          goalText={goalText}
          onGoalTextChange={(value) => {
            cancelPending();
            setGoalText(value);
          }}
          availableTools={availableTools}
          availableFunctionAreas={availableFunctionAreas}
          selectedTools={tools}
          onToggleTool={handleToggleTool}
        />
        {llmEnabled && (
          <p className="usage-notice" id="ai-disclosure">
            AI suggestions send your goal and selected options to Anthropic.
            Leave out personal information.
          </p>
        )}
        {usage && (
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
      <p role="status" className="catalog-notice">
        {loading
          ? 'Finding AI suggestions…'
          : completed
            ? selection.recommendationEngine === 'llm'
              ? 'AI suggestions'
              : 'Standard matching'
            : null}
      </p>
      <ResultsList
        feedback={
          question && usageContext
            ? { question, bind: usageContext.feedback }
            : undefined
        }
        loading={loading}
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
