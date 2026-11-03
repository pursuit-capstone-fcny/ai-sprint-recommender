import { haikuModelVars } from './haiku-model.mjs';

// Only a named test preview may receive the temporary provider credential.
export function privateTestHaiku(env, origin, now = Date.now()) {
  if (env.PRIVATE_TEST_LIVE_HAIKU !== 'true') return null;
  const name = env.PREVIEW_NAME ?? '';
  if (
    env.VITE_USAGE_ENVIRONMENT !== 'test' ||
    env.VITE_LLM_ENABLED !== 'true' ||
    !/^[a-z0-9][a-z0-9-]{0,31}$/.test(name) ||
    !origin?.startsWith(`https://${name}-ai-sprint-library-test.`)
  )
    throw new Error('Live tests require an isolated test preview and catalog');
  const expires = Date.parse(env.LLM_TEST_EXPIRES_AT ?? '');
  if (
    !Number.isFinite(expires) ||
    expires <= now ||
    expires > now + 15 * 60_000
  )
    throw new Error('Live test expiry must be within fifteen minutes');
  return {
    LLM_ENABLED: 'true',
    LLM_APPROVALS_RECORDED: 'true',
    LLM_ENVIRONMENT: 'test',
    ...haikuModelVars,
    LLM_TEST_EXPIRES_AT: new Date(expires).toISOString(),
    LLM_MAX_INPUT_TOKENS: '80000',
    LLM_MAX_OUTPUT_TOKENS: '8192',
    LLM_REQUESTS_PER_MINUTE: '2',
    LLM_CLIENT_REQUESTS_PER_MINUTE: '2',
    LLM_MAX_CONCURRENCY: '1',
    LLM_DAILY_MICRODOLLARS: '50000',
    LLM_MONTHLY_MICRODOLLARS: '50000',
    LLM_DIAGNOSTICS_ENABLED: 'true',
  };
}
