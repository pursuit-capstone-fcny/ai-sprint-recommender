import {
  ContributionConfigSchema,
  type ContributionConfig,
} from '../contracts/contribution';

export function contributionConfig(): ContributionConfig | null {
  if (import.meta.env.VITE_REQUESTS_ENABLED !== 'true') return null;
  try {
    return ContributionConfigSchema.parse(
      JSON.parse(import.meta.env.VITE_REQUESTS_CONFIG ?? ''),
    );
  } catch {
    return null;
  }
}
