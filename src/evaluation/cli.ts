import { readFile, writeFile, mkdir, appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { parseBenchmark } from './benchmark';
import {
  evaluate,
  renderReport,
  TrialsSchema,
  DiagnosticsSchema,
  parseEvaluationReport,
} from './report';
import { runLiveTrials } from './live';
import { afterEvaluationCall, type Cooldown } from './cooldown';
import { evaluationFetch, mergeDiagnostic } from './diagnostic-fetch';
import type { EvaluationDiagnostic } from '../contracts/evaluationDiagnostic';
import { readCheckout, validateLiveApproval } from './approval';

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8'));
}

export async function main(args = process.argv.slice(2)) {
  const { values } = parseArgs({
    args,
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
  const checkout = readCheckout();
  const liveApproval = values['live-approval']
    ? validateLiveApproval(
        benchmark,
        await readJson(values['live-approval']),
        checkout,
      )
    : undefined;
  const baseline = values.baseline
    ? parseEvaluationReport(await readJson(values.baseline), benchmark)
    : undefined;
  const output = resolve(values.output);
  await mkdir(output, { recursive: true });
  let trials = values.trials
    ? TrialsSchema.parse(await readJson(values.trials))
    : undefined;
  const cooldowns: Cooldown[] = [];
  const captured = new Map<string, EvaluationDiagnostic>();
  const key = process.env.LLM_EVALUATION_RATE_KEY;
  const capturedFetch =
    liveApproval && key
      ? evaluationFetch(liveApproval.endpoint, key, (entry) =>
          mergeDiagnostic(captured, entry),
        )
      : fetch;
  const saveCaptured = async () => {
    if (key)
      await writeFile(
        resolve(output, 'response-diagnostics.json'),
        `${JSON.stringify([...captured.values()], null, 2)}\n`,
      );
  };
  if (liveApproval)
    trials = await runLiveTrials(
      benchmark,
      liveApproval,
      values['allow-paid'],
      capturedFetch,
      async (progress) => {
        await saveCaptured();
        await writeFile(
          resolve(output, 'live-progress.json'),
          `${JSON.stringify(progress, null, 2)}\n`,
        );
      },
      async (warmups) => {
        await saveCaptured();
        await writeFile(
          resolve(output, 'warmups.json'),
          `${JSON.stringify(warmups, null, 2)}\n`,
        );
      },
      checkout,
      (response, requestId) =>
        afterEvaluationCall(response, requestId, async (entry) => {
          cooldowns.push(entry);
          await writeFile(
            resolve(output, 'cooldowns.json'),
            `${JSON.stringify(cooldowns, null, 2)}\n`,
          );
        }),
      async (warmups) => {
        await saveCaptured();
        await writeFile(
          resolve(output, 'recovery-warmups.json'),
          `${JSON.stringify(warmups, null, 2)}\n`,
        );
      },
    );
  const report = evaluate(benchmark, {
    sourceRevision: `${checkout.sourceRevision}${checkout.dirty ? '-dirty' : ''}`,
    trials,
    evidence: liveApproval
      ? {
          kind: 'fresh',
          sourceRevision: liveApproval.approvedSourceRevision,
          runId: liveApproval.approvedWorkflowRunId,
          runAttempt: liveApproval.approvedWorkflowRunAttempt,
        }
      : { kind: 'replay' },
    diagnostics: values.diagnostics
      ? DiagnosticsSchema.parse(await readJson(values.diagnostics))
      : undefined,
  });
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
