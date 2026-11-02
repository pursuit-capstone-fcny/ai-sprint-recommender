import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const hash = (value) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

try {
  const args = process.argv.slice(2);
  const options = new Map();
  const allowed = ['--catalog', '--input', '--assessment', '--output'];
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];
    if (
      !allowed.includes(key) ||
      options.has(key) ||
      !value ||
      value.startsWith('--')
    )
      throw new Error('Options');
    options.set(key, value);
  }
  if (['--catalog', '--input', '--output'].some((key) => !options.has(key)))
    throw new Error('Options');
  const json = async (path) => JSON.parse(await readFile(path, 'utf8'));
  const compiled = await build({
    entryPoints: ['server/full-catalog-scoring.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    write: false,
    logLevel: 'silent',
  });
  const { prepareCatalogScoring } = await import(
    `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`
  );
  const plan = prepareCatalogScoring(
    await json(options.get('--input')),
    await json(options.get('--catalog')),
  );
  const canned = options.has('--assessment')
    ? await json(options.get('--assessment'))
    : undefined;
  const decision = canned === undefined ? undefined : plan.complete(canned);
  const payload = JSON.parse(plan.request.messages[0].content);
  const manifest = {
    mode: 'offline-only',
    model: plan.request.model,
    promptVersion: plan.promptVersion,
    catalogVersion: payload.catalogVersion,
    catalogCount: payload.catalog.length,
    catalogWireSha256: hash(payload.catalog),
    requestSha256: hash(plan.request),
    assessmentSha256: canned === undefined ? null : hash(canned),
    metadataTruncated: false,
    rulesPrefilter: false,
    inputTokenBound: plan.inputTokenBound,
    maxOutputTokens: plan.request.max_tokens,
    providerCalls: 0,
    measuredCostUsd: 0,
  };
  // Never overwrite a historical run. No client, key lookup or paid transport
  // exists here; this command only prepares a request and checks canned JSON.
  const output = options.get('--output');
  await mkdir(output);
  for (const [name, value] of [
    ['request', plan.request],
    ['manifest', manifest],
    ...(decision ? [['decision', decision]] : []),
  ]) {
    await writeFile(
      `${output}/${name}.json`,
      JSON.stringify(value, null, 2) + '\n',
      { flag: 'wx', mode: 0o600 },
    );
  }
  console.log(
    decision
      ? `Offline scoring: ${decision.state.status}`
      : 'Offline request prepared',
  );
  if (decision?.state.status === 'unavailable') process.exitCode = 2;
} catch {
  // Validation/build errors may contain user input or source text.
  console.error(
    'Offline scoring failed. Check command options and input files; use a new output directory.',
  );
  process.exitCode = 1;
}
