import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';

// No secret or provider error body is ever printed. All writes target the test Worker.
try {
  const action = process.argv[2];
  assert(['check', 'enable', 'budget'].includes(action));
  const bundle = await build({
    stdin: {
      contents:
        "export {LUNA_PRIOR_SPEND} from './src/evaluation/luna-ledger';export {readLunaPriorSpend} from './src/evaluation/luna-spend';export {parseBenchmark} from './src/evaluation/benchmark';export {validateLiveApproval} from './src/evaluation/approval';export {readLimits} from './server/config';",
      resolveDir: process.cwd(),
      loader: 'ts',
    },
    bundle: true,
    platform: 'node',
    format: 'esm',
    write: false,
    logLevel: 'silent',
  });
  const contracts = await import(
    `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`
  );
  const config = JSON.parse(readFileSync('wrangler.luna-test.json', 'utf8'));
  assert.equal(config.name, 'ai-sprint-recommender-llm-test');
  assert.equal(config.vars.LLM_ENABLED, 'false');
  assert(contracts.readLimits(config.vars));
  assert.equal(config.vars.LLM_ENVIRONMENT, 'test');
  assert.equal(config.vars.LLM_PROVIDER, 'openai');
  assert.equal(
    Number(config.vars.LLM_PRIOR_MICRODOLLARS),
    contracts.LUNA_PRIOR_SPEND,
  );
  const prior = contracts.readLunaPriorSpend();
  const approval = JSON.parse(
    readFileSync(
      `${process.env.RUNNER_TEMP}/llm-evaluation-approval.json`,
      'utf8',
    ),
  );
  const endpoint =
    'https://ai-sprint-recommender-llm-test.jason-zeng151.workers.dev';
  assert.equal(approval.endpoint, `${endpoint}/api/recommendations`);
  const secretPath = `${process.env.RUNNER_TEMP}/luna-test-secrets.json`;
  if (action === 'budget') {
    // Read after disabling calls. It includes reservations even if diagnostics were lost.
    const secrets = JSON.parse(readFileSync(secretPath, 'utf8'));
    const response = await fetch(`${endpoint}/api/test-budget`, {
      headers: { Authorization: `Bearer ${secrets.LLM_RATE_KEY}` },
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    });
    assert.equal(response.status, 200);
    const budget = await response.json();
    assert.equal(budget.allowanceMicrodollars, 1000000);
    assert(
      Number.isSafeInteger(budget.spentMicrodollars) &&
        budget.spentMicrodollars >= prior &&
        budget.spentMicrodollars <= 1000000,
    );
    mkdirSync('build/evaluation/state', { recursive: true });
    writeFileSync(
      'build/evaluation/state/luna-budget.json',
      JSON.stringify(
        {
          kind: 'deployed-luna-budget',
          sourceRevision: approval.approvedSourceRevision,
          runId: approval.approvedWorkflowRunId,
          runAttempt: approval.approvedWorkflowRunAttempt,
          checkedAt: new Date().toISOString(),
          priorSpendMicrodollars: prior,
          ...budget,
          additionalMicrodollars: budget.spentMicrodollars - prior,
          remainingMicrodollars: 1000000 - budget.spentMicrodollars,
        },
        null,
        2,
      ) + '\n',
    );
    console.log(
      'Durable cumulative Luna allowance readback saved. No provider call.',
    );
  } else {
    contracts.validateLiveApproval(
      contracts.parseBenchmark(
        JSON.parse(
          readFileSync(
            'docs/evaluation/2026-10-28-task-tags/benchmark.json',
            'utf8',
          ),
        ),
      ),
      approval,
      undefined,
      Date.now(),
      34,
    );
    assert.equal(
      Number(config.vars.LLM_ALLOWANCE_MICRODOLLARS),
      approval.totalAllowanceMicrodollars,
    );
    assert(
      Date.parse(approval.expiresAt) > Date.now() + 600000,
      'Approval cannot cover validation',
    );
    if (action === 'enable') {
      assert(process.env.OPENAI_API_KEY);
      const response = await fetch(
        'https://api.openai.com/v1/models/gpt-6-luna',
        {
          headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
          redirect: 'error',
          signal: AbortSignal.timeout(10000),
        },
      );
      assert.equal(response.status, 200);
      assert.equal((await response.json()).id, 'gpt-6-luna');
      writeFileSync(
        secretPath,
        JSON.stringify({
          OPENAI_API_KEY: process.env.OPENAI_API_KEY,
          LLM_RATE_KEY: randomBytes(32).toString('hex'),
        }),
        { mode: 0o600, flag: 'wx' },
      );
      execFileSync(
        'pnpm',
        [
          'exec',
          'wrangler',
          'deploy',
          '--config',
          'wrangler.luna-test.json',
          '--var',
          'LLM_ENABLED:true',
          '--var',
          `LLM_TEST_EXPIRES_AT:${approval.expiresAt}`,
          '--secrets-file',
          secretPath,
        ],
        { stdio: 'inherit' },
      );
    } else
      console.log(
        'Frozen labels, prior spend, clean source and exact workflow approval verified. No network calls.',
      );
  }
} catch {
  console.error(
    'Luna test deployment step failed. No credentials or provider body were printed; inspect the saved bounded evidence.',
  );
  process.exitCode = 1;
}
