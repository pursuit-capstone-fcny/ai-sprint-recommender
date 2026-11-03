import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { CatalogItem } from '../contracts/catalogItem';
import type { IntakeProfile } from '../contracts/intakeProfile';
import { feedbackQuestion } from '../feedback/vote';
import {
  recommendationsEnabled,
  requestRecommendations,
} from '../recommendations/requestRecommendations';
import type { RecommendationSelection } from '../recommendations/selectRecommendations';
import { deterministicSelection } from '../recommendations/deterministicSelection';
import { fallbackVideos } from '../recommendations/fallbackVideos';
import { defaultVideos } from '../recommendations/curatedVideos';
import {
  selectRecommendationState,
  type RecommendationState,
} from '../recommendations/selectRecommendationState';
import type { PublicCatalog } from '../contracts/publicCatalog';
import { createRecommendationUsage } from '../usage/usageContext';
import type { UsageSession } from '../usage/usageSession';
import { IntakeForm } from './IntakeForm';
import { RESULTS_HEADING_ID, ResultsList } from './ResultsList';
import { RequestForm } from '../requests/RequestForm';
import { DiscoveryHero } from './DiscoveryHero';

const EMPTY_PROFILE: IntakeProfile = {
  functionArea: null,
  goalWords: [],
  tools: [],
};

function defaultSelection(catalog: CatalogItem[]): RecommendationSelection {
  return {
    results: defaultVideos(catalog),
    recommendationEngine: 'rules',
    llmFallbackReason: 'not-requested',
  };
}
function splitGoalWords(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

interface IntakeResultsProps {
  catalog: CatalogItem[];
  catalogNotice?: ReactNode;
  usage?: { session: UsageSession; catalog: PublicCatalog };
  recommendationCatalog?: PublicCatalog;
  publicCatalog?: PublicCatalog;
}

export function IntakeResults({
  catalog,
  catalogNotice,
  usage,
  recommendationCatalog,
  publicCatalog,
}: IntakeResultsProps) {
  const [engine, setEngine] = useState<'rules' | 'llm'>('rules');
  const [goalText, setGoalText] = useState('');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [completed, setCompleted] = useState<{
    profile: IntakeProfile;
    state: RecommendationState;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [browsingProfile, setBrowsingProfile] = useState(EMPTY_PROFILE);
  const pending = useRef<AbortController | null>(null);
  const profile = completed?.profile ?? browsingProfile;
  const selection = useMemo<RecommendationSelection>(() => {
    if (
      completed?.state.status === 'unavailable' ||
      (engine === 'llm' && !completed)
    )
      return {
        results: [],
        recommendationEngine: engine,
        llmFallbackReason: 'none',
      };
    return completed?.state.selection ?? defaultSelection(catalog);
  }, [catalog, completed, engine]);
  const llmEnabled =
    recommendationsEnabled() && recommendationCatalog !== undefined;
  useEffect(() => () => pending.current?.abort(), []);

  const displayedSelection = useMemo<RecommendationSelection>(() => {
    if (
      !completed ||
      completed.profile.goalWords.length === 0 ||
      selection.results.length > 0 ||
      (completed.state.status === 'unavailable' &&
        completed.state.reason === 'not-requested')
    )
      return selection;
    const fallbacks = fallbackVideos(catalog);
    if (fallbacks.length === 0) return selection;
    return {
      ...selection,
      results: fallbacks,
      // These cards are local catalog suggestions, never successful AI picks.
      recommendationEngine: 'rules',
      llmFallbackReason:
        engine === 'llm'
          ? completed.state.status === 'unavailable'
            ? completed.state.reason
            : 'insufficient-results'
          : 'not-requested',
    };
  }, [catalog, completed, engine, selection]);
  const fallbackOnly =
    !loading &&
    displayedSelection !== selection &&
    displayedSelection.results.length > 0;
  const results = useMemo(
    () => (loading ? [] : displayedSelection.results),
    [loading, displayedSelection.results],
  );
  const usageSession = usage?.session;
  const usageCatalog = usage?.catalog;
  const question = feedbackQuestion();
  const usageContext = useMemo(
    () =>
      !loading &&
      (completed?.state.status !== 'unavailable' || fallbackOnly) &&
      usageSession &&
      usageCatalog
        ? createRecommendationUsage(
            usageSession,
            usageCatalog,
            profile,
            results,
            completed !== null,
            displayedSelection,
          )
        : null,
    [
      usageSession,
      usageCatalog,
      profile,
      displayedSelection,
      fallbackOnly,
      completed,
      results,
      loading,
    ],
  );
  useEffect(() => {
    usageContext?.display(results);
  }, [usageContext, results]);

  function cancelPending() {
    pending.current?.abort();
    pending.current = null;
    setLoading(false);
  }

  function handleClearFilters() {
    cancelPending();
    setGoalText('');
    setPlayingId(null);
    setCompleted(null);
    // A fresh profile resets usage even when Clear is pressed while browsing.
    setBrowsingProfile({ ...EMPTY_PROFILE });
  }

  function handleFindVideos() {
    cancelPending();
    const nextProfile: IntakeProfile = {
      functionArea: null,
      goalWords: splitGoalWords(goalText),
      tools: [],
    };
    const blank = !goalText.trim();
    if (engine === 'rules') {
      const snapshot = publicCatalog ?? recommendationCatalog ?? usageCatalog;
      const selected = goalText.trim()
        ? snapshot
          ? deterministicSelection(snapshot, goalText, nextProfile)
          : null
        : defaultSelection(catalog);
      setCompleted({
        profile: nextProfile,
        state: selected
          ? { status: 'ready', selection: selected }
          : { status: 'unavailable', reason: 'unavailable' },
      });
    } else if (
      !llmEnabled ||
      !recommendationCatalog ||
      blank ||
      !goalText.trim()
    ) {
      setCompleted({
        profile: nextProfile,
        state: {
          status: 'unavailable',
          reason: llmEnabled ? 'not-requested' : 'disabled',
        },
      });
    } else {
      const controller = new AbortController();
      pending.current = controller;
      setCompleted(null);
      setLoading(true);
      void requestRecommendations(
        {
          functionArea: null,
          goal: goalText,
          tools: [],
          catalogVersion: recommendationCatalog.catalogVersion,
        },
        controller.signal,
      ).then((response) => {
        if (pending.current !== controller || controller.signal.aborted) return;
        pending.current = null;
        setLoading(false);
        setCompleted({
          profile: nextProfile,
          state: selectRecommendationState(
            catalog,
            nextProfile,
            recommendationCatalog.catalogVersion,
            response,
          ),
        });
      });
    }
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
      <DiscoveryHero>
        <form
          className="search-panel"
          aria-labelledby="search-panel-title"
          aria-describedby={engine === 'llm' ? 'ai-disclosure' : undefined}
          onSubmit={(event) => {
            event.preventDefault();
            handleFindVideos();
          }}
        >
          <div className="panel-head">
            <h2 id="search-panel-title" className="sr-only">
              What are you working on?
            </h2>
          </div>
          <IntakeForm
            goalText={goalText}
            onGoalTextChange={(value) => {
              cancelPending();
              setGoalText(value);
            }}
          />
          <fieldset className="engine-choice">
            <legend>Recommendation engine</legend>
            {(
              [
                ['rules', 'Deterministic'],
                ['llm', 'Haiku AI'],
              ] as const
            ).map(([value, label]) => (
              <label key={value}>
                <input
                  type="radio"
                  name="recommendation-engine"
                  value={value}
                  checked={engine === value}
                  onChange={() => {
                    cancelPending();
                    setEngine(value);
                    setCompleted(null);
                    setPlayingId(null);
                  }}
                />
                {label}
              </label>
            ))}
          </fieldset>
          {engine === 'llm' && (
            <p className="usage-notice" id="ai-disclosure">
              AI suggestions send your goal to Anthropic. Leave out personal
              information.{' '}
              {import.meta.env.VITE_LLM_QUEUE_ENABLED === 'true'
                ? 'During busy sessions, results can take up to 5 minutes. You can clear this search to cancel.'
                : 'Results can take up to 7 seconds.'}
              {!llmEnabled && ' AI calls are disabled in this deployment.'}
            </p>
          )}
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              Find videos
              <svg
                className="submit-arrow"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M4 12h16m-6-6 6 6-6 6" />
              </svg>
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
      </DiscoveryHero>
      <div className="page-body">
        {catalogNotice}
        <p role="status" className="catalog-notice">
          {loading
            ? 'Finding AI suggestions…'
            : completed?.state.status === 'unavailable'
              ? completed.state.reason === 'not-requested'
                ? 'Enter a task description to request AI recommendations.'
                : engine === 'llm'
                  ? 'AI recommendations are unavailable.'
                  : 'The catalog is unavailable for deterministic matching.'
              : completed?.state.status === 'abstained'
                ? 'No confident AI matches found.'
                : completed
                  ? selection.results.length === 0
                    ? 'No compatible videos found.'
                    : engine === 'llm'
                      ? 'AI suggestions'
                      : 'Standard matching'
                  : null}
        </p>
        <ResultsList
          fallbackOnly={fallbackOnly}
          feedback={
            question && usageContext
              ? { question, bind: usageContext.feedback }
              : undefined
          }
          loading={loading}
          results={results}
          playingId={playingId}
          onPlay={setPlayingId}
          showClosestMatch={profile.functionArea !== null}
          onVideoClick={(match, index, target) =>
            usageContext?.click(match, index, target)
          }
        />
        <RequestForm
          fallback={
            results.length === 0 ||
            results.some(
              (match) =>
                match.matchType === 'fallback' ||
                match.matchType === 'cross-area',
            )
          }
        />
      </div>
    </>
  );
}
