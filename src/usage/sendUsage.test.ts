import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../fixtures/public-catalog.json';
import { impressionEvent } from '../../fixtures/usage-events';
import { parsePublicCatalog } from '../contracts/publicCatalog';
import {
  createUsageSender,
  USAGE_QUEUE_LIMIT,
  USAGE_TIMEOUT_MS,
} from './sendUsage';

const catalog = parsePublicCatalog(fixture);
const url = 'https://script.google.com/macros/s/test/exec';
const ack = (value: unknown = { ok: true, status: 'accepted' }) =>
  Response.json(value);
const opaque = new Response();
Object.defineProperty(opaque, 'type', { value: 'opaque' });
function event() {
  return {
    schemaVersion: 1,
    eventId: crypto.randomUUID(),
    sessionId: crypto.randomUUID(),
    searchId: crypto.randomUUID(),
    time: new Date().toISOString(),
    type: 'search',
    mode: 'recommendations',
    src: 'pilot',
    catalogVersion: catalog.catalogVersion,
    recommendationEngine: 'rules',
    llmFallbackReason: 'not-requested',
    functionArea: null,
    tools: [],
    tasks: [],
    resultCount: 3,
    strongMatchCount: 0,
    fallbackType: 'none',
  };
}
beforeEach(() => vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ack())));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('usage delivery', () => {
  it('sends validated text without headers, cookies or a referrer, and waits for a real acknowledgment', async () => {
    const value = event();
    expect(await createUsageSender(url).send(value, catalog)).toBe('accepted');
    const [endpoint, options] = vi.mocked(fetch).mock.calls[0];
    expect(endpoint).toBe(url);
    expect(options).toMatchObject({
      method: 'POST',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      keepalive: true,
    });
    expect(options).not.toHaveProperty('headers');
    expect(options).not.toHaveProperty('mode', 'no-cors');
    expect(JSON.parse(String(options?.body))).toEqual(value);
  });

  it('blocks unknown fields, invalid catalog references and oversized UTF-8 before any request', async () => {
    const sender = createUsageSender(url);
    expect(
      await sender.send({ ...event(), goal: 'private fixture words' }, catalog),
    ).toBe('dropped');
    expect(
      await sender.send(
        { ...event(), tasks: ['not in the dictionary'] },
        catalog,
      ),
    ).toBe('dropped');
    expect(
      await sender.send(
        { ...event(), catalogVersion: `sha256:${'0'.repeat(64)}` },
        catalog,
      ),
    ).toBe('dropped');
    const tags = Array.from(
      { length: 50 },
      (_, i) => `${'界'.repeat(115)}${i}`,
    );
    expect(
      await sender.send(
        { ...event(), tasks: tags },
        { ...catalog, tasks: tags },
      ),
    ).toBe('dropped');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('serializes writes and retries explicit contention once with the identical event', async () => {
    let release: (value: ReturnType<typeof ack>) => void = () => {};
    vi.mocked(fetch)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = resolve;
          }),
      )
      .mockResolvedValueOnce(ack({ error: { code: 'USAGE_BUSY' } }))
      .mockResolvedValueOnce(ack({ ok: true, status: 'duplicate' }));
    const sender = createUsageSender(url);
    const first = sender.send(event(), catalog);
    const second = sender.send(event(), catalog);
    expect(fetch).toHaveBeenCalledTimes(1);
    release(ack());
    expect(await first).toBe('accepted');
    expect(await second).toBe('duplicate');
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(vi.mocked(fetch).mock.calls[1][1]?.body).toBe(
      vi.mocked(fetch).mock.calls[2][1]?.body,
    );
  });

  it.each(['USAGE_DISABLED', 'USAGE_RATE_LIMITED', 'USAGE_FULL'])(
    'stops this visit on %s',
    async (code) => {
      vi.mocked(fetch).mockResolvedValue(ack({ error: { code } }));
      const sender = createUsageSender(url);
      const results = await Promise.all([
        sender.send(event(), catalog),
        sender.send(event(), catalog),
      ]);
      expect(results).toEqual(['dropped', 'dropped']);
      expect(await sender.send(event(), catalog)).toBe('dropped');
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['USAGE_DISABLED', 'USAGE_FULL'])(
    'explicit feedback cannot resume a collector stopped by %s',
    async (code) => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(ack({ error: { code } }))
        .mockResolvedValue(ack());
      const sender = createUsageSender(url);
      await sender.send(event(), catalog);
      const feedback = {
        ...impressionEvent,
        schemaVersion: 2,
        type: 'feedback',
        helpful: true,
        voteRevision: 1,
      };
      expect(
        await sender.send(feedback, catalog, { explicitFeedback: true }),
      ).toBe('dropped');
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );
  it('rate-limit recovery rejects automatic traffic and invalid feedback even when flagged explicit', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(ack({ error: { code: 'USAGE_RATE_LIMITED' } }))
      .mockResolvedValue(ack());
    const sender = createUsageSender(url);
    await sender.send(event(), catalog);
    expect(
      await sender.send(event(), catalog, { explicitFeedback: true }),
    ).toBe('dropped');
    const feedback = {
      ...impressionEvent,
      schemaVersion: 2,
      type: 'feedback',
      helpful: true,
      voteRevision: 1,
    };
    expect(await sender.send(feedback, catalog)).toBe('dropped');
    expect(
      await sender.send({ ...feedback, goal: 'private' }, catalog, {
        explicitFeedback: true,
      }),
    ).toBe('dropped');
    expect(
      await sender.send({ ...feedback, youtubeId: 'unknown-id1' }, catalog, {
        explicitFeedback: true,
      }),
    ).toBe('dropped');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(
      await sender.send(feedback, catalog, { explicitFeedback: true }),
    ).toBe('accepted');
    expect(await sender.send(event(), catalog)).toBe('dropped');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it.each([
    opaque,
    new Response(null, { status: 503 }),
    ack({ ok: true }),
    ack({ error: { code: 'USAGE_INVALID_EVENT' } }),
  ])(
    'never treats an unreadable or invalid response as delivered',
    async (response) => {
      vi.mocked(fetch).mockResolvedValue(response);
      expect(await createUsageSender(url).send(event(), catalog)).toBe(
        'dropped',
      );
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );

  it('catches offline failures without retrying', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('offline'));
    expect(await createUsageSender(url).send(event(), catalog)).toBe('dropped');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('bounds even stalled response-body reads and aborts the request', async () => {
    vi.useFakeTimers();
    const response = ack();
    vi.spyOn(response, 'json').mockImplementation(() => new Promise(() => {}));
    vi.mocked(fetch).mockResolvedValue(response);
    const pending = createUsageSender(url).send(event(), catalog);
    await vi.advanceTimersByTimeAsync(USAGE_TIMEOUT_MS);
    expect(await pending).toBe('dropped');
    expect(vi.mocked(fetch).mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('bounds queued events and drops stale ones without sending', async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockImplementation(() => new Promise(() => {}));
    const sender = createUsageSender(url);
    const pending = Array.from({ length: USAGE_QUEUE_LIMIT + 1 }, () =>
      sender.send(event(), catalog),
    );
    expect(await sender.send(event(), catalog)).toBe('dropped');
    await vi.advanceTimersByTimeAsync(70_000);
    expect(await Promise.all(pending)).toEqual(
      Array(USAGE_QUEUE_LIMIT + 1).fill('dropped'),
    );
    expect(fetch).toHaveBeenCalledTimes(6);
  });
});
