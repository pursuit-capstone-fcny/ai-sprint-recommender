import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const [benchmarkPath, trialsPath] = process.argv.slice(2);
if (!benchmarkPath) {
  throw new Error(
    'Usage: pnpm evaluate:displayed benchmark.json [trials.json]',
  );
}
const root = fileURLToPath(new URL('../', import.meta.url));
const { outputFiles } = await build({
  entryPoints: [`${root}src/evaluation/expandedBenchmark.ts`],
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
});
const { scoreExpandedBenchmark } = await import(
  `data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`
);
const benchmark = JSON.parse(await readFile(benchmarkPath, 'utf8'));
const trials = trialsPath
  ? JSON.parse(await readFile(trialsPath, 'utf8'))
  : undefined;
process.stdout.write(
  `${JSON.stringify(scoreExpandedBenchmark(benchmark, trials), null, 2)}\n`,
);
