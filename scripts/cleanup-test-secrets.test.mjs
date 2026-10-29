import { describe, expect, it, vi } from 'vitest';
import { cleanupTestSecrets } from './cleanup-test-secrets.mjs';

const config = {
  name: 'ai-sprint-recommender-llm-test',
  vars: { LLM_ENVIRONMENT: 'test', LLM_ENABLED: 'false' },
};
const credentials = { accountId: 'a'.repeat(32), token: 'fake-test-token' };
const names = ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'LLM_RATE_KEY'];
const response = (result) => Response.json({ success: true, result });

describe('test Worker secret cleanup', () => {
  it('deletes only test provider bindings and verifies their absence', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        response([...names, 'OTHER'].map((name) => ({ name }))),
      )
      .mockResolvedValueOnce(response(null))
      .mockResolvedValueOnce(response(null))
      .mockResolvedValueOnce(response(null))
      .mockResolvedValueOnce(response([{ name: 'OTHER' }]));
    const report = await cleanupTestSecrets(config, credentials, fetcher);
    expect(report.confirmed).toBe(true);
    expect(report.paidCalls).toBe(0);
    expect(report.bindings.map((entry) => entry.outcome)).toEqual([
      'removed',
      'removed',
      'removed',
    ]);
    expect(
      fetcher.mock.calls
        .filter(([, init]) => init.method === 'DELETE')
        .map(([url]) => url.split('/').at(-1)),
    ).toEqual(names);
    expect(JSON.stringify(report)).not.toContain(credentials.token);
  });

  it('is idempotent when bindings are absent', async () => {
    const fetcher = vi.fn().mockImplementation(async () => response([]));
    const report = await cleanupTestSecrets(config, credentials, fetcher);
    expect(report.confirmed).toBe(true);
    expect(report.bindings.map((entry) => entry.outcome)).toEqual([
      'absent',
      'absent',
      'absent',
    ]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('still attempts remaining deletions after the first fails and sanitizes errors', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response(names.map((name) => ({ name }))))
      .mockRejectedValueOnce(new Error('fake-sensitive-value'))
      .mockResolvedValueOnce(response(null))
      .mockResolvedValueOnce(response(null))
      .mockResolvedValueOnce(response([{ name: names[0] }]));
    const report = await cleanupTestSecrets(config, credentials, fetcher);
    expect(report.confirmed).toBe(false);
    expect(report.bindings.map((entry) => entry.outcome)).toEqual([
      'failed',
      'removed',
      'removed',
    ]);
    expect(fetcher).toHaveBeenCalledTimes(5);
    expect(JSON.stringify(report)).not.toContain('fake-sensitive-value');
  });

  it('fails verification if a deleted binding still exists', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response([{ name: names[0] }]))
      .mockResolvedValueOnce(response(null))
      .mockResolvedValueOnce(response([{ name: names[0] }]));
    expect(
      (await cleanupTestSecrets(config, credentials, fetcher)).confirmed,
    ).toBe(false);
  });

  it('rejects production or enabled configuration before network access', async () => {
    const fetcher = vi.fn();
    for (const invalid of [
      { ...config, name: 'ai-sprint-recommender' },
      { ...config, vars: { ...config.vars, LLM_ENABLED: 'true' } },
      { ...config, vars: { ...config.vars, LLM_ENVIRONMENT: 'production' } },
    ]) {
      await expect(
        cleanupTestSecrets(invalid, credentials, fetcher),
      ).rejects.toThrow('disabled test Worker');
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('attempts every deletion if the initial listing fails, but requires final proof', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          { success: false, errors: ['sensitive'] },
          { status: 403 },
        ),
      )
      .mockResolvedValueOnce(response(null))
      .mockResolvedValueOnce(response(null))
      .mockResolvedValueOnce(response(null))
      .mockResolvedValueOnce(response([]));
    const report = await cleanupTestSecrets(config, credentials, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(5);
    expect(report.confirmed).toBe(true);
    expect(JSON.stringify(report)).not.toContain('sensitive');
  });
});
