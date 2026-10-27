import { build } from 'esbuild';

try {
  const result = await build({
    entryPoints: ['src/evaluation/luna-cli.ts'],
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
    'Luna comparison stopped. Check the key, model access, exact workflow approval and saved partial capture. No report means no completed comparison.',
  );
  process.exitCode = 1;
}
