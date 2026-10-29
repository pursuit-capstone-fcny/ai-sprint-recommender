import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const worker = 'ai-sprint-recommender-llm-test';
const bindings = ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'LLM_RATE_KEY'];

export async function cleanupTestSecrets(config, credentials, fetcher = fetch) {
  assert(
    config.name === worker &&
      config.vars?.LLM_ENVIRONMENT === 'test' &&
      config.vars?.LLM_ENABLED === 'false',
    'Cleanup requires the disabled test Worker configuration',
  );
  assert(
    /^[a-f0-9]{32}$/i.test(credentials.accountId ?? '') && credentials.token,
    'Cloudflare cleanup credentials are required',
  );
  const url = `https://api.cloudflare.com/client/v4/accounts/${credentials.accountId}/workers/scripts/${worker}/secrets`;
  async function request(method, suffix = '') {
    try {
      const response = await fetcher(`${url}${suffix}`, {
        method,
        headers: { Authorization: `Bearer ${credentials.token}` },
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (data?.success !== true) throw new Error();
      return data.result;
    } catch {
      // Never echo provider response bodies, request headers or transport errors.
      throw new Error('Cloudflare secret cleanup request failed');
    }
  }
  async function list() {
    const result = await request('GET');
    assert(
      Array.isArray(result) &&
        result.every((entry) => typeof entry?.name === 'string'),
      'Cloudflare secret listing was invalid',
    );
    return new Set(result.map((entry) => entry.name));
  }
  let before;
  try {
    before = await list();
  } catch {
    // A failed listing must not prevent either independent deletion attempt.
  }
  const outcomes = [];
  for (const name of bindings) {
    let outcome = 'absent';
    if (!before || before.has(name)) {
      try {
        await request('DELETE', `/${name}`);
        outcome = 'removed';
      } catch {
        outcome = 'failed';
      }
    }
    outcomes.push({ name, outcome });
  }
  let after;
  try {
    after = await list();
  } catch {
    // Absence is unproven unless a final listing succeeds.
  }
  return {
    worker,
    checkedAt: new Date().toISOString(),
    paidCalls: 0,
    confirmed: Boolean(after && bindings.every((name) => !after.has(name))),
    bindings: outcomes.map((entry) => ({
      ...entry,
      presentAfter: after ? after.has(entry.name) : null,
    })),
  };
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  try {
    const config = JSON.parse(
      await readFile('wrangler.evaluation.json', 'utf8'),
    );
    const report = await cleanupTestSecrets(config, {
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
      token: process.env.CLOUDFLARE_API_TOKEN,
    });
    await mkdir('build/evaluation/state', { recursive: true });
    await writeFile(
      'build/evaluation/state/secret-cleanup.json',
      `${JSON.stringify(report, null, 2)}\n`,
    );
    assert(
      report.confirmed,
      'Test Worker secret removal could not be verified',
    );
    console.log(
      'Test Worker provider and rate-key bindings confirmed absent. No paid calls.',
    );
  } catch {
    console.error(
      'Test Worker secret cleanup failed; inspect the bounded cleanup report if available.',
    );
    process.exitCode = 1;
  }
}
