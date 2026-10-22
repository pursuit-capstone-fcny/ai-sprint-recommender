import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { build } from 'esbuild';

try {
  const { values } = parseArgs({
    options: {
      benchmark: {
        type: 'string',
        default: 'docs/evaluation/2026-10-21/benchmark.json',
      },
      approval: {
        type: 'string',
        default: 'docs/evaluation/2026-10-21/approval.json',
      },
    },
  });
  const bundle = await build({
    stdin: {
      contents:
        "export { parseBenchmark } from './src/evaluation/benchmark'; export { validateLiveApproval } from './src/evaluation/approval';",
      resolveDir: process.cwd(),
      loader: 'ts',
    },
    bundle: true,
    platform: 'node',
    format: 'esm',
    write: false,
    logLevel: 'silent',
  });
  const { parseBenchmark, validateLiveApproval } = await import(
    `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`
  );
  validateLiveApproval(
    parseBenchmark(JSON.parse(await readFile(values.benchmark, 'utf8'))),
    JSON.parse(await readFile(values.approval, 'utf8')),
    undefined,
    Date.now(),
    34,
  );
  console.log(
    'Approved clean revision, benchmark, expiry and allowance confirmed. No network calls were made.',
  );
} catch {
  console.error(
    'Live approval check failed. An unexpired approval for this exact clean revision and benchmark is required. No network calls were made.',
  );
  process.exitCode = 1;
}
