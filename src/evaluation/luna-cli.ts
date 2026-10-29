import { readLunaPriorSpend } from './luna-spend';
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  renameSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { parseBenchmark } from './benchmark';
import { readCheckout } from './approval';
import {
  LUNA_MODEL,
  LUNA_BENCHMARK_PATH,
  lunaSpent,
  runLunaComparison,
  scoreLunaState,
  validateLunaApproval,
  type LunaState,
} from './luna';

export async function main() {
  const approvalPath = process.env.LUNA_APPROVAL_FILE;
  if (!approvalPath || process.argv.length !== 2)
    throw new Error('Use the isolated Luna workflow.');
  const benchmark = parseBenchmark(
    JSON.parse(readFileSync(LUNA_BENCHMARK_PATH, 'utf8')),
  );
  const approval = validateLunaApproval(
    benchmark,
    JSON.parse(readFileSync(approvalPath, 'utf8')),
    readCheckout(),
    process.env,
  );
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('Add the OPENAI_API_KEY Actions secret.');
  readLunaPriorSpend();
  const directory = resolve('build/evaluation/luna');
  mkdirSync(directory, { recursive: true });
  const ledger = resolve(directory, 'capture.json');
  // Exclusive creation rejects a second invocation in the approved workflow attempt.
  writeFileSync(
    resolve(directory, 'started.json'),
    JSON.stringify({ approval }),
    { flag: 'wx', mode: 0o600 },
  );
  const save = (state: LunaState) => {
    writeFileSync(`${ledger}.tmp`, JSON.stringify(state, null, 2) + '\n', {
      mode: 0o600,
    });
    renameSync(`${ledger}.tmp`, ledger);
  };
  // Model access is a read-only request. Never print provider bodies or credentials.
  const access = await fetch(`https://api.openai.com/v1/models/${LUNA_MODEL}`, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(10_000),
    redirect: 'error',
  });
  if (!access.ok || (await access.json()).id !== LUNA_MODEL)
    throw new Error(
      `Luna model access check failed with HTTP ${access.status}; no generation requested.`,
    );
  const config = JSON.parse(readFileSync('wrangler.evaluation.json', 'utf8'));
  const state = await runLunaComparison({
    benchmark,
    approval,
    limits: config.vars,
    key,
    save,
  });
  const lines = [
    '# GPT-6 Luna provider comparison',
    '',
    `Source: \`${approval.approvedSourceRevision}\`. Workflow run ${approval.approvedWorkflowRunId}, attempt ${approval.approvedWorkflowRunAttempt}.`,
    '',
    'Fresh provider calls from an isolated runner, scored with the existing browser selector. This does not test the deployed endpoint or establish production readiness. The nested reports score saved responses and are explicitly ineligible for the deployed relevance gate.',
    '',
    `The catalog includes the October 28 task-tag completion. Profile inputs, labels and the distinct-task gate are unchanged; earlier snapshots and results are preserved. Prompt: ${approval.promptVersion}. Efforts: ${approval.efforts.join(', ')}. Each uses standard mode, no prompt caching, 2,000 total output tokens including reasoning, a 4.5-second deadline and no retries.`,
    '',
    '| Effort | Trial passes | Rules fallbacks | p50 / p95 latency | Known token cost | Unknown maximum reservations |',
    '| --- | --- | --- | --- | --- | --- |',
  ];
  for (const effort of approval.efforts) {
    const result = scoreLunaState(benchmark, state, effort);
    writeFileSync(
      resolve(directory, `${effort}.json`),
      JSON.stringify(result, null, 2) + '\n',
    );
    const records = state.records.filter((row) => row.effort === effort);
    const latencies = records
      .map((row) => row.latencyMs!)
      .sort((a, b) => a - b);
    const percentile = (p: number) =>
      (latencies[Math.ceil(p * latencies.length) - 1] / 1_000).toFixed(3);
    const known = records.reduce(
      (total, row) => total + (row.measurement?.costMicrodollars ?? 0),
      0,
    );
    const unknown = records
      .filter((row) => row.measurement === null)
      .reduce((total, row) => total + row.reservationMicrodollars, 0);
    lines.push(
      `| ${effort} | ${result.report.llm.map((row) => `${row.passedProfiles}/10`).join(', ')} | ${result.report.llm.map((row) => row.fallbackCount).join(', ')} | ${percentile(0.5)}s / ${percentile(0.95)}s | $${(known / 1_000_000).toFixed(6)} | $${(unknown / 1_000_000).toFixed(6)} |`,
    );
  }
  lines.push(
    '',
    `This run: at most $${(lunaSpent(state) / 1_000_000).toFixed(6)}. Prior runs: at most $${(approval.priorSpendMicrodollars / 1_000_000).toFixed(6)}. Cumulative: at most $${((approval.priorSpendMicrodollars + lunaSpent(state)) / 1_000_000).toFixed(6)} of the existing $${(approval.allowanceMicrodollars / 1_000_000).toFixed(2)} allowance. Remaining: at least $${((approval.allowanceMicrodollars - approval.priorSpendMicrodollars - lunaSpent(state)) / 1_000_000).toFixed(6)}. Unknown costs retain their full reservation. Token costs use $0.10/M input and $0.50/M output, including reasoning; they are not a billing export.`,
    '',
    'Production LLM calls and usage logging were not enabled. No Cloudflare or Apps Script deployment was performed.',
    '',
  );
  writeFileSync(resolve(directory, 'comparison.md'), lines.join('\n'));
  if (!existsSync(ledger)) throw new Error('Missing saved capture.');
  console.log(lines.join('\n'));
}
