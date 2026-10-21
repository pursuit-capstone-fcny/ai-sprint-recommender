import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import scenarios from '../fixtures/recommendation-failure-cases.json' with { type: 'json' };
import fixture from '../fixtures/public-catalog.json' with { type: 'json' };

export const FAILURE_TEST_ORIGIN =
  'https://ai-sprint-recommender-failure-test.jason-zeng151.workers.dev';

const scope =
  'Deployed Worker with isolated synthetic dependencies; not live Anthropic safety evidence.';
const names = new Set(scenarios.map((entry) => entry.name));
const reasons = new Set(scenarios.map((entry) => entry.reason).filter(Boolean));
const fixtureIds = new Set(fixture.items.map((entry) => entry.youtubeId));

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
      : { modelVersion: 'fixture-model', promptVersion: 'catalog-rank-v5' };
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

function safeActual(actual) {
  if (!actual || typeof actual !== 'object' || Array.isArray(actual)) return {};
  const safe = {};
  if (actual.mode === 'synthetic-dependencies') safe.mode = actual.mode;
  if (names.has(actual.scenario)) safe.scenario = actual.scenario;
  if (
    Number.isInteger(actual.status) &&
    actual.status >= 100 &&
    actual.status <= 599
  )
    safe.status = actual.status;
  for (const key of ['providerAborted', 'catalogTextIsUntrustedData'])
    if (typeof actual[key] === 'boolean') safe[key] = actual[key];
  if (
    Number.isFinite(actual.serverLatencyMs) &&
    actual.serverLatencyMs >= 0 &&
    actual.serverLatencyMs <= 60_000
  )
    safe.serverLatencyMs = actual.serverLatencyMs;
  if (actual.calls && typeof actual.calls === 'object') {
    safe.calls = {};
    for (const key of ['catalogReads', 'providerCalls', 'reservations'])
      if (
        Number.isInteger(actual.calls[key]) &&
        actual.calls[key] >= 0 &&
        actual.calls[key] <= 100
      )
        safe.calls[key] = actual.calls[key];
  }
  const result = actual.result;
  if (result && typeof result === 'object' && !Array.isArray(result)) {
    safe.result = {};
    if (result.outcome === 'success' || result.outcome === 'fallback')
      safe.result.outcome = result.outcome;
    if (reasons.has(result.reason)) safe.result.reason = result.reason;
    if (result.modelVersion === 'fixture-model')
      safe.result.modelVersion = result.modelVersion;
    if (
      typeof result.promptVersion === 'string' &&
      /^catalog-rank-v[0-9]{1,2}$/.test(result.promptVersion)
    )
      safe.result.promptVersion = result.promptVersion;
    if (
      typeof result.catalogVersion === 'string' &&
      /^sha256:[a-f0-9]{64}$/.test(result.catalogVersion)
    )
      safe.result.catalogVersion = result.catalogVersion;
    if (Array.isArray(result.youtubeIds)) {
      safe.result.youtubeIdCount = Math.min(result.youtubeIds.length, 100);
      safe.result.allIdsKnown = result.youtubeIds.every((id) =>
        fixtureIds.has(id),
      );
      if (result.youtubeIds.length <= 10 && safe.result.allIdsKnown)
        safe.result.youtubeIds = result.youtubeIds;
    }
  }
  return safe;
}

class FailureCheckError extends Error {
  constructor(report) {
    super('Synthetic Worker verification failed');
    this.report = report;
  }
}
export function failureReport(error) {
  return error instanceof FailureCheckError
    ? error.report
    : {
        passed: false,
        scope,
        worker: FAILURE_TEST_ORIGIN,
        checkedAt: new Date().toISOString(),
        failedCheck: { phase: 'verifier', classification: 'unexpected-error' },
      };
}

export async function runFailureChecks(fetcher = fetch, wait = delay) {
  const checks = [];
  for (const expected of scenarios) {
    let phase = 'fetch';
    let httpStatus;
    let actual;
    const attempts = [];
    try {
      let response;
      for (let index = 0; index < 4; index++) {
        phase = 'fetch';
        httpStatus = undefined;
        const attempt = {
          attempt: index + 1,
          startedAt: new Date().toISOString(),
        };
        attempts.push(attempt);
        response = await fetcher(
          `${FAILURE_TEST_ORIGIN}/cases/${expected.name}`,
          {
            cache: 'no-store',
            credentials: 'omit',
            redirect: 'error',
            signal: AbortSignal.timeout(12_000),
          },
        );
        httpStatus = response.status;
        attempt.httpStatus = httpStatus;
        phase = 'http-status';
        if (![404, 503].includes(httpStatus) || index === 3) break;
        await response.body?.cancel().catch(() => {});
        await wait([2_000, 4_000, 8_000][index]);
      }
      if (httpStatus !== 200) {
        await response.body?.cancel().catch(() => {});
        throw new Error('Unexpected HTTP status');
      }
      phase = 'body';
      const body = await response.text();
      phase = 'body-size';
      assert(body.length <= 8_192);
      phase = 'json';
      actual = JSON.parse(body);
      phase = 'assertion';
      verifyFailureCase(expected, actual);
      checks.push({ ...safeActual(actual), attempts, passed: true });
    } catch {
      const classification =
        phase === 'http-status'
          ? 'http-status'
          : phase === 'body-size'
            ? 'body-too-large'
            : phase === 'json'
              ? 'invalid-json'
              : phase === 'assertion'
                ? 'assertion-failed'
                : 'transport-error';
      throw new FailureCheckError({
        passed: false,
        scope,
        worker: FAILURE_TEST_ORIGIN,
        checkedAt: new Date().toISOString(),
        completedChecks: checks.length,
        failedCheck: {
          scenario: expected.name,
          phase,
          classification,
          attempts,
          ...(httpStatus === undefined ? {} : { httpStatus }),
          ...(actual === undefined ? {} : { actual: safeActual(actual) }),
        },
        checks,
      });
    }
  }
  return {
    scope,
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
  } catch (error) {
    const report = failureReport(error);
    await writeFile(
      `${directory}/failure.json`,
      `${JSON.stringify(report, null, 2)}\n`,
    );
    console.error(
      `Synthetic Worker verification failed: ${report.failedCheck.scenario ?? 'unknown'} / ${report.failedCheck.phase} / ${report.failedCheck.classification}. See failure.json.`,
    );
    process.exitCode = 1;
  }
}
