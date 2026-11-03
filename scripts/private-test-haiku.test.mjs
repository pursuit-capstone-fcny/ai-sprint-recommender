import { expect, it } from 'vitest';
import { privateTestHaiku } from './private-test-haiku.mjs';
const now = Date.parse('2026-11-03T20:00:00Z');
const env = {
  PRIVATE_TEST_LIVE_HAIKU: 'true',
  VITE_USAGE_ENVIRONMENT: 'test',
  VITE_LLM_ENABLED: 'true',
  PREVIEW_NAME: 'private-test',
  LLM_TEST_EXPIRES_AT: '2026-11-03T20:15:00Z',
};
const origin =
  'https://private-test-ai-sprint-library-test.example.workers.dev';
it('leaves paid calls disabled unless explicitly requested', () => {
  expect(privateTestHaiku({}, origin, now)).toBeNull();
});
it.each([
  { VITE_USAGE_ENVIRONMENT: 'production' },
  { PREVIEW_NAME: '' },
  { LLM_TEST_EXPIRES_AT: 'invalid' },
  { LLM_TEST_EXPIRES_AT: '2026-11-03T20:00:00Z' },
  { LLM_TEST_EXPIRES_AT: '2026-11-03T20:16:00Z' },
])('rejects unsafe live test configuration %j', (override) => {
  expect(() =>
    privateTestHaiku({ ...env, ...override }, origin, now),
  ).toThrow();
});
it('rejects the shared test catalog even for a named preview', () => {
  expect(() =>
    privateTestHaiku(
      env,
      'https://ai-sprint-library-test.example.workers.dev',
      now,
    ),
  ).toThrow();
});
it('caps the isolated namespace at five cents with no parallel paid calls', () => {
  expect(privateTestHaiku(env, origin, now)).toMatchObject({
    LLM_ENVIRONMENT: 'test',
    LLM_DAILY_MICRODOLLARS: '50000',
    LLM_MONTHLY_MICRODOLLARS: '50000',
    LLM_MAX_CONCURRENCY: '1',
    LLM_TEST_EXPIRES_AT: '2026-11-03T20:15:00.000Z',
  });
});
