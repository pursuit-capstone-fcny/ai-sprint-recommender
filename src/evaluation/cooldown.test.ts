import { expect, it, vi } from 'vitest';
import { afterEvaluationCall } from './cooldown';

it('waits out an unknown reservation without retrying or changing the failed result', async () => {
  const response = { outcome: 'fallback', reason: 'timeout' } as const;
  const save = vi.fn(async () => {});
  const wait = vi.fn(async () => {});
  await afterEvaluationCall(response, null, save, wait);
  expect(save).toHaveBeenCalledExactlyOnceWith({
    requestId: null,
    reason: 'timeout',
    delayMs: 61000,
  });
  expect(wait).toHaveBeenCalledExactlyOnceWith(61000);
  expect(response).toEqual({ outcome: 'fallback', reason: 'timeout' });
});
it('does not wait for relevance fallbacks or successful provider output', async () => {
  const save = vi.fn(async () => {});
  const wait = vi.fn(async () => {});
  await afterEvaluationCall(
    { outcome: 'fallback', reason: 'insufficient-results' },
    null,
    save,
    wait,
  );
  await afterEvaluationCall(
    {
      outcome: 'success',
      youtubeIds: [],
      catalogVersion: `sha256:${'a'.repeat(64)}`,
      modelVersion: 'gpt-6-luna',
      promptVersion: 'catalog-rank-v10',
    },
    null,
    save,
    wait,
  );
  expect(save).not.toHaveBeenCalled();
  expect(wait).not.toHaveBeenCalled();
});
