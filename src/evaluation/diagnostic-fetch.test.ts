// @vitest-environment node
import { expect, it, vi } from 'vitest';
import { evaluationFetch, mergeDiagnostic } from './diagnostic-fetch';
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
