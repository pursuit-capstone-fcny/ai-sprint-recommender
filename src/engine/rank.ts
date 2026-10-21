import type { CatalogItem } from '../contracts/catalogItem';
import type { IntakeProfile } from '../contracts/intakeProfile';
import type { RankedMatch } from '../contracts/rankedMatch';
import { buildComparator } from './compare';
import { applyDedupe } from './dedupe';
import { computeMatch, resolveAreaMode } from './match';
import type { VideoMatch } from './match';
import { buildReason } from './reasons';

export interface RankOptions {
  topN?: number;
}

const DEFAULT_TOP_N = 3;

export function rank(
  catalog: CatalogItem[],
  profile: IntakeProfile,
  options?: RankOptions,
): RankedMatch[] {
  const active = catalog.filter((video) => video.status === 'active');
  if (active.length === 0) {
    return [];
  }

  const matches = new Map<string, VideoMatch>();
  for (const video of active) {
    matches.set(video.youtubeId, computeMatch(video, profile));
  }

  const areaMode = resolveAreaMode(profile, active, matches);
  const sorted = [...active].sort(buildComparator(areaMode, matches));

  const withReasons: RankedMatch[] = sorted.map((video) => {
    const match = matches.get(video.youtubeId)!;
    const { reason, matchType } = buildReason(video, profile, match, areaMode);
    return { item: video, reason, matchType };
  });

  return applyDedupe(withReasons, options?.topN ?? DEFAULT_TOP_N);
}
