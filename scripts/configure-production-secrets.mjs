import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync('wrangler.library.jsonc', 'utf8'));
if (
  config.name !== 'ai-sprint-recommender' ||
  config.vars.LLM_ENVIRONMENT !== 'production' ||
  config.vars.LLM_ENABLED !== 'true' ||
  !process.env.ANTHROPIC_API_KEY
)
  throw new Error('Production provider configuration is incomplete');

const command = ['node_modules/wrangler/bin/wrangler.js', 'secret'];
const target = ['--config', 'wrangler.library.jsonc'];
let stage = 'listing secret names';
try {
  const existing = JSON.parse(
    execFileSync(
      process.execPath,
      [...command, 'list', '--format', 'json', ...target],
      {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    ),
  );
  const secrets = {};
  if (!existing.some(({ name }) => name === 'ANTHROPIC_API_KEY'))
    secrets.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!existing.some(({ name }) => name === 'LLM_RATE_KEY'))
    secrets.LLM_RATE_KEY = randomBytes(32).toString('hex');
  if (Object.keys(secrets).length === 0) {
    console.log('Existing production provider secrets preserved.');
    process.exit(0);
  }
  stage = 'uploading server secrets';
  execFileSync(process.execPath, [...command, 'bulk', ...target], {
    input: JSON.stringify(secrets),
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  console.log('Production provider secrets configured.');
} catch (error) {
  // Child-process errors can contain stdin. Never print the underlying error.
  const failure =
    error instanceof SyntaxError
      ? 'invalid CLI JSON'
      : `exit ${Number(error.status) || 'unknown'}`;
  console.error(
    `Production provider secret configuration failed while ${stage}: ${failure}.`,
  );
  process.exit(1);
}
