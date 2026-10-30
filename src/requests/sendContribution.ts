import {
  ContributionSchema,
  type Contribution,
} from '../contracts/contribution';

export async function sendContribution(
  endpoint: string,
  value: Contribution,
): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const body = JSON.stringify(ContributionSchema.parse(value));
    const response = await fetch(endpoint, {
      method: 'POST',
      body,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!response.ok || response.type === 'opaque') return false;
    const result: unknown = await response.json();
    return Boolean(
      result &&
      typeof result === 'object' &&
      'ok' in result &&
      result.ok === true &&
      'status' in result &&
      (result.status === 'accepted' || result.status === 'duplicate'),
    );
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
