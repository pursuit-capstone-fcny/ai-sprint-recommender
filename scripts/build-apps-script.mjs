import { build } from 'esbuild';
import { mkdir, copyFile, readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';

const testBuild = process.argv.includes('--test');
if (process.argv.slice(2).some((arg) => arg !== '--test'))
  throw new Error('Only --test is supported.');
const directory = testBuild ? 'build/apps-script-test' : 'build/apps-script';
const entryPoints = testBuild
  ? ['apps-script/test-entry.ts']
  : ['apps-script/index.ts'];
const exportedFunctions = [
  'publishLibrary',
  'libraryPublishStatus',
  'showLibraryMenu',
  'openLibraryPublisher',
  'installLibraryPublisher',
  'doGet',
  'doPost',
  'initializeUsageLog',
  'purgeUsageLog',
  'clearAnalytics',
  'initializeAnalytics',
  'refreshAnalytics',
  'installAnalyticsTriggers',
  'refreshAnalyticsOnEdit',
  'analyticsReportLinks',
];
if (testBuild) exportedFunctions.push('initializeTestCatalog');
await mkdir(directory, { recursive: true });
await build({
  entryPoints,
  outfile: `${directory}/Code.js`,
  bundle: true,
  format: 'iife',
  globalName: 'CatalogApp',
  platform: 'browser',
  target: 'es2020',
  footer: {
    js: exportedFunctions
      .map((name) => `function ${name}(e) { return CatalogApp.${name}(e); }`)
      .join('\n'),
  },
});
await copyFile(
  'apps-script/LibraryPublisher.html',
  `${directory}/LibraryPublisher.html`,
);
await copyFile('apps-script/appsscript.json', `${directory}/appsscript.json`);
const context = {};
runInNewContext(await readFile(`${directory}/Code.js`, 'utf8'), context, {
  timeout: 5000,
});
for (const name of exportedFunctions)
  assert.equal(typeof context[name], 'function');
if (!testBuild) assert.equal(context.initializeTestCatalog, undefined);
// A callable wrapper that drops the POST event would reject every real request.
const request = { postData: { type: 'text/plain', contents: '{}' } };
context.CatalogApp = { doPost: (event) => event };
assert.equal(context.doPost(request), request);
console.log(
  `Apps Script bundle built at ${directory}; ${exportedFunctions.join(', ')} available.`,
);
