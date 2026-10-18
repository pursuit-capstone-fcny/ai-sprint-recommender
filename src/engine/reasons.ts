import type { CatalogItem } from '../contracts/catalogItem';
import type { IntakeProfile } from '../contracts/intakeProfile';
import type { AreaMode, VideoMatch } from './match';

export type MatchType = 'strong' | 'fallback';

export interface ReasonResult {
  reason: string;
  matchType: MatchType;
}

function taskLabel(video: CatalogItem, match: VideoMatch): string {
  return (
    match.matchedTask ?? match.matchedWord ?? video.tasks[0] ?? video.title
  );
}

function videoAreaLabel(video: CatalogItem): string {
  return video.functionAreas[0] ?? 'the catalog';
}

function toolSentence(match: VideoMatch): string {
  if (match.toolTier === 'adjacent') {
    return `Made with ${match.matchedTool}, close to ${match.matchedProfileTool}`;
  }
  return `Made with ${match.matchedTool}`;
}

function toolClause(match: VideoMatch): string {
  if (match.toolTier === 'adjacent') {
    return `made with ${match.matchedTool}, close to ${match.matchedProfileTool}`;
  }
  return `made with ${match.matchedTool}`;
}

// See the plan's matchType/reason decision table for the full rationale.
// OTHER_AREA_GAP (the "no X video yet" framing) only ever fires in
// areaMode 'fallback' — using it in 'active' mode would claim a gap that
// doesn't exist, since an in-area match was found elsewhere in that mode.
export function buildReason(
  video: CatalogItem,
  profile: IntakeProfile,
  match: VideoMatch,
  areaMode: AreaMode,
): ReasonResult {
  const hasAnyMatch =
    match.areaMatch || match.taskMatch || match.toolTier !== 'none';

  if (!hasAnyMatch) {
    if (video.isStartHere) {
      return { reason: 'A good place to start.', matchType: 'fallback' };
    }
    if (areaMode === 'fallback') {
      return {
        reason: `No ${profile.functionArea} video on this yet. This one's from ${videoAreaLabel(video)}.`,
        matchType: 'fallback',
      };
    }
    return {
      reason: `More from ${videoAreaLabel(video)}.`,
      matchType: 'fallback',
    };
  }

  if (areaMode === 'active' && match.areaMatch) {
    if (match.taskMatch) {
      return {
        reason: `In ${profile.functionArea}, about ${taskLabel(video, match)}`,
        matchType: 'strong',
      };
    }
    return { reason: `In ${profile.functionArea}`, matchType: 'strong' };
  }

  if (areaMode === 'fallback') {
    if (match.taskMatch) {
      return {
        reason: `No ${profile.functionArea} video on this yet. This one's from ${videoAreaLabel(video)}, about ${taskLabel(video, match)}.`,
        matchType: 'fallback',
      };
    }
    return {
      reason: `No ${profile.functionArea} video on this yet. This one's from ${videoAreaLabel(video)}, ${toolClause(match)}.`,
      matchType: 'fallback',
    };
  }

  if (match.taskMatch) {
    return { reason: `About ${taskLabel(video, match)}`, matchType: 'strong' };
  }
  return { reason: toolSentence(match), matchType: 'strong' };
}
