// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../server/failure-test-worker';
import scenarios from '../fixtures/recommendation-failure-cases.json' with { type: 'json' };
import {
  verifyFailureCase,
  FAILURE_TEST_ORIGIN,
  runFailureChecks,
  failureReport,
} from './verify-failure-worker.mjs';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function captureFailure(fetcher, wait = vi.fn(async () => {})) {
  try {
    await runFailureChecks(fetcher, wait);
  } catch (error) {
    return failureReport(error);
  }
  throw new Error('Expected verification to fail');
}

describe('safe deployed verification failure context', () => {
  it.each([404, 503])(
    'records persistent HTTP %i after four attempts without saving the body',
    async (status) => {
      const fetcher = vi.fn(
        async () => new Response('private response text', { status }),
      );
      const wait = vi.fn(async () => {});
      const report = await captureFailure(fetcher, wait);
      expect(report.failedCheck).toMatchObject({
        scenario: 'success',
        phase: 'http-status',
        classification: 'http-status',
        httpStatus: status,
      });
      expect(report.completedChecks).toBe(0);
      expect(fetcher).toHaveBeenCalledTimes(4);
      expect(wait.mock.calls.map(([milliseconds]) => milliseconds)).toEqual([
        2000, 4000, 8000,
      ]);
      expect(report.failedCheck.attempts).toEqual(
        Array.from({ length: 4 }, (_, index) => ({
          attempt: index + 1,
          httpStatus: status,
          startedAt: expect.any(String),
        })),
      );
      expect(JSON.stringify(report)).not.toContain('private response text');
    },
  );
  it.each([
    ['json', 'invalid-json', () => new Response('private malformed body')],
    ['body-size', 'body-too-large', () => new Response('x'.repeat(8_193))],
    [
      'fetch',
      'transport-error',
      () => {
        throw new Error('private transport details');
      },
    ],
  ])(
    'identifies %s failures without saving raw error content',
    async (phase, classification, response) => {
      const report = await captureFailure(async () => response());
      expect(report.failedCheck).toMatchObject({
        scenario: 'success',
        phase,
        classification,
      });
      expect(JSON.stringify(report)).not.toContain('private');
    },
  );
  it('retains only allowlisted actual fields for a failed result assertion', async () => {
    const actual = await (
      await worker.fetch(new Request(`${FAILURE_TEST_ORIGIN}/cases/success`))
    ).json();
    actual.result = {
      ...actual.result,
      outcome: 'fallback',
      reason: 'provider-error',
      promptVersion: 'catalog-rank-v2',
      youtubeIds: ['private-response-content'],
      extra: 'private nested value',
    };
    actual.raw = 'private top level value';
    const fetcher = vi.fn(async () => Response.json(actual));
    const wait = vi.fn(async () => {});
    const report = await captureFailure(fetcher, wait);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
    expect(report.failedCheck).toMatchObject({
      scenario: 'success',
      phase: 'assertion',
      classification: 'assertion-failed',
      httpStatus: 200,
      actual: {
        status: 200,
        calls: { catalogReads: 1, providerCalls: 1, reservations: 1 },
        result: {
          outcome: 'fallback',
          reason: 'provider-error',
          promptVersion: 'catalog-rank-v2',
          youtubeIdCount: 1,
          allIdsKnown: false,
        },
      },
    });
    expect(JSON.stringify(report)).not.toContain('private');
  });
  it('preserves prior passing cases without including unexpected response fields', async () => {
    const first = await (
      await worker.fetch(new Request(`${FAILURE_TEST_ORIGIN}/cases/success`))
    ).json();
    first.unexpected = 'private extra field';
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json(first))
      .mockResolvedValueOnce(new Response('private failure', { status: 500 }));
    const report = await captureFailure(fetcher);
    expect(report.completedChecks).toBe(1);
    expect(report.failedCheck.scenario).toBe('default-off');
    expect(report.checks[0]).toMatchObject({
      scenario: 'success',
      passed: true,
    });
    expect(JSON.stringify(report)).not.toContain('private');
  });
  it('retains the initial 404 when the next attempt passes, then stops on a nonretryable status', async () => {
    const first = await worker.fetch(
      new Request(`${FAILURE_TEST_ORIGIN}/cases/success`),
    );
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(new Response('', { status: 500 }));
    const wait = vi.fn(async () => {});
    const report = await captureFailure(fetcher, wait);
    expect(report.completedChecks).toBe(1);
    expect(
      report.checks[0].attempts.map(({ httpStatus }) => httpStatus),
    ).toEqual([404, 200]);
    expect(
      report.checks[0].attempts.every(({ startedAt }) =>
        Number.isFinite(Date.parse(startedAt)),
      ),
    ).toBe(true);
    expect(wait.mock.calls).toEqual([[2000]]);
    expect(report.failedCheck).toMatchObject({
      scenario: 'default-off',
      httpStatus: 500,
    });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
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
