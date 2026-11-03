import { afterEach, expect, it, vi } from 'vitest';
import fixture from '../../fixtures/public-catalog.json';
import { searchEvent, impressionEvent } from '../../fixtures/usage-events';
import { parsePublicCatalog } from '../contracts/publicCatalog';
import { createBufferedUsageSender } from './bufferedUsage';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const catalog = parsePublicCatalog(fixture);
const event = () => ({
  ...searchEvent,
  eventId: crypto.randomUUID(),
  time: new Date().toISOString(),
});
const endpoint = 'https://script.google.com/macros/s/fixture/exec';

it('batches a page burst and reports durable enqueue distinctly from Sheet acceptance', async () => {
  const network = vi.fn<typeof fetch>(async () =>
    Response.json({ ok: true, status: 'queued' }),
  );
  vi.stubGlobal('fetch', network);
  const sender = createBufferedUsageSender(endpoint, true);
  const outcomes = await Promise.all(
    Array.from({ length: 9 }, () => sender.send(event(), catalog)),
  );
  expect(outcomes).toEqual(Array(9).fill('queued'));
  expect(network).toHaveBeenCalledTimes(1);
  expect(network.mock.calls[0]).toMatchObject([
    '/api/usage',
    { credentials: 'omit', referrerPolicy: 'no-referrer', keepalive: true },
  ]);
});

it('routes explicit feedback directly and requires the real collector receipt', async () => {
  const network = vi.fn<typeof fetch>(async () =>
    Response.json({ ok: true, status: 'accepted' }),
  );
  vi.stubGlobal('fetch', network);
  const sender = createBufferedUsageSender(endpoint, false);
  expect(await sender.send(event(), catalog)).toBe('dropped');
  expect(
    await sender.send(
      {
        ...impressionEvent,
        schemaVersion: 2,
        type: 'feedback',
        helpful: true,
        voteRevision: 1,
      },
      catalog,
      { explicitFeedback: true },
    ),
  ).toBe('accepted');
  expect(network).toHaveBeenCalledTimes(1);
  expect(network.mock.calls[0][0]).toBe(endpoint);
});

it('bounds a stalled body and never treats a missing acknowledgment as queued', async () => {
  vi.useFakeTimers();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, text: () => new Promise(() => {}) })),
  );
  const sender = createBufferedUsageSender(endpoint, true);
  const result = sender.send(event(), catalog);
  await vi.advanceTimersByTimeAsync(20_100);
  expect(await result).toBe('dropped');
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('retries one uncertain enqueue using identical event IDs and then stops', async () => {
  const network = vi
    .fn<typeof fetch>()
    .mockRejectedValueOnce(new Error('Receipt lost'))
    .mockResolvedValue(Response.json({ ok: true, status: 'queued' }));
  const sender = createBufferedUsageSender(endpoint, true, network);
  expect(await sender.send(event(), catalog)).toBe('queued');
  expect(network).toHaveBeenCalledTimes(2);
  expect(network.mock.calls[0][1]?.body).toBe(network.mock.calls[1][1]?.body);
});
