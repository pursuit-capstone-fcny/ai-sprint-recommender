import { useEffect, useMemo, useState } from 'react';
import type { CatalogItem } from '../contracts/catalogItem';
import type { IntakeProfile } from '../contracts/intakeProfile';
import { rank } from '../engine';
import { IntakeForm } from './IntakeForm';
import { ResultsList } from './ResultsList';

const PAGE_SIZE = 3;

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
}

export function IntakeResults({ catalog }: IntakeResultsProps) {
  const [functionArea, setFunctionArea] = useState<string | null>(null);
  const [goalText, setGoalText] = useState('');
  const [tools, setTools] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const availableTools = useMemo(() => availableToolsFrom(catalog), [catalog]);

  const profile: IntakeProfile = useMemo(
    () => ({ functionArea, goalWords: splitGoalWords(goalText), tools }),
    [functionArea, goalText, tools],
  );

  // A new query starts over at the top, rather than keeping whatever
  // "Show more" depth the previous query had reached.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [profile]);

  const windowResults = useMemo(
    () => rank(catalog, profile, { topN: visibleCount }).slice(0, visibleCount),
    [catalog, profile, visibleCount],
  );

  const isGlobalFallback = windowResults[0]?.matchType === 'fallback';

  const results = isGlobalFallback
    ? windowResults
    : windowResults.filter((match) => match.matchType === 'strong');

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

  return (
    <>
      <IntakeForm
        functionArea={functionArea}
        onFunctionAreaChange={setFunctionArea}
        goalText={goalText}
        onGoalTextChange={setGoalText}
        availableTools={availableTools}
        selectedTools={tools}
        onToggleTool={handleToggleTool}
      />
      <ResultsList
        results={results}
        playingId={playingId}
        onPlay={setPlayingId}
        canShowMore={canShowMore}
        onShowMore={() => setVisibleCount((count) => count + PAGE_SIZE)}
      />
    </>
  );
}
