import { build } from 'esbuild';

try {
  const result = await build({
    entryPoints: ['src/evaluation/grader-cli.ts'],
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
  console.error(
    'Catalog grading stopped. Check the key, exact workflow approval and saved partial capture. No summary means no completed run.',
  );
  process.exitCode = 1;
}
