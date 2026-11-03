// @vitest-environment node
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import eventScenario from '../fixtures/usage-capacity-1000-users.json' with { type: 'json' };
import {
  checkUsageCapacity,
  loadCapacityApp,
} from './check-usage-capacity.mjs';

let app;
beforeAll(async () => {
  app = await loadCapacityApp();
});
afterEach(() => vi.restoreAllMocks());

const policy = {
  retentionDays: 1,
  maxPerMinute: 20,
  maxPerDay: 1000,
  maxRows: 1000,
  recommendationVersions: [],
};
const action = (overrides = {}) => ({
  atMs: 0,
  client: 0,
  mode: 'rules',
  cards: 8,
  ...overrides,
});
const check = (actions, options = {}) =>
  checkUsageCapacity({ policy, actions, ...options }, app);

it('fails readiness for 1,000 simultaneous learners and AI requests without paid calls', async () => {
  const result = await checkUsageCapacity(eventScenario, app);
  expect(result).toMatchObject({
    passed: false,
    paidProviderCalls: 0,
    sheetWrites: 0,
    actions: 1000,
    generated: 10_000,
    accepted: 20,
    dropped: 9980,
    aiBurst: {
      requests: 1000,
      admitted: 2,
      rejected: { 'rate-limited': 998 },
      reservationCeilingMicrodollars: 16_192,
      fullBurstCeilingMicrodollars: 16_192_000,
    },
  });
});

it('reports an AI admission failure even when analytics delivery succeeds', async () => {
  expect(await check([action()], { ai: eventScenario.ai })).toMatchObject({
    passed: false,
    dropped: 0,
    aiBurst: { admitted: 2 },
  });
});

it('passes a small AI admission scenario and identifies budget exhaustion', async () => {
  expect(
    await check([action()], {
      policy: eventScenario.policy,
      ai: { ...eventScenario.ai, requests: 1 },
    }),
  ).toMatchObject({ passed: true, aiBurst: { admitted: 1, rejected: {} } });
  expect(
    await check([action()], {
      ai: {
        requests: 1,
        limits: {
          ...eventScenario.ai.limits,
          LLM_DAILY_MICRODOLLARS: 1,
        },
      },
    }),
  ).toMatchObject({
    passed: false,
    aiBurst: { admitted: 0, rejected: { 'budget-exhausted': 1 } },
  });
});

it('fails a missing collector pair even if AI admission and rules telemetry succeed', async () => {
  expect(
    await check([action()], { ai: { ...eventScenario.ai, requests: 1 } }),
  ).toMatchObject({
    passed: false,
    dropped: 0,
    aiBurst: { admitted: 1, collectorVersionPermitted: false },
  });
});

it('uses the production reservation ceiling even when the prompt asks for fewer output tokens', async () => {
  expect(
    await check([action()], {
      policy: eventScenario.policy,
      ai: {
        requests: 1,
        limits: {
          ...eventScenario.ai.limits,
          LLM_DAILY_MICRODOLLARS: 10_000,
        },
      },
    }),
  ).toMatchObject({
    passed: false,
    aiBurst: {
      admitted: 0,
      rejected: { 'budget-exhausted': 1 },
      reservationCeilingMicrodollars: 16_192,
    },
  });
});

it('detects seven lost events from three eight-video searches at the recorded cap', async () => {
  const result = await check([action(), action(), action()]);
  expect(result).toMatchObject({
    passed: false,
    generated: 27,
    posts: 21,
    accepted: 20,
    dropped: 7,
    suppressedBeforePost: 6,
    collectorErrors: { USAGE_RATE_LIMITED: 1 },
    byType: {
      search: { generated: 3, accepted: 3, dropped: 0 },
      impression: { generated: 24, accepted: 17, dropped: 7 },
    },
    learnerDashboard: { appearances: 17, embedClicks: 0 },
  });
});

it('passes a supported search and reconciles its click to the learner dashboard', async () => {
  expect(await check([action({ clicks: 1 })])).toMatchObject({
    passed: true,
    generated: 10,
    accepted: 10,
    dropped: 0,
    learnerDashboard: { appearances: 8, embedClicks: 1 },
  });
});

it('counts optional staff browsing against caps while excluding it from learner totals', async () => {
  const result = await check([
    action({ mode: 'topic', cards: 89, client: 1 }),
    action(),
  ]);
  expect(result).toMatchObject({
    passed: false,
    generated: 99,
    accepted: 20,
    dropped: 79,
    learnerDashboard: { appearances: 0, embedClicks: 0 },
  });
});

it('uses current source model/prompt metadata and detects a missing collector pair', async () => {
  const request = action({ mode: 'llm', cards: 2 });
  const rejected = await check([request]);
  expect(rejected).toMatchObject({
    passed: false,
    accepted: 0,
    collectorErrors: { USAGE_INVALID_EVENT: 3 },
  });
  const accepted = await check([request], {
    policy: {
      ...policy,
      recommendationVersions: [rejected.requiredRecommendationVersion],
    },
  });
  expect(accepted.passed).toBe(true);
  expect(accepted.learnerDashboard.appearances).toBe(2);
});

it('recovers only fresh actions after the minute window, without replaying losses', async () => {
  const result = await check([
    action(),
    action(),
    action(),
    action({ atMs: 59_999 }),
    action({ atMs: 60_000 }),
  ]);
  expect(result).toMatchObject({
    generated: 45,
    accepted: 29,
    dropped: 16,
    posts: 30,
  });
});

it('distinguishes UTC-day exhaustion from retained-row exhaustion', async () => {
  expect(
    await check([action()], { retained: [{ count: 999, ageMs: 60_001 }] }),
  ).toMatchObject({
    accepted: 1,
    collectorErrors: { USAGE_FULL: 1 },
  });
  expect(
    await check([action()], {
      policy: { ...policy, maxPerDay: 20 },
      retained: [{ count: 20, ageMs: 60_001 }],
    }),
  ).toMatchObject({
    accepted: 0,
    collectorErrors: { USAGE_RATE_LIMITED: 1 },
  });
});

it('releases a UTC-day cooldown at midnight when retained capacity remains', async () => {
  expect(
    await check([action(), action({ atMs: 1000 })], {
      startTime: '2026-10-20T23:59:59.000Z',
      policy: { ...policy, maxPerDay: 20 },
      retained: [{ count: 20, ageMs: 60_001 }],
    }),
  ).toMatchObject({
    generated: 18,
    accepted: 9,
    dropped: 9,
    posts: 10,
  });
});

it('does not call real fetch or include event identifiers and content in its report', async () => {
  const transport = vi
    .spyOn(globalThis, 'fetch')
    .mockRejectedValue(new Error());
  const now = Date.now;
  const result = await check([action()]);
  expect(transport).not.toHaveBeenCalled();
  expect(globalThis.fetch).toBe(transport);
  expect(Date.now).toBe(now);
  expect(JSON.stringify(result)).not.toMatch(
    /sessionId|searchId|eventId|youtubeId|Synthetic capacity check|https:/,
  );
});

it.each([
  { actions: [action({ cards: 9 })] },
  { actions: [action({ cards: 0, clicks: 1 })] },
  { actions: [action({ rawGoal: 'not permitted' })] },
  { policy: { ...policy, maxPerMinute: 1001 } },
  { retained: [{ count: 10_001, ageMs: 0 }] },
  { actions: [action({ client: 999, clients: 2 })] },
  { ai: { requests: 1000, limits: {} } },
])(
  'rejects invalid or unbounded scenarios before replacing transport',
  async (overrides) => {
    const transport = globalThis.fetch;
    const now = Date.now;
    await expect(
      checkUsageCapacity({ policy, actions: [action()], ...overrides }, app),
    ).rejects.toThrow();
    expect(globalThis.fetch).toBe(transport);
    expect(Date.now).toBe(now);
  },
);
