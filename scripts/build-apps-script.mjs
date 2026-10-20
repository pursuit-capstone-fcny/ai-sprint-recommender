import { build } from 'esbuild';
import { mkdir, copyFile, readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';

await mkdir('build/apps-script', { recursive: true });
await build({
  entryPoints: ['apps-script/index.ts'],
  outfile: 'build/apps-script/Code.js',
  bundle: true,
  format: 'iife',
  globalName: 'CatalogApp',
  platform: 'browser',
  target: 'es2020',
  footer: { js: 'function doGet() { return CatalogApp.doGet(); }' },
});
await copyFile(
  'apps-script/appsscript.json',
  'build/apps-script/appsscript.json',
);
const context = {};
runInNewContext(await readFile('build/apps-script/Code.js', 'utf8'), context, {
  timeout: 5000,
});
assert.equal(typeof context.doGet, 'function');
console.log('Apps Script bundle built; global doGet is available.');
