import type { IntakeProfile } from '../contracts/intakeProfile';
import type { PublicCatalog } from '../contracts/publicCatalog';
import type { RankedMatch } from '../contracts/rankedMatch';
import type { UsageEvent } from '../contracts/usageEvent';
import { canonicalTaskName } from '../contracts/taskVocabulary';
import { expandSynonyms, normalizeText } from '../engine/vocabulary';
import type { RecommendationSelection } from '../recommendations/selectRecommendations';
import type { UsageSession } from './usageSession';
import { feedbackVote, type FeedbackBinding } from '../feedback/vote';

type SearchEvent = Extract<UsageEvent, { type: 'search' }>;
type MatchType = Extract<UsageEvent, { type: 'impression' }>['matchType'];
type Target = Extract<UsageEvent, { type: 'click' }>['target'];

export function canonicalGoalTasks(words: string[], catalog: PublicCatalog) {
  const expanded = new Set(words.flatMap(expandSynonyms));
  const goal = words.flatMap(normalizeText);
  const hasAlias = (alias: string) => {
    const parts = normalizeText(alias);
    return (
      parts.length > 0 &&
      goal.some((_, start) =>
        parts.every((part, offset) => goal[start + offset] === part),
      )
    );
  };
  return catalog.tasks
    .filter(
      (task) =>
        task.length <= 120 &&
        ([task, canonicalTaskName(task)].some((name) =>
          normalizeText(name).some((word) => expanded.has(word)),
        ) ||
          catalog.synonyms.some(
            (row) =>
              row.category === 'task' &&
              row.target === task &&
              hasAlias(row.alias),
          )),
    )
    .slice(0, 50);
}

export function usageMatchType(
  match: RankedMatch,
  profile: IntakeProfile,
): MatchType {
  if (
    match.matchType === 'strong' ||
    match.matchType === 'semantic' ||
    match.matchType === 'cross-area'
  )
    return match.matchType;
  if (match.item.isStartHere) return 'start-here';
  if (
    profile.functionArea !== null &&
    !match.item.functionAreas.includes(profile.functionArea)
  )
    return 'cross-area';
  return 'weak';
}

function fallbackType(types: MatchType[]): SearchEvent['fallbackType'] {
  if (types.length === 0) return 'unavailable';
  const crossArea = types.includes('cross-area');
  const startHere = types.includes('start-here');
  if (crossArea && startHere) return 'mixed';
  return crossArea ? 'cross-area' : startHere ? 'start-here' : 'none';
}

export function createRecommendationUsage(
  session: UsageSession,
  catalog: PublicCatalog,
  profile: IntakeProfile,
  initialResults: RankedMatch[],
  submitted: boolean,
  metadata: Omit<RecommendationSelection, 'results'> = {
    recommendationEngine: 'rules',
    llmFallbackReason: 'not-requested',
  },
) {
  const common = {
    schemaVersion: 1 as const,
    sessionId: session.sessionId,
    searchId: crypto.randomUUID(),
    mode: 'recommendations' as const,
    src: session.src,
    catalogVersion: catalog.catalogVersion,
    recommendationEngine: metadata.recommendationEngine,
    llmFallbackReason: metadata.llmFallbackReason,
    ...(metadata.modelVersion && metadata.promptVersion
      ? {
          modelVersion: metadata.modelVersion,
          promptVersion: metadata.promptVersion,
        }
      : {}),
  };
  // Capture only dictionary values; no goal, title, reason or URL enters an event.
  const search = {
    type: 'search' as const,
    functionArea:
      profile.functionArea &&
      catalog.functionAreas.includes(profile.functionArea)
        ? profile.functionArea
        : null,
    tools: [
      ...new Set(profile.tools.filter((tool) => catalog.tools.includes(tool))),
    ],
    tasks: canonicalGoalTasks(profile.goalWords, catalog),
    resultCount: initialResults.length,
    strongMatchCount: initialResults.filter(
      (match) => match.matchType === 'strong',
    ).length,
    fallbackType: fallbackType(
      initialResults.map((match) => usageMatchType(match, profile)),
    ),
  };
  const activeIds = new Set(catalog.items.map((item) => item.youtubeId));
  // Keep the profile in the current UI context, never in the delivery queue.
  let started = false;
  const seen = new Set<string>();
  const send = (fields: object) => {
    void session.sender.send(
      {
        ...common,
        eventId: crypto.randomUUID(),
        time: new Date().toISOString(),
        ...fields,
      },
      catalog,
    );
  };
  const start = () => {
    if (started) return;
    started = true;
    if (submitted) send(search);
  };
  const impression = (match: RankedMatch, index: number) => {
    if (!activeIds.has(match.item.youtubeId) || seen.has(match.item.youtubeId))
      return;
    seen.add(match.item.youtubeId);
    send({
      type: 'impression',
      youtubeId: match.item.youtubeId,
      rank: index + 1,
      matchType: usageMatchType(match, profile),
    });
  };
  return {
    feedback(match: RankedMatch, index: number): FeedbackBinding {
      return {
        vote: feedbackVote(session, match.item.youtubeId),
        source: {
          ...common,
          youtubeId: match.item.youtubeId,
          rank: index + 1,
          matchType: usageMatchType(match, profile),
        },
        catalog,
      };
    },
    display(results: RankedMatch[]) {
      start();
      results.forEach(impression);
    },
    click(match: RankedMatch, index: number, target: Target) {
      start();
      impression(match, index);
      send({
        type: 'click',
        youtubeId: match.item.youtubeId,
        rank: index + 1,
        matchType: usageMatchType(match, profile),
        target,
      });
    },
  };
}
