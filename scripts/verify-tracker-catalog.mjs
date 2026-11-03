// Read-only verification against an explicit public snapshot and whitelisted
// tracker export. No Google writes, model calls or deployment occur here.
import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

const [snapshotPath, trackerPath, evidencePath, migrationPath] =
  process.argv.slice(2);
if (!snapshotPath || !trackerPath || !evidencePath)
  throw new Error(
    'Usage: node scripts/verify-tracker-catalog.mjs public-catalog.json public-tracker.json evidence.json [migration.json]',
  );
const { outputFiles } = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: [
      "export * from './apps-script/tracker-catalog';",
      "export { canonicalJson, catalogDataJson } from './src/library/catalog';",
      "export { parsePublicCatalog } from './src/contracts/publicCatalog';",
      "export { deterministicSelection } from './src/recommendations/deterministicSelection';",
      "export { prepareCatalogScoring } from './server/full-catalog-scoring';",
    ].join('\n'),
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  define: { 'import.meta.env': '{}' },
});
globalThis.Utilities = {
  DigestAlgorithm: { SHA_256: 'sha256' },
  Charset: { UTF_8: 'utf8' },
  computeDigest: (_algorithm, value) => [
    ...createHash('sha256').update(value).digest(),
  ],
};
const app = await import(
  `data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`
);
const baseline = app.parsePublicCatalog(
  JSON.parse(await readFile(snapshotPath, 'utf8')),
);
assert.equal(
  baseline.catalogVersion,
  'sha256:' +
    createHash('sha256').update(app.catalogDataJson(baseline)).digest('hex'),
);
const sourceRows = JSON.parse(await readFile(trackerPath, 'utf8'));
// An export must include only the recognized fields. Never persist entire grids.
for (const { cells } of sourceRows)
  assert.deepEqual(Object.keys(cells).sort(), [...app.trackerColumns].sort());
const needsMigration = sourceRows.every(
  ({ cells }) => !cells['Task keywords'] && !cells['Metadata status'],
);
const migration = needsMigration
  ? app.planTrackerMigration(sourceRows, baseline)
  : { updates: [] };
const rows = structuredClone(sourceRows);
for (const update of migration.updates)
  rows.find((row) => row.row === update.row).cells[update.field] = update.value;
const { catalog, problems } = app.buildTrackerCatalog(rows, baseline);
assert.deepEqual(problems, []);
assert.deepEqual(catalog, baseline);
assert.deepEqual(
  app.buildTrackerCatalog([...rows].reverse(), baseline).catalog,
  baseline,
);
const goals = [
  ...new Set([
    ...baseline.tasks,
    ...baseline.tools,
    ...baseline.tools.map((tool) => `Help me with ${tool}.`),
    'Help me build and understand spreadsheet formulas in Excel.',
    'Summarize a grant report with ChatGPT.',
    'Find grant opportunities and draft a proposal.',
    'Write a newsletter for donors.',
    'Research with Perplexity.',
    'I do not want to use ChatGPT. Help me with Copilot.',
  ]),
];
let deterministicChecks = 0,
  llmInputChecks = 0;
const profiles = [
  { functionArea: null, tools: [], goalWords: [] },
  ...baseline.functionAreas.map((functionArea) => ({
    functionArea,
    tools: [],
    goalWords: [],
  })),
  ...baseline.tools.map((tool) => ({
    functionArea: null,
    tools: [tool],
    goalWords: [],
  })),
];
for (const goal of goals) {
  for (const profile of profiles) {
    assert.deepEqual(
      app.deterministicSelection(catalog, goal, profile),
      app.deterministicSelection(baseline, goal, profile),
    );
    deterministicChecks++;
  }
  const input = {
    goal,
    functionArea: null,
    tools: [],
    catalogVersion: baseline.catalogVersion,
  };
  assert.deepEqual(
    app.prepareCatalogScoring(input, catalog).request,
    app.prepareCatalogScoring(input, baseline).request,
  );
  llmInputChecks++;
}
const newRow = {
  row: Math.max(...rows.map((row) => row.row)) + 1,
  cells: {
    'Video Title': 'Fictional volunteer scheduling tutorial',
    Description:
      'A fictional walkthrough of volunteer scheduling in a new tool.',
    'YouTube Link': 'https://youtu.be/newVideo001',
    'Primary Category (Web)': 'Volunteer services',
    'Category 2': '',
    Tool: 'Fixture scheduler',
    Status: 'Live on YouTube',
    'Task keywords': 'volunteer scheduling',
    'Metadata status': 'Ready',
    'Instruction format': 'walkthrough',
  },
};
const expanded = app.buildTrackerCatalog([...rows, newRow], catalog);
assert.deepEqual(expanded.problems, []);
assert.equal(expanded.catalog.items.length, baseline.items.length + 1);
assert.ok(expanded.catalog.tasks.includes('volunteer scheduling'));
assert.ok(
  app
    .deterministicSelection(
      expanded.catalog,
      'volunteer scheduling',
      profiles[0],
    )
    .results.some((r) => r.item.youtubeId === 'newVideo001'),
);
app.prepareCatalogScoring(
  {
    goal: 'volunteer scheduling',
    tools: [],
    functionArea: null,
    catalogVersion: expanded.catalog.catalogVersion,
  },
  expanded.catalog,
);
newRow.cells['Metadata status'] = 'Draft';
assert.equal(app.buildTrackerCatalog([...rows, newRow], catalog).catalog, null);
const report = {
  verifiedAt: new Date().toISOString(),
  baselineVersion: baseline.catalogVersion,
  videos: baseline.items.length,
  exactCatalogEquality: true,
  reorderedCatalogEquality: true,
  deterministicChecks,
  llmInputChecks,
  liveLlmCalls: 0,
  addedVideoWithoutCodeChanges: true,
  expandedVideos: expanded.catalog.items.length,
  incompleteVideoBlocksPublication: true,
  migrationChanges: Object.fromEntries(
    app.trackerColumns.map((field) => [
      field,
      migration.updates.filter((u) => u.field === field).length,
    ]),
  ),
};
await writeFile(evidencePath, JSON.stringify(report, null, 2) + '\n');
if (migrationPath)
  await writeFile(
    migrationPath,
    JSON.stringify(
      { baselineVersion: baseline.catalogVersion, updates: migration.updates },
      null,
      2,
    ) + '\n',
  );
console.log(JSON.stringify(report, null, 2));
