import type { UsageEvent } from '../contracts/usageEvent';
import { createUsageSender, type UsageSender } from './sendUsage';
import { feedbackQuestion } from '../feedback/vote';

export interface UsageSession {
  sessionId: string;
  src: UsageEvent['src'];
  sender: UsageSender;
}

export function usageSource(search: string): UsageEvent['src'] {
  const value = new URLSearchParams(search).get('src');
  if (value === null) return 'website';
  switch (value) {
    case 'website':
    case 'email':
    case 'session':
    case 'pilot':
    case 'team':
      return value;
    default:
      return 'other';
  }
}

export function usageEndpoint(source: 'remote' | 'fixture'): string | null {
  const environment = import.meta.env.VITE_USAGE_ENVIRONMENT;
  const url = (
    environment === 'production'
      ? import.meta.env.VITE_USAGE_PRODUCTION_URL
      : import.meta.env.VITE_USAGE_TEST_URL
  )?.trim();
  if (
    source !== 'remote' ||
    (import.meta.env.VITE_USAGE_ENABLED !== 'true' && !feedbackQuestion()) ||
    (environment !== 'test' && environment !== 'production') ||
    !url ||
    !/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(
      url,
    )
  )
    return null;
  return url;
}

let session: UsageSession | undefined;
let endpoint: string | undefined;

// Page memory only: route remounts retain the visit, reloads create a new one.
export function getUsageSession(
  source: 'remote' | 'fixture',
): UsageSession | null {
  const url = usageEndpoint(source);
  if (!url || typeof crypto.randomUUID !== 'function') return null;
  if (!session || endpoint !== url) {
    endpoint = url;
    session = {
      sessionId: crypto.randomUUID(),
      src: usageSource(window.location.search),
      sender: createUsageSender(url, {
        automaticUsageEnabled: import.meta.env.VITE_USAGE_ENABLED === 'true',
      }),
    };
  }
  return session;
}
