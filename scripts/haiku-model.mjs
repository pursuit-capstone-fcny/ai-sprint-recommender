// Standard pricing for prompts up to 100k tokens. Both deployment paths cap
// input at 80k. Keep their model and cost accounting aligned.
// https://platform.claude.com/docs/en/models/haiku-5-5/overview
export const haikuModelVars = Object.freeze({
  LLM_MODEL: 'claude-haiku-5-5',
  LLM_INPUT_MICRODOLLARS_PER_MILLION: '100000',
  LLM_OUTPUT_MICRODOLLARS_PER_MILLION: '500000',
});
