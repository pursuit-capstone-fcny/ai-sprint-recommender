import { readFile, writeFile, mkdir, appendFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { parseBenchmark } from './benchmark';
import {
  evaluate,
  renderReport,
  TrialsSchema,
  DiagnosticsSchema,
  type EvaluationReport,
} from './report';
import { runLiveTrials } from './live';

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8'));
}

export async function main() {
  const { values } = parseArgs({
    options: {
      benchmark: {
        type: 'string',
        default: 'fixtures/evaluation/draft-benchmark.json',
      },
      trials: { type: 'string' },
      diagnostics: { type: 'string' },
      baseline: { type: 'string' },
      output: { type: 'string', default: 'build/evaluation' },
      'live-approval': { type: 'string' },
      'allow-paid': { type: 'boolean', default: false },
    },
  });
  if (values.trials && values['live-approval'])
    throw new Error('Use saved trials or live approval, not both.');
  if (values['allow-paid'] && !values['live-approval'])
    throw new Error('Paid opt-in also requires an approval file.');
  const benchmark = parseBenchmark(await readJson(values.benchmark));
  const output = resolve(values.output);
  await mkdir(output, { recursive: true });
  let trials = values.trials
    ? TrialsSchema.parse(await readJson(values.trials))
    : undefined;
  if (values['live-approval'])
    trials = await runLiveTrials(
      benchmark,
      await readJson(values['live-approval']),
      values['allow-paid'],
      fetch,
      async (progress) => {
        await writeFile(
          resolve(output, 'live-progress.json'),
          `${JSON.stringify(progress, null, 2)}\n`,
        );
      },
    );
  const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim();
  const dirty = execFileSync('git', ['status', '--porcelain'], {
    encoding: 'utf8',
  }).trim();
  const report = evaluate(benchmark, {
    sourceRevision: `${sourceRevision}${dirty ? '-dirty' : ''}`,
    trials,
    diagnostics: values.diagnostics
      ? DiagnosticsSchema.parse(await readJson(values.diagnostics))
      : undefined,
  });
  // Baseline files are produced by this CLI; fail rather than silently comparing unrelated data.
  const baseline = values.baseline
    ? ((await readJson(values.baseline)) as EvaluationReport)
    : undefined;
  const markdown = renderReport(report, baseline);
  await writeFile(
    resolve(output, 'report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  await writeFile(resolve(output, 'report.md'), markdown);
  if (baseline)
    await writeFile(
      resolve(output, 'comparison.json'),
      `${JSON.stringify({ before: baseline, after: report }, null, 2)}\n`,
    );
  if (trials)
    await writeFile(
      resolve(output, 'trials.json'),
      `${JSON.stringify(trials, null, 2)}\n`,
    );
  if (process.env.GITHUB_STEP_SUMMARY)
    await appendFile(process.env.GITHUB_STEP_SUMMARY, markdown);
  console.log(markdown);
}
