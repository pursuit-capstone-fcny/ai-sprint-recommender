import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import scenarios from '../fixtures/recommendation-failure-cases.json' with { type: 'json' };
import fixture from '../fixtures/public-catalog.json' with { type: 'json' };

export const FAILURE_TEST_ORIGIN =
  'https://ai-sprint-recommender-failure-test.jason-zeng151.workers.dev';

export function verifyFailureCase(expected, actual) {
  assert.equal(actual.mode, 'synthetic-dependencies');
  assert.equal(actual.scenario, expected.name);
  assert.equal(actual.status, expected.status);
  assert.deepEqual(actual.calls, {
    catalogReads: expected.catalogReads,
    providerCalls: expected.providerCalls,
    reservations: expected.reservations,
  });
  const versions =
    expected.reason === 'disabled'
      ? {}
      : { modelVersion: 'fixture-model', promptVersion: 'catalog-rank-v2' };
  const expectsCatalogVersion =
    expected.catalogReads && expected.name !== 'retired-catalog';
  const catalogVersion = expectsCatalogVersion
    ? actual.result.catalogVersion
    : undefined;
  if (expectsCatalogVersion)
    assert.match(catalogVersion, /^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(actual.result, {
    ...(expected.outcome === 'success'
      ? { outcome: 'success', youtubeIds: [fixture.items[1].youtubeId] }
      : { outcome: 'fallback', reason: expected.reason }),
    ...versions,
    ...(catalogVersion === undefined ? {} : { catalogVersion }),
  });
  assert(
    Number.isFinite(actual.serverLatencyMs) && actual.serverLatencyMs >= 0,
  );
  assert.equal(actual.providerAborted, expected.name === 'timeout');
  if (expected.name === 'timeout')
    assert(
      actual.serverLatencyMs >= 4_950 && actual.serverLatencyMs <= 6_000,
      'Five-second server deadline must fire',
    );
  if (expected.name === 'catalog-description-injection')
    assert.equal(actual.catalogTextIsUntrustedData, true);
}

export async function runFailureChecks(fetcher = fetch) {
  const checks = [];
  for (const expected of scenarios) {
    const response = await fetcher(
      `${FAILURE_TEST_ORIGIN}/cases/${expected.name}`,
      {
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
        signal: AbortSignal.timeout(12_000),
      },
    );
    assert.equal(
      response.status,
      200,
      `Synthetic case ${expected.name} must run`,
    );
    const body = await response.text();
    assert(body.length <= 8_192, 'Synthetic response must be bounded');
    const actual = JSON.parse(body);
    verifyFailureCase(expected, actual);
    checks.push({ ...actual, passed: true });
  }
  return {
    scope:
      'Deployed Worker with isolated synthetic dependencies; not live Anthropic safety evidence.',
    worker: FAILURE_TEST_ORIGIN,
    checkedAt: new Date().toISOString(),
    paidProviderCalls: 0,
    sheetMutations: 0,
    checks,
  };
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  const directory = 'build/evaluation/failure-checks';
  await mkdir(directory, { recursive: true });
  try {
    const report = await runFailureChecks();
    await writeFile(
      `${directory}/report.json`,
      `${JSON.stringify(report, null, 2)}\n`,
    );
    console.log(
      `All ${report.checks.length} isolated Worker failure checks passed. No paid provider calls or Sheet writes.`,
    );
  } catch {
    await writeFile(
      `${directory}/failure.json`,
      `${JSON.stringify({ passed: false, scope: 'Synthetic Worker verification', checkedAt: new Date().toISOString() }, null, 2)}\n`,
    );
    console.error(
      'Synthetic Worker verification failed; inspect the isolated fixture deployment.',
    );
    process.exitCode = 1;
  }
}
