// @vitest-environment node
import { expect, it, vi } from 'vitest';
import { verifyDisabledTest } from './verify-disabled-test.mjs';

const disabled = () =>
  Response.json({ outcome: 'fallback', reason: 'disabled' });
const oldDeployment = () =>
  Response.json(
    {
      outcome: 'fallback',
      reason: 'unavailable',
      modelVersion: 'fixture-model',
    },
    { status: 400 },
  );

it('waits for shutdown propagation using only invalid, unpaid intake', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(oldDeployment())
    .mockResolvedValueOnce(disabled());
  const wait = vi.fn();
  const report = await verifyDisabledTest(fetcher, wait);
  expect(report.confirmed).toBe(true);
  expect(report.attempts.map((x) => x.reason)).toEqual([
    'unavailable',
    'disabled',
  ]);
  expect(wait).toHaveBeenCalledExactlyOnceWith(1_000);
  for (const [url, options] of fetcher.mock.calls) {
    expect(url).toBe(
      'https://ai-sprint-recommender-llm-test.jason-zeng151.workers.dev/api/recommendations',
    );
    expect(options.body).toBe('{}');
    expect(options.redirect).toBe('error');
  }
});

it('fails after a bounded wait if shutdown never arrives', async () => {
  const fetcher = vi.fn(async () => oldDeployment());
  const wait = vi.fn();
  await expect(verifyDisabledTest(fetcher, wait)).rejects.toThrow('30 probes');
  expect(fetcher).toHaveBeenCalledTimes(30);
  expect(wait).toHaveBeenCalledTimes(29);
});

it('does not retry an unexpected provider result', async () => {
  const fetcher = vi.fn(async () =>
    Response.json({ outcome: 'success', youtubeIds: [] }),
  );
  await expect(verifyDisabledTest(fetcher, vi.fn())).rejects.toThrow(
    'Unexpected',
  );
  expect(fetcher).toHaveBeenCalledTimes(1);
});
