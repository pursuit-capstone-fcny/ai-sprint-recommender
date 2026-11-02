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

const command = ['exec', 'wrangler', 'secret'];
const target = ['--config', 'wrangler.library.jsonc'];
try {
  const existing = JSON.parse(
    execFileSync('pnpm', [...command, 'list', ...target], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }),
  );
  const secrets = { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY };
  if (!existing.some(({ name }) => name === 'LLM_RATE_KEY'))
    secrets.LLM_RATE_KEY = randomBytes(32).toString('hex');
  execFileSync('pnpm', [...command, 'bulk', ...target], {
    input: JSON.stringify(secrets),
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  console.log('Production provider secrets configured.');
} catch {
  // Child-process errors can contain stdin. Never print the underlying error.
  console.error('Production provider secret configuration failed.');
  process.exit(1);
}
