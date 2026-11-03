import {
  RECOMMENDATION_DEADLINE_MS,
  QUEUED_RECOMMENDATION_DEADLINE_MS,
  RECOMMENDATION_PATH,
  RecommendationRequestSchema,
  RecommendationResponseSchema,
  type RecommendationRequest,
  type RecommendationResponse,
} from '../contracts/recommendation';

export function recommendationsEnabled(): boolean {
  return import.meta.env.VITE_LLM_ENABLED === 'true';
}
let clientId: string | undefined;

// One same-origin call, no retries or persisted request data. Abort alone is
// insufficient: a stalled response body must also lose to the deadline.
export async function requestRecommendations(
  request: RecommendationRequest,
  signal: AbortSignal,
): Promise<RecommendationResponse> {
  const parsed = RecommendationRequestSchema.safeParse(request);
  if (!parsed.success) return { outcome: 'fallback', reason: 'unavailable' };
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: () => void = () => {};
  const cancelled = new Promise<RecommendationResponse>((resolve) => {
    onAbort = () => {
      controller.abort();
      resolve({ outcome: 'fallback', reason: 'not-requested' });
    };
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) onAbort();
    timer = setTimeout(
      () => {
        controller.abort();
        resolve({ outcome: 'fallback', reason: 'timeout' });
      },
      import.meta.env.VITE_LLM_QUEUE_ENABLED === 'true'
        ? QUEUED_RECOMMENDATION_DEADLINE_MS
        : RECOMMENDATION_DEADLINE_MS,
    );
  });
  const response = async (): Promise<RecommendationResponse> => {
    if (signal.aborted) return { outcome: 'fallback', reason: 'not-requested' };
    try {
      const result = await fetch(RECOMMENDATION_PATH, {
        method: 'POST',
        body: JSON.stringify({
          ...parsed.data,
          ...(import.meta.env.VITE_LLM_QUEUE_ENABLED === 'true'
            ? { clientId: (clientId ??= crypto.randomUUID()) }
            : {}),
        }),
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        cache: 'no-store',
        signal: controller.signal,
      });
      const body = await result.text();
      if (body.length > 16_384)
        return { outcome: 'fallback', reason: 'invalid-response' };
      let json: unknown;
      try {
        json = JSON.parse(body);
      } catch {
        return { outcome: 'fallback', reason: 'invalid-response' };
      }
      const decoded = RecommendationResponseSchema.safeParse(json);
      if (
        !decoded.success ||
        (!result.ok && decoded.data.outcome === 'success')
      )
        return { outcome: 'fallback', reason: 'invalid-response' };
      return decoded.data;
    } catch {
      return { outcome: 'fallback', reason: 'provider-error' };
    }
  };
  try {
    return await Promise.race([cancelled, response()]);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
  }
}
