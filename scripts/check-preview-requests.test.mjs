// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const script = fileURLToPath(
  new URL('./check-preview-requests.mjs', import.meta.url),
);
const endpoint = (name) => `https://script.google.com/macros/s/${name}/exec`;
const preview = endpoint('fictional-preview');
const requests = endpoint('fictional-production-requests');
const collector = endpoint('fictional-production-collector');
const config = (url) =>
  JSON.stringify({
    endpoint: url,
    policy: {
      version: 'fictional-v1',
      topicPrompt: 'Fictional topic?',
      demoInvitation: 'Fictional demo?',
      purpose: 'Fictional review',
      access: 'Fictional reviewers',
      owner: 'Fictional owner',
      retentionDays: 7,
      demoOffers: false,
    },
  });

function check(overrides = {}) {
  return spawnSync(process.execPath, [script], {
    encoding: 'utf8',
    env: {
      VITE_REQUESTS_ENABLED: 'true',
      VITE_REQUESTS_CONFIG: config(preview),
      VITE_USAGE_TEST_URL: preview,
      PRODUCTION_REQUESTS_CONFIG: config(requests),
      PRODUCTION_COLLECTOR_URL: collector,
      ...overrides,
    },
  });
}

it('accepts the test collector and skips validation when the preview form is off', () => {
  expect(check().status).toBe(0);
  expect(
    check({ VITE_REQUESTS_ENABLED: 'false', VITE_REQUESTS_CONFIG: '' }).status,
  ).toBe(0);
});

it('rejects missing configuration and a different test collector', () => {
  const missing = check({ VITE_REQUESTS_CONFIG: '' });
  expect(missing.status).toBe(1);
  expect(missing.stderr).toContain(
    'Check the preview and production Requests configuration.',
  );
  const mismatch = check({
    VITE_USAGE_TEST_URL: endpoint('fictional-other-test'),
  });
  expect(mismatch.status).toBe(1);
  expect(mismatch.stderr).toContain('must use the designated test collector');
});

it.each([requests, collector])(
  'rejects a production endpoint even when configured as the test collector',
  (url) => {
    const result = check({
      VITE_USAGE_TEST_URL: url,
      VITE_REQUESTS_CONFIG: config(url),
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'require a separate collector from production',
    );
  },
);
