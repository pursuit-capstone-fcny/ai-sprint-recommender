// @vitest-environment node
import { expect, it, vi } from 'vitest';
import {
  fetchReadinessProbe,
  evaluationFetch,
  mergeDiagnostic,
  assertProviderAcceptedRequest,
} from './diagnostic-fetch';
import type { EvaluationDiagnostic } from '../contracts/evaluationDiagnostic';

const endpoint = 'https://test.example/api/recommendations';
const key = 'a'.repeat(64);
const row: EvaluationDiagnostic = {
  requestId: 'f976a1c4-1bd9-4ca7-8401-deb88bc46eb1',
  environment: 'test',
  outcome: 'success',
  latencyMs: 200,
  accountingFinal: true,
  inputTokens: 100,
  outputTokens: 20,
  costMicrodollars: 20,
};
const response = (value: unknown = row, id = row.requestId) =>
  Response.json(
    {},
    {
      headers: {
        'x-evaluation-diagnostic': JSON.stringify(value),
        'x-recommendation-request-id': id,
      },
    },
  );
it('captures each response without console delivery and scopes authentication to the endpoint', async () => {
  const fetcher = vi.fn<typeof fetch>(async () => response());
  const save = vi.fn();
  const wrapped = evaluationFetch(endpoint, key, save, fetcher);
  await wrapped(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
  });
  expect(save).toHaveBeenCalledExactlyOnceWith(row);
  expect(
    new Headers(fetcher.mock.calls[0][1]?.headers).get('Authorization'),
  ).toBe(`Bearer ${key}`);
  expect(fetcher.mock.calls[0][1]?.redirect).toBe('error');
  await wrapped('https://sheet.example/catalog', { method: 'GET' });
  await wrapped(endpoint + '?redirect=1', { method: 'POST' });
  for (const call of fetcher.mock.calls.slice(1))
    expect(new Headers(call[1]?.headers).has('Authorization')).toBe(false);
});
it.each([
  { ...row, goal: 'PRIVATE' },
  { ...row, environment: 'production' },
  { ...row, requestId: 'invalid' },
])('rejects invalid or private header data', async (value) => {
  const save = vi.fn();
  const wrapped = evaluationFetch(endpoint, key, save, async () =>
    response(value),
  );
  await expect(wrapped(endpoint, { method: 'POST' })).rejects.toThrow();
  expect(save).not.toHaveBeenCalled();
});
it('never replaces settled usage with an earlier response snapshot', () => {
  const records = new Map<string, EvaluationDiagnostic>();
  mergeDiagnostic(records, row);
  mergeDiagnostic(records, {
    ...row,
    accountingFinal: false,
    costMicrodollars: undefined,
  });
  expect(records.get(row.requestId)).toEqual(row);
  mergeDiagnostic(records, {
    ...row,
    accountingFinal: true,
    costMicrodollars: undefined,
  });
  expect(records.get(row.requestId)).toEqual(row);
});
it('rejects headers for another request and missing diagnostics', async () => {
  for (const result of [
    response(row, 'a different request'),
    Response.json({}),
  ]) {
    const wrapped = evaluationFetch(
      endpoint,
      key,
      () => {},
      async () => result,
    );
    await expect(wrapped(endpoint, { method: 'POST' })).rejects.toThrow();
  }
});

it.each([400, 401, 403, 404, 422])(
  'stops a paid sequence on a permanent provider rejection %s',
  (providerHttpStatus) => {
    expect(() =>
      assertProviderAcceptedRequest({
        ...row,
        outcome: 'provider-error',
        providerHttpStatus,
      }),
    ).toThrow('stop before further paid calls');
  },
);
it('keeps transient failures on the existing no-retry cooldown path', () => {
  for (const providerHttpStatus of [429, 500, 503])
    expect(() =>
      assertProviderAcceptedRequest({ ...row, providerHttpStatus }),
    ).not.toThrow();
});

it('stops on a structural response failure instead of paying for more malformed cases', () => {
  expect(() =>
    assertProviderAcceptedRequest({
      ...row,
      outcome: 'invalid-response',
      validationFailure: 'schema',
    }),
  ).toThrow('stop before further paid calls');
});

it('allows only an unpaid blank readiness request to wait for a missing header', async () => {
  const failures = vi.fn();
  const raw = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      Response.json({ outcome: 'fallback', reason: 'disabled' }),
    )
    .mockResolvedValueOnce(
      response({
        ...row,
        outcome: 'not-requested',
        providerDispatched: false,
        inputTokens: 0,
        outputTokens: 0,
        costMicrodollars: 0,
      }),
    );
  const wrapped = evaluationFetch(endpoint, key, () => {}, raw, failures);
  const version = `sha256:${'a'.repeat(64)}`;
  expect(
    await fetchReadinessProbe(
      endpoint,
      version,
      wrapped,
      new AbortController().signal,
    ),
  ).toBeNull();
  expect(
    await fetchReadinessProbe(
      endpoint,
      version,
      wrapped,
      new AbortController().signal,
    ),
  ).toBeInstanceOf(Response);
  expect(raw).toHaveBeenCalledTimes(2);
  for (const [, init] of raw.mock.calls)
    expect(JSON.parse(String(init?.body))).toEqual({
      functionArea: null,
      goal: '',
      tools: [],
      catalogVersion: version,
    });
  expect(failures).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ kind: 'missing-header', status: 200 }),
  );
});

it.each(['invalid-header', 'server-error', 'network'])(
  'does not retry or hide readiness %s',
  async (kind) => {
    const raw = vi.fn<typeof fetch>(async () => {
      if (kind === 'network') throw new Error('private details');
      return kind === 'server-error'
        ? new Response(null, { status: 500 })
        : response({ invalid: true });
    });
    await expect(
      fetchReadinessProbe(
        endpoint,
        `sha256:${'a'.repeat(64)}`,
        evaluationFetch(endpoint, key, () => {}, raw),
        new AbortController().signal,
      ),
    ).rejects.toThrow();
    expect(raw).toHaveBeenCalledTimes(1);
  },
);
