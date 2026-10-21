import { build } from 'esbuild';

try {
  // Bundle TypeScript and its extensionless imports without adding a runtime dependency.
  const result = await build({
    entryPoints: ['src/evaluation/cli.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    write: false,
    logLevel: 'silent',
  });
  const module = await import(
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`
  );
  await module.main();
} catch {
  // Zod/network errors can contain goals or response bodies. Do not print them.
  console.error(
    'Evaluation failed. Check fixture hashes, references, trial versions, approval fields and command options. No report is evidence of a passing run.',
  );
  process.exitCode = 1;
}
