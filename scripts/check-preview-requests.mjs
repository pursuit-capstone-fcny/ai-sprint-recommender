import { ContributionConfigSchema } from '../src/contracts/contribution.ts';

if (process.env.VITE_REQUESTS_ENABLED === 'true') {
  let preview;
  let productionEndpoint;
  try {
    preview = ContributionConfigSchema.parse(
      JSON.parse(process.env.VITE_REQUESTS_CONFIG ?? ''),
    );
    const production = process.env.PRODUCTION_REQUESTS_CONFIG;
    productionEndpoint = production
      ? ContributionConfigSchema.shape.endpoint.parse(
          JSON.parse(production).endpoint,
        )
      : undefined;
  } catch {
    throw new Error('Check the preview and production Requests configuration.');
  }
  if (preview.endpoint !== process.env.VITE_USAGE_TEST_URL?.trim())
    throw new Error('Preview Requests must use the designated test collector.');
  if (
    preview.endpoint === productionEndpoint ||
    preview.endpoint === process.env.PRODUCTION_COLLECTOR_URL?.trim()
  )
    throw new Error(
      'Preview Requests require a separate collector from production.',
    );
}
