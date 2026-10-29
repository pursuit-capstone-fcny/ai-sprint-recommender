import { build } from 'esbuild';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';
const directory = 'build/apps-script-admin';
await mkdir(directory, { recursive: true });
const client = await build({
  entryPoints: ['src/admin/main.tsx'],
  bundle: true,
  write: false,
  outdir: directory,
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  jsx: 'automatic',
  minify: true,
  define: { 'process.env.NODE_ENV': '"production"' },
});
const script = client.outputFiles.find((file) =>
  file.path.endsWith('.js'),
).text;
const css = client.outputFiles.find((file) => file.path.endsWith('.css')).text;
await writeFile(
  `${directory}/Dashboard.html`,
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css.replaceAll('</style', '<\\/style')}</style></head><body><div id="root"></div><script>${script.replaceAll('</script', '<\\/script')}</script></body></html>`,
);
await build({
  entryPoints: ['apps-script-admin/index.ts'],
  outfile: `${directory}/Code.js`,
  bundle: true,
  format: 'iife',
  globalName: 'AdminApp',
  platform: 'browser',
  target: 'es2020',
  footer: {
    js: 'function doGet() { return AdminApp.doGet(); }\nfunction readDashboard() { return AdminApp.readDashboard(); }',
  },
});
await copyFile(
  'apps-script-admin/appsscript.json',
  `${directory}/appsscript.json`,
);
const context = {};
runInNewContext(await readFile(`${directory}/Code.js`, 'utf8'), context, {
  timeout: 5000,
});
assert.equal(typeof context.doGet, 'function');
assert.equal(typeof context.readDashboard, 'function');
for (const name of [
  'doPost',
  'refreshAnalytics',
  'clearAnalytics',
  'installAnalyticsTriggers',
])
  assert.equal(context[name], undefined);
const manifest = JSON.parse(await readFile(`${directory}/appsscript.json`));
assert.equal(manifest.webapp.executeAs, 'USER_ACCESSING');
assert.equal(manifest.webapp.access, 'ANYONE');
console.log(
  `Private admin bundle built at ${directory}; only authenticated doGet/readDashboard exported.`,
);
