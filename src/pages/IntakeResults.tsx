import { useEffect, useMemo, useRef, useState } from 'react';
import type { CatalogItem } from '../contracts/catalogItem';
import type { IntakeProfile } from '../contracts/intakeProfile';
import { feedbackQuestion } from '../feedback/vote';
import {
  recommendationsEnabled,
  requestRecommendations,
} from '../recommendations/requestRecommendations';
import {
  rulesSelection,
  type RecommendationSelection,
} from '../recommendations/selectRecommendations';
import { deterministicSelection } from '../recommendations/deterministicSelection';
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
  publicCatalog?: PublicCatalog;
}

export function IntakeResults({
  catalog,
  availableFunctionAreas,
  availableTools: dictionaryTools,
  usage,
  recommendationCatalog,
  publicCatalog,
}: IntakeResultsProps) {
  const [engine, setEngine] = useState<'rules' | 'llm'>('rules');
  const [functionArea, setFunctionArea] = useState<string | null>(null);
  const [goalText, setGoalText] = useState('');
  const [tools, setTools] = useState<string[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [completed, setCompleted] = useState<{
    profile: IntakeProfile;
    state: RecommendationState;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const profile = completed?.profile ?? EMPTY_PROFILE;
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
    return (
      completed?.state.selection ??
      rulesSelection(catalog, EMPTY_PROFILE, 'not-requested')
    );
  }, [catalog, completed, engine]);
  const llmEnabled =
    recommendationsEnabled() && recommendationCatalog !== undefined;
  useEffect(() => () => pending.current?.abort(), []);

  const availableTools = useMemo(
    () => dictionaryTools ?? availableToolsFrom(catalog),
    [catalog, dictionaryTools],
  );

  const results = useMemo(
    () => (loading ? [] : selection.results),
    [loading, selection.results],
  );
  const usageSession = usage?.session;
  const usageCatalog = usage?.catalog;
  const question = feedbackQuestion();
  const usageContext = useMemo(
    () =>
      !loading &&
      completed?.state.status !== 'unavailable' &&
      usageSession &&
      usageCatalog
        ? createRecommendationUsage(
            usageSession,
            usageCatalog,
            profile,
            results,
            completed !== null,
            selection,
          )
        : null,
    [
      usageSession,
      usageCatalog,
      profile,
      selection,
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
    if (engine === 'rules') {
      const snapshot = publicCatalog ?? recommendationCatalog ?? usageCatalog;
      const selected = goalText.trim()
        ? snapshot
          ? deterministicSelection(snapshot, goalText, nextProfile)
          : null
        : rulesSelection(catalog, nextProfile, 'not-requested');
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
          <h2 id="search-panel-title">What are you working on?</h2>
        </div>
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
        {engine === 'llm' && (
          <p className="usage-notice" id="ai-disclosure">
            AI suggestions send your goal and selected options to Anthropic.
            Leave out personal information. Results can take up to 35 seconds.
            {!llmEnabled && ' AI calls are disabled in this deployment.'}
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
          : completed?.state.status === 'unavailable'
            ? completed.state.reason === 'not-requested'
              ? 'Enter a task description to request AI recommendations.'
              : engine === 'llm'
                ? 'AI recommendations are unavailable. You can select Deterministic and submit again.'
                : 'The catalog is unavailable for deterministic matching.'
            : completed?.state.status === 'abstained'
              ? 'No confident AI matches found.'
              : completed
                ? results.length === 0
                  ? 'No compatible videos found.'
                  : engine === 'llm'
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
    </>
  );
}
