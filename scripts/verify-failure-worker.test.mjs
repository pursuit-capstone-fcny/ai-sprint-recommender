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

async function captureFailure(fetcher) {
  try {
    await runFailureChecks(fetcher);
  } catch (error) {
    return failureReport(error);
  }
  throw new Error('Expected verification to fail');
}

describe('safe deployed verification failure context', () => {
  it.each([404, 503])(
    'records HTTP %i without retrying or saving the body',
    async (status) => {
      const fetcher = vi.fn(
        async () => new Response('private response text', { status }),
      );
      const report = await captureFailure(fetcher);
      expect(report.failedCheck).toEqual({
        scenario: 'success',
        phase: 'http-status',
        classification: 'http-status',
        httpStatus: status,
      });
      expect(report.completedChecks).toBe(0);
      expect(fetcher).toHaveBeenCalledTimes(1);
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
    const report = await captureFailure(async () => Response.json(actual));
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
      .mockResolvedValueOnce(new Response('private failure', { status: 503 }));
    const report = await captureFailure(fetcher);
    expect(report.completedChecks).toBe(1);
    expect(report.failedCheck.scenario).toBe('default-off');
    expect(report.checks[0]).toMatchObject({
      scenario: 'success',
      passed: true,
    });
    expect(JSON.stringify(report)).not.toContain('private');
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
