import { setTimeout as delay } from 'node:timers/promises';
import type { RecommendationResponse } from '../contracts/recommendation';

export interface Cooldown {
  requestId: string | null;
  reason: 'timeout' | 'provider-error' | 'rate-limited';
  delayMs: number;
}

// Independent profiles should not inherit an earlier call's live concurrency lease.
// Preserve the failed result and full reservation; never retry the paid request.
export async function afterEvaluationCall(
  response: RecommendationResponse,
  requestId: string | null,
  save: (entry: Cooldown) => Promise<void>,
  wait: (ms: number) => Promise<unknown> = delay,
) {
  if (
    response.outcome !== 'fallback' ||
    !['timeout', 'provider-error', 'rate-limited'].includes(response.reason)
  )
    return false;
  const reason = response.reason as Cooldown['reason'];
  await save({ requestId, reason, delayMs: 61_000 });
  await wait(61_000);
  return true;
}
