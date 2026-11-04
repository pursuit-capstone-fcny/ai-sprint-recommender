import { build } from 'esbuild';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import ts from 'typescript';

// Run the pinned native engine directly, without Wrangler's local proxy/loopback.
// All dependencies are synthetic, and the runtime's internet service is denied.
const directory = resolve('build/evaluation/backend-native');
await mkdir(directory, { recursive: true });
const storage = await mkdtemp(`${directory}/state-`);
await build({
  entryPoints: ['server/scaling-test-worker.ts'],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  outfile: `${directory}/worker.mjs`,
  define: { 'import.meta.env': '{}' },
});
const parsed = ts.parseConfigFileTextToJson(
  'wrangler.scaling-test.jsonc',
  await readFile('wrangler.scaling-test.jsonc', 'utf8'),
);
if (parsed.error) throw new Error('Invalid native backend test config');
const config = parsed.config;
const bindings = [
  ...Object.entries(config.vars).map(
    ([name, text]) =>
      `(name = ${JSON.stringify(name)}, text = ${JSON.stringify(text)})`,
  ),
  ...config.durable_objects.bindings.map(
    ({ name, class_name }) =>
      `(name = ${JSON.stringify(name)}, durableObjectNamespace = ${JSON.stringify(class_name)})`,
  ),
].join(',\n');
const namespaces = config.durable_objects.bindings
  .map(
    ({ class_name }) =>
      `(className = ${JSON.stringify(class_name)}, uniqueKey = ${JSON.stringify(`fixture-${class_name}`)}, enableSql = true)`,
  )
  .join(',\n');
await writeFile(
  `${directory}/config.capnp`,
  `using Workerd = import "/workerd/workerd.capnp";
const config :Workerd.Config = (
  services = [
    (name = "main", worker = (
      modules = [(name = "worker.mjs", esModule = embed "worker.mjs")],
      compatibilityDate = "2026-10-01",
      bindings = [${bindings}],
      durableObjectNamespaces = [${namespaces}],
      durableObjectStorage = (localDisk = "storage")
    )),
    (name = "storage", disk = (path = ${JSON.stringify(storage)}, writable = true)),
    (name = "internet", network = (allow = []))
  ],
  sockets = [(name = "http", address = "127.0.0.1:8797", http = (), service = "main")]
);\n`,
);
const wrangler = createRequire(import.meta.resolve('wrangler'));
const metadata = wrangler.resolve('workerd/package.json');
const workerd = JSON.parse(await readFile(metadata, 'utf8'));
const command = resolve(dirname(metadata), workerd.bin.workerd);
const child = spawn(
  command,
  ['serve', `${directory}/config.capnp`, '--experimental'],
  { stdio: 'inherit' },
);
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
child.on('exit', (code) => {
  process.exitCode = code ?? 0;
});
console.log(
  'Native synthetic target at http://127.0.0.1:8797; all internet access disabled.',
);
