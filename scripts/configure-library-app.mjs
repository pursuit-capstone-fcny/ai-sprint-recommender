import ts from 'typescript';
import { readFile, writeFile } from 'node:fs/promises';
import { projectLibraryOrigin } from '../library/project.ts';
import { loadEnv } from 'vite';
const base = ts.parseConfigFileTextToJson(
  'wrangler.jsonc',
  await readFile('wrangler.jsonc', 'utf8'),
);
if (base.error) throw new Error('Invalid Worker config');
const configured = projectLibraryOrigin({
  ...loadEnv('production', process.cwd(), ''),
  ...process.env,
});
const config = {
  ...base.config,
  vars: {
    ...base.config.vars,
    LIBRARY_ORIGIN: configured ? configured : 'https://library-demo.invalid',
    LIBRARY_MODE: configured ? 'published' : 'bundled',
  },
};
if (process.env.VITE_USAGE_ENVIRONMENT === 'production') {
  config.main = 'server/enabled-worker.ts';
  config.durable_objects = {
    bindings: [
      { name: 'RECOMMENDATION_BUDGET', class_name: 'RecommendationBudget' },
    ],
  };
  config.migrations = [
    {
      tag: 'recommendation-budget-v1',
      new_sqlite_classes: ['RecommendationBudget'],
    },
  ];
  Object.assign(config.vars, {
    LLM_ENABLED: process.env.VITE_LLM_ENABLED === 'true' ? 'true' : 'false',
    LLM_APPROVALS_RECORDED: 'true',
    LLM_ENVIRONMENT: 'production',
    LLM_MODEL: 'claude-haiku-5-5',
    LLM_MAX_INPUT_TOKENS: '63000',
    LLM_MAX_OUTPUT_TOKENS: '16384',
    LLM_REQUESTS_PER_MINUTE: '10',
    LLM_CLIENT_REQUESTS_PER_MINUTE: '3',
    LLM_MAX_CONCURRENCY: '2',
    LLM_DAILY_MICRODOLLARS: '1000000',
    LLM_MONTHLY_MICRODOLLARS: '5000000',
    LLM_INPUT_MICRODOLLARS_PER_MILLION: '100000',
    LLM_OUTPUT_MICRODOLLARS_PER_MILLION: '500000',
    LLM_DIAGNOSTICS_ENABLED: 'true',
  });
  if (config.vars.LLM_ENABLED === 'true' && !configured)
    throw new Error('Production LLM requires a published catalog origin');
}
await writeFile(
  'wrangler.library.jsonc',
  JSON.stringify(config, null, 2) + '\n',
);
