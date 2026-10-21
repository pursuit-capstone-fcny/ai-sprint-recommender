import type { CatalogItem } from '../contracts/catalogItem';
import type { IntakeProfile } from '../contracts/intakeProfile';
import { expandSynonyms, matchTool, normalizeText } from './vocabulary';
import type { ToolTier } from './vocabulary';

export interface VideoMatch {
  areaMatch: boolean;
  taskMatch: boolean;
  toolTier: ToolTier;
  matchedTask?: string;
  matchedWord?: string;
  matchedTool?: string;
  matchedProfileTool?: string;
}

// 'active': area tier counts normally (AC-11.2). 'none': profile has no
// function area ("Not sure"), area tier is skipped. 'fallback': a function
// area was given but nothing in it is relevant, so area tier is skipped and
// matches are labeled as substitutes rather than real area matches.
export type AreaMode = 'active' | 'none' | 'fallback';

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function expandedGoalWords(goalWords: string[]): Set<string> {
  const expanded = new Set<string>();
  for (const word of goalWords) {
    for (const synonym of expandSynonyms(word)) {
      expanded.add(synonym);
    }
  }
  return expanded;
}

export function computeMatch(
  video: CatalogItem,
  profile: IntakeProfile,
): VideoMatch {
  const areaMatch =
    profile.functionArea !== null &&
    video.functionAreas.some(
      (area) =>
        normalizeKey(area) === normalizeKey(profile.functionArea as string),
    );

  const expanded = expandedGoalWords(profile.goalWords);

  let matchedTask: string | undefined;
  for (const task of video.tasks) {
    if (normalizeText(task).some((token) => expanded.has(token))) {
      matchedTask = task;
      break;
    }
  }

  let matchedWord: string | undefined;
  if (matchedTask === undefined) {
    matchedWord = normalizeText(`${video.title} ${video.description}`).find(
      (token) => expanded.has(token),
    );
  }

  const tool = matchTool(profile.tools, video.tools);

  return {
    areaMatch,
    taskMatch: matchedTask !== undefined || matchedWord !== undefined,
    toolTier: tool.tier,
    matchedTask,
    matchedWord,
    matchedTool: tool.tool,
    matchedProfileTool: tool.profileTool,
  };
}

export function resolveAreaMode(
  profile: IntakeProfile,
  activeVideos: CatalogItem[],
  matches: Map<string, VideoMatch>,
): AreaMode {
  if (profile.functionArea === null) {
    return 'none';
  }

  const hasPreference =
    profile.goalWords.length > 0 || profile.tools.length > 0;
  if (!hasPreference) {
    return 'active';
  }

  const inAreaRelevant = activeVideos.some((video) => {
    const match = matches.get(video.youtubeId)!;
    return match.areaMatch && (match.taskMatch || match.toolTier !== 'none');
  });

  return inAreaRelevant ? 'active' : 'fallback';
}
