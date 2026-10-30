import { describe, expect, it } from 'vitest';
import benchmark from '../../docs/evaluation/2026-10-28-task-tags/benchmark.json';
import { scoreExpandedPicks, scorePicks } from './report';
import { parseBenchmark } from './benchmark';

describe('expanded result evidence', () => {
  it('records known labels beyond three without turning them into a top-three pass', () => {
    const frozen = parseBenchmark(benchmark);
    const profile = frozen.profiles.find((row) => row.id === 'programs-02')!;
    const labelled = [...profile.ideal, ...profile.good].map(
      (row) => row.youtubeId,
    );
    const unreviewed = frozen.catalog.items
      .map((row) => row.youtubeId)
      .filter((id) => !labelled.includes(id))
      .slice(0, 7);
    const ids = [
      ...unreviewed.slice(0, 3),
      ...labelled,
      ...unreviewed.slice(3),
    ];
    const topThree = scorePicks(profile, ids);
    const expanded = scoreExpandedPicks(profile, ids);
    expect(topThree).toMatchObject({ hits: 0, passed: false });
    expect(expanded.count).toBe(8);
    expect(expanded.displayedIds).toEqual(ids.slice(0, 8));
    expect(expanded.knownGoodIds).toEqual(labelled);
    expect(expanded.unreviewedIds).toHaveLength(6);
    expect(expanded.qualityApproval).toBe('pending-client-review');
    expect(expanded.withinPreferredRange).toBe(true);
    expect(scoreExpandedPicks(profile, labelled).withinPreferredRange).toBe(
      false,
    );
  });
});
