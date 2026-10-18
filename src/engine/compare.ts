import type { CatalogItem } from '../contracts/catalogItem';
import type { AreaMode, VideoMatch } from './match';

const TOOL_TIER_RANK: Record<VideoMatch['toolTier'], number> = {
  exact: 2,
  adjacent: 1,
  none: 0,
};

// Tier order: area -> task -> tool -> isStartHere -> addedAt -> youtubeId.
// isStartHere is not one of AC-11's literal tiers; it's inserted here so
// AC-13.3's start-here fallback can reuse this same comparator instead of a
// separate re-sort pass. It only ever breaks ties already made by area/task/
// tool, so it can't change any AC-11 outcome.
export function buildComparator(
  areaMode: AreaMode,
  matches: Map<string, VideoMatch>,
): (a: CatalogItem, b: CatalogItem) => number {
  return (a, b) => {
    const matchA = matches.get(a.youtubeId)!;
    const matchB = matches.get(b.youtubeId)!;

    if (areaMode === 'active') {
      const areaDiff = Number(matchB.areaMatch) - Number(matchA.areaMatch);
      if (areaDiff !== 0) return areaDiff;
    }

    const taskDiff = Number(matchB.taskMatch) - Number(matchA.taskMatch);
    if (taskDiff !== 0) return taskDiff;

    const toolDiff =
      TOOL_TIER_RANK[matchB.toolTier] - TOOL_TIER_RANK[matchA.toolTier];
    if (toolDiff !== 0) return toolDiff;

    const startHereDiff = Number(b.isStartHere) - Number(a.isStartHere);
    if (startHereDiff !== 0) return startHereDiff;

    if (a.addedAt !== b.addedAt) {
      return a.addedAt < b.addedAt ? 1 : -1;
    }

    if (a.youtubeId === b.youtubeId) return 0;
    return a.youtubeId < b.youtubeId ? -1 : 1;
  };
}
