// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../server/failure-test-worker';
import scenarios from '../fixtures/recommendation-failure-cases.json' with { type: 'json' };
import {
  verifyFailureCase,
  FAILURE_TEST_ORIGIN,
} from './verify-failure-worker.mjs';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe('isolated deployed failure harness', () => {
  it.each(scenarios.filter((entry) => entry.name !== 'timeout'))(
    'checks $name through the real endpoint without external fetch',
    async (expected) => {
      const network = vi.fn(() => {
        throw new Error('External network forbidden');
      });
      vi.stubGlobal('fetch', network);
      const response = await worker.fetch(
        new Request(`${FAILURE_TEST_ORIGIN}/cases/${expected.name}`),
      );
      expect(response.status).toBe(200);
      verifyFailureCase(expected, await response.json());
      expect(network).not.toHaveBeenCalled();
    },
  );
  it('observes the real five-second timeout and provider abort', async () => {
    vi.useFakeTimers();
    const expected = scenarios.find((entry) => entry.name === 'timeout');
    const pending = worker.fetch(
      new Request(`${FAILURE_TEST_ORIGIN}/cases/timeout`),
    );
    await vi.advanceTimersByTimeAsync(5_000);
    verifyFailureCase(expected, await (await pending).json());
  });
  it('rejects arbitrary scenario names, queries and request bodies', async () => {
    expect(
      (await worker.fetch(new Request(`${FAILURE_TEST_ORIGIN}/cases/unknown`)))
        .status,
    ).toBe(404);
    expect(
      (
        await worker.fetch(
          new Request(
            `${FAILURE_TEST_ORIGIN}/cases/success?url=https://example.invalid`,
          ),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await worker.fetch(
          new Request(`${FAILURE_TEST_ORIGIN}/cases/success`, {
            method: 'POST',
            body: '{}',
          }),
        )
      ).status,
    ).toBe(405);
  });
  it('fails verification if a supposed budget denial dispatches a provider', () => {
    const expected = scenarios.find(
      (entry) => entry.name === 'budget-exhausted',
    );
    expect(() =>
      verifyFailureCase(expected, {
        mode: 'synthetic-dependencies',
        scenario: expected.name,
        status: 200,
        calls: { catalogReads: 1, providerCalls: 1, reservations: 1 },
      }),
    ).toThrow();
  });
  it('requires the catalog version after successful catalog validation', async () => {
    const expected = scenarios.find((entry) => entry.name === 'success');
    const response = await worker.fetch(
      new Request(`${FAILURE_TEST_ORIGIN}/cases/success`),
    );
    const result = await response.json();
    delete result.result.catalogVersion;
    expect(() => verifyFailureCase(expected, result)).toThrow();
  });
});
