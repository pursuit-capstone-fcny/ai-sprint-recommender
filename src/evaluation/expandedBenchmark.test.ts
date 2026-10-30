import { expect, it } from 'vitest';
import { expandedPublicCatalog } from '../../fixtures/expanded-catalog';
import { scoreExpandedBenchmark } from './expandedBenchmark';

const benchmark = {
  id: 'fictional-expanded-benchmark',
  catalog: expandedPublicCatalog,
  profiles: Array.from({ length: 10 }, (_, index) => ({
    id: `profile-${index}`,
    input: { functionArea: 'Operations', goal: '', tools: [] },
    ideal: [{ youtubeId: expandedPublicCatalog.items[8].youtubeId }],
    good: [{ youtubeId: expandedPublicCatalog.items[9].youtubeId }],
  })),
};
const trials = {
  trials: Array.from({ length: 3 }, () => ({
    calls: benchmark.profiles.map(({ id }) => ({
      profileId: id,
      response: { outcome: 'fallback', reason: 'timeout' },
    })),
  })),
};

it('replays the ten-profile benchmark with full-set and original top-three scores, separating fallbacks', () => {
  const report = scoreExpandedBenchmark(benchmark, trials);
  expect(report.evidence).toBe('offline-replay');
  expect(report.rules).toHaveLength(10);
  expect(report.rules[0].expanded.count).toBe(8);
  expect(report.rules[0].topThree).toMatchObject({
    hits: 2,
    misses: 1,
    passed: true,
  });
  expect(report.llm).toHaveLength(3);
  expect(report.llm[0][0]).toMatchObject({
    recommendationEngine: 'rules',
    llmFallbackReason: 'timeout',
  });
  expect(report.qualityApproval).toBe('pending-client-review');
});

it('rejects duplicate profiles and unknown labels without changing the denominator', () => {
  expect(() =>
    scoreExpandedBenchmark({
      ...benchmark,
      profiles: benchmark.profiles.map(() => benchmark.profiles[0]),
    }),
  ).toThrow('distinct profiles');
  expect(() =>
    scoreExpandedBenchmark({
      ...benchmark,
      profiles: benchmark.profiles.map((profile) => ({
        ...profile,
        good: [{ youtubeId: 'unknown0000' }],
      })),
    }),
  ).toThrow('active catalog IDs');
  expect(() =>
    scoreExpandedBenchmark(benchmark, {
      trials: trials.trials.map(({ calls }) => ({
        calls: calls.map(() => calls[0]),
      })),
    }),
  ).toThrow('profile once');
});
