// @vitest-environment node
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import type { Socket } from 'node:net';
import { expect, it, vi } from 'vitest';
import { evaluationFetch } from './diagnostic-fetch';

const key = 'a'.repeat(64);
const endpoint = 'https://test.example/api/recommendations';
it('retains a generated correlation ID and bounded network details without retrying', async () => {
  const fetcher = vi.fn<typeof fetch>().mockRejectedValue(
    new TypeError('PRIVATE goal and Bearer SECRET', {
      cause: { code: 'ECONNRESET', secret: 'PRIVATE' },
    }),
  );
  const diagnostics = vi.fn();
  const failures = vi.fn();
  const wrapped = evaluationFetch(
    endpoint,
    key,
    diagnostics,
    fetcher,
    failures,
  );
  const failure = await wrapped(endpoint, { method: 'POST' }).catch(
    (error) => error,
  );
  const requestId = new Headers(fetcher.mock.calls[0][1]?.headers).get(
    'x-evaluation-request-id',
  );
  expect(requestId).toMatch(/^[a-f0-9-]{36}$/);
  expect(failure).toMatchObject({ requestId });
  expect(failures).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      requestId,
      phase: 'transport',
      kind: 'network',
      code: 'ECONNRESET',
      status: null,
    }),
  );
  expect(JSON.stringify(failures.mock.calls)).not.toMatch(
    /PRIVATE|SECRET|Bearer/,
  );
  expect(diagnostics).not.toHaveBeenCalled();
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('retains response status and correlation when the diagnostic header is missing', async () => {
  const failures = vi.fn();
  const wrapped = evaluationFetch(
    endpoint,
    key,
    vi.fn(),
    async () => new Response('private body', { status: 502 }),
    failures,
  );
  const failure = await wrapped(endpoint, { method: 'POST' }).catch(
    (error) => error,
  );
  expect(failure.requestId).toMatch(/^[a-f0-9-]{36}$/);
  expect(failures).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      requestId: failure.requestId,
      phase: 'diagnostic',
      kind: 'missing-header',
      status: 502,
    }),
  );
  expect(JSON.stringify(failures.mock.calls)).not.toContain('private body');
});
it('uses fresh connections when a server resets a reused connection, without replaying POSTs', async () => {
  const sockets = new Set<Socket>();
  let requests = 0;
  const server = createServer((request, response) => {
    requests++;
    if (sockets.has(request.socket)) {
      request.socket.destroy();
      return;
    }
    sockets.add(request.socket);
    const requestId =
      request.headers['x-evaluation-request-id'] ?? randomUUID();
    response.writeHead(200, {
      'content-type': 'application/json',
      'x-recommendation-request-id': requestId,
      'x-evaluation-diagnostic': JSON.stringify({
        requestId,
        environment: 'test',
        outcome: 'disabled',
        latencyMs: 0,
        accountingFinal: true,
        costMicrodollars: 0,
      }),
    });
    response.end('{}');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    if (!address || typeof address === 'string')
      throw new Error('Missing local address');
    const local = `http://127.0.0.1:${address.port}/api/recommendations`;
    const wrapped = evaluationFetch(local, key, () => {});
    for (let i = 0; i < 3; i++) {
      await (
        await wrapped(local, {
          method: 'POST',
          body: '{}',
          signal: AbortSignal.timeout(2000),
        })
      ).text();
      await delay(20);
    }
    expect(requests).toBe(3);
    expect(sockets.size).toBe(3);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

it('correlates a lost response with the server record without inventing usage or retrying', async () => {
  const { requestRecommendation } = await import('./live');
  const { recommend } = await import('../../server/recommendations');
  const { environment, catalog } = await import('../../server/test-helpers');
  const records = vi.fn();
  const fetcher = vi.fn<typeof fetch>(async (input, init) => {
    await recommend(
      new Request(input, init),
      {
        ...environment,
        LLM_ENABLED: 'false',
        LLM_ENVIRONMENT: 'test',
        LLM_DIAGNOSTICS_ENABLED: 'true',
        LLM_RATE_KEY: key,
      },
      { diagnostic: records },
    );
    throw new TypeError('Response lost', { cause: { code: 'UND_ERR_SOCKET' } });
  });
  const captured = vi.fn();
  const wrapped = evaluationFetch(endpoint, key, captured, fetcher);
  const result = await requestRecommendation(
    endpoint,
    {
      functionArea: 'Operations',
      goal: 'Organize public data',
      tools: [],
      catalogVersion: catalog.catalogVersion,
    },
    wrapped,
  );
  expect(result.response).toEqual({
    outcome: 'fallback',
    reason: 'provider-error',
  });
  expect(result.requestId).toBe(records.mock.calls[0][0].requestId);
  expect(result.requestId).not.toBeNull();
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(captured).not.toHaveBeenCalled();
});
