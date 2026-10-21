import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function verifyDisabledTest(fetcher = fetch, wait = delay) {
  const attempts = [];
  for (let attempt = 0; attempt < 30; attempt++) {
    // Invalid intake cannot reach catalog reads, budget or provider dispatch,
    // even while an older enabled deployment is still propagating.
    const response = await fetcher(
      'https://ai-sprint-recommender-llm-test.jason-zeng151.workers.dev/api/recommendations',
      {
        method: 'POST',
        body: '{}',
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
        signal: AbortSignal.timeout(5_000),
      },
    );
    const value = await response.json();
    const reason =
      value?.outcome === 'fallback' &&
      ['disabled', 'unavailable'].includes(value.reason)
        ? value.reason
        : 'unexpected';
    attempts.push({
      checkedAt: new Date().toISOString(),
      status: response.status,
      reason,
    });
    if (response.status === 200 && reason === 'disabled') {
      assert.deepEqual(value, { outcome: 'fallback', reason: 'disabled' });
      return { confirmed: true, paidCalls: 0, attempts };
    }
    assert(
      reason === 'unavailable' && response.status === 400,
      'Unexpected test endpoint response',
    );
    if (attempt < 29) await wait(1_000);
  }
  throw new Error('Test endpoint did not confirm disabled within 30 probes');
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  const report = await verifyDisabledTest();
  await mkdir('build/evaluation/state', { recursive: true });
  await writeFile(
    'build/evaluation/state/disabled.json',
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(
    `Test provider calls confirmed disabled after ${report.attempts.length} unpaid probes.`,
  );
}
