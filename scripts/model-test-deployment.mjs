import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';

// No secret or provider error body is ever printed. All writes target the test Worker.
try {
  const action = process.argv[2];
  const candidate = process.argv[3] ?? 'luna';
  assert(['luna', 'haiku'].includes(candidate));
  const haiku = candidate === 'haiku';
  const configPath = haiku
    ? 'wrangler.evaluation.json'
    : 'wrangler.luna-test.json';
  const model = haiku ? 'claude-haiku-5-5' : 'gpt-6-luna';
  const keyName = haiku ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY';
  assert(['check', 'enable', 'budget'].includes(action));
  const bundle = await build({
    stdin: {
      contents:
        "export {LUNA_PRIOR_SPEND} from './src/evaluation/luna-ledger';export {readLunaPriorSpend} from './src/evaluation/luna-spend';export {parseBenchmark} from './src/evaluation/benchmark';export {validateLiveApproval} from './src/evaluation/approval';export {readLimits} from './server/config';export {providerBody,inputTokenBound} from './server/anthropic';export {lunaDeployedBody} from './server/luna';export {haikuV58Body} from './server/haiku';export {injectionProbes} from './src/evaluation/injection-probes';",
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
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  {
    assert.equal(config.main, 'server/evaluation-worker.ts');
    assert.equal(
      config.vars.LLM_CATALOG_URL,
      'https://ai-sprint-recommender-llm-test.jason-zeng151.workers.dev/api/evaluation-catalog/b3f96d7113308d627eeb6c9667ac51a44155210faf515db2ef5a41fb5e9bfae7.json',
    );
    assert.deepEqual(
      JSON.parse(
        readFileSync(
          'docs/evaluation/2026-10-30-luna-ranking/catalog.json',
          'utf8',
        ),
      ),
      JSON.parse(
        readFileSync(
          'docs/evaluation/2026-10-28-task-tags/benchmark.json',
          'utf8',
        ),
      ).catalog,
      'Isolated test snapshot differs from the frozen benchmark',
    );
  }
  assert.equal(config.name, 'ai-sprint-recommender-llm-test');
  assert.equal(config.vars.LLM_ENABLED, 'false');
  assert(contracts.readLimits(config.vars));
  assert.equal(config.vars.LLM_ENVIRONMENT, 'test');
  assert.equal(config.vars.LLM_PROVIDER, haiku ? 'anthropic' : 'openai');
  assert.equal(config.vars.LLM_MODEL, model);
  assert.equal(
    Number(config.vars.LLM_PRIOR_MICRODOLLARS),
    contracts.LUNA_PRIOR_SPEND,
  );
  // Period counters already contain prior deployed spend. The cumulative cap
  // and carried floor enforce the remaining allowance; never subtract it twice.
  assert.equal(
    config.vars.LLM_DAILY_MICRODOLLARS,
    config.vars.LLM_ALLOWANCE_MICRODOLLARS,
  );
  assert.equal(
    config.vars.LLM_MONTHLY_MICRODOLLARS,
    config.vars.LLM_ALLOWANCE_MICRODOLLARS,
  );
  const prior = contracts.readLunaPriorSpend();
  const allowance = Number(config.vars.LLM_ALLOWANCE_MICRODOLLARS);
  const approval = JSON.parse(
    readFileSync(
      `${process.env.RUNNER_TEMP}/llm-evaluation-approval.json`,
      'utf8',
    ),
  );
  const endpoint =
    'https://ai-sprint-recommender-llm-test.jason-zeng151.workers.dev';
  assert.equal(approval.endpoint, `${endpoint}/api/recommendations`);
  assert.equal(approval.modelVersion, model);
  assert.equal(approval.reasoningEffort, config.vars.LLM_REASONING_EFFORT);
  assert.equal(approval.serviceTier, config.vars.LLM_SERVICE_TIER);
  const secretPath = `${process.env.RUNNER_TEMP}/${candidate}-test-secrets.json`;
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
    assert.equal(budget.allowanceMicrodollars, allowance);
    assert(
      Number.isSafeInteger(budget.spentMicrodollars) &&
        budget.spentMicrodollars >= prior &&
        budget.spentMicrodollars <= allowance,
    );
    mkdirSync('build/evaluation/state', { recursive: true });
    writeFileSync(
      `build/evaluation/state/${haiku ? 'comparison' : 'luna'}-budget.json`,
      JSON.stringify(
        {
          kind: haiku ? 'deployed-model-budget' : 'deployed-luna-budget',
          modelVersion: model,
          sourceRevision: approval.approvedSourceRevision,
          runId: approval.approvedWorkflowRunId,
          runAttempt: approval.approvedWorkflowRunAttempt,
          checkedAt: new Date().toISOString(),
          priorSpendMicrodollars: prior,
          ...budget,
          additionalMicrodollars: budget.spentMicrodollars - prior,
          remainingMicrodollars: allowance - budget.spentMicrodollars,
        },
        null,
        2,
      ) + '\n',
    );
    console.log(
      'Durable cumulative comparison allowance readback saved. No provider call.',
    );
  } else {
    const benchmark = contracts.parseBenchmark(
      JSON.parse(
        readFileSync(
          'docs/evaluation/2026-10-28-task-tags/benchmark.json',
          'utf8',
        ),
      ),
    );
    const limits = contracts.readLimits(config.vars);
    for (const profile of [
      ...benchmark.profiles,
      ...contracts.injectionProbes(benchmark),
    ]) {
      const body = contracts.providerBody(
        { ...profile.input, catalogVersion: benchmark.catalog.catalogVersion },
        benchmark.catalog,
        limits,
      );
      const bound = haiku
        ? contracts.inputTokenBound(contracts.haikuV58Body(body))
        : new TextEncoder().encode(
            JSON.stringify(contracts.lunaDeployedBody(body)),
          ).length + 1024;
      assert(
        bound <= limits.LLM_MAX_INPUT_TOKENS,
        'Full benchmark exceeds the candidate input bound',
      );
    }
    contracts.validateLiveApproval(
      benchmark,
      approval,
      undefined,
      Date.now(),
      40,
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
      assert(process.env[keyName]);
      const response = await fetch(
        haiku
          ? 'https://api.anthropic.com/v1/models/claude-haiku-5-5'
          : 'https://api.openai.com/v1/models/gpt-6-luna',
        {
          headers: haiku
            ? {
                'x-api-key': process.env[keyName],
                'anthropic-version': '2023-06-01',
              }
            : { Authorization: `Bearer ${process.env[keyName]}` },
          redirect: 'error',
          signal: AbortSignal.timeout(10000),
        },
      );
      assert.equal(response.status, 200);
      const access = await response.json();
      assert.equal(access.id, model);
      if (haiku) {
        assert.equal(access.capabilities?.structured_outputs?.supported, true);
        assert.equal(
          access.capabilities?.thinking?.types?.disabled?.supported,
          true,
        );
        assert.equal(
          access.capabilities?.effort?.[approval.reasoningEffort]?.supported,
          true,
        );
      }
      writeFileSync(
        secretPath,
        JSON.stringify({
          [keyName]: process.env[keyName],
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
          configPath,
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
    'Model test deployment step failed. No credentials or provider body were printed; inspect the saved bounded evidence.',
  );
  process.exitCode = 1;
}
