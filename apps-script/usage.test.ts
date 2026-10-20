import { describe, expect, it, vi } from 'vitest';
import fixture from '../fixtures/public-catalog.json';
import { parsePublicCatalog } from '../src/contracts/publicCatalog';
import { impressionEvent, searchEvent } from '../fixtures/usage-events';
import {
  expiredUsageRows,
  MAX_USAGE_BYTES,
  receiveUsage,
  usageBodyBytes,
  type UsagePolicy,
  type UsagePorts,
  type UsageRecord,
} from './usage';

const now = new Date(searchEvent.time);
const request = (value: unknown = searchEvent) => ({
  type: 'text/plain; charset=UTF-8',
  contents: JSON.stringify(value),
});
function setup() {
  const records: UsageRecord[] = [];
  const operations: string[] = [];
  let locked = false;
  const policy: UsagePolicy = {
    retentionDays: 30,
    maxPerMinute: 2,
    maxPerDay: 3,
    maxRows: 4,
    recommendationVersions: [],
  };
  const ports: UsagePorts = {
    enabled: true,
    policy: () => policy,
    now: () => now,
    lock: {
      tryLock: vi.fn(() => {
        if (locked) return false;
        operations.push('lock');
        locked = true;
        return true;
      }),
      releaseLock: vi.fn(() => {
        operations.push('unlock');
        locked = false;
      }),
    },
    catalog: vi.fn(() => parsePublicCatalog(fixture)),
    records: vi.fn(() => {
      expect(locked).toBe(true);
      return [...records];
    }),
    append: vi.fn((event, receivedAt) => {
      expect(locked).toBe(true);
      operations.push('append');
      records.push({ eventId: event.eventId, receivedAt });
    }),
  };
  const send = (value: unknown = searchEvent) =>
    JSON.parse(receiveUsage(request(value), ports));
  return { ports, records, operations, policy, send };
}

describe('usage ingestion', () => {
  it('AC-16.3: serializes durable deduplication and append, adding server time', () => {
    const { ports, send, records, operations } = setup();
    expect(send()).toEqual({ ok: true, status: 'accepted' });
    expect(
      send({ ...searchEvent, eventId: searchEvent.eventId.toUpperCase() }),
    ).toEqual({ ok: true, status: 'duplicate' });
    expect(ports.append).toHaveBeenCalledTimes(1);
    expect(records).toEqual([
      { eventId: searchEvent.eventId, receivedAt: now.toISOString() },
    ]);
    expect(operations).toEqual(['lock', 'append', 'unlock', 'lock', 'unlock']);
  });

  it('AC-16.3: a competing request cannot append while the first holds the lock', () => {
    const { ports, records, send } = setup();
    const append = ports.append;
    ports.append = (event, receivedAt) => {
      expect(send()).toEqual({ error: { code: 'USAGE_BUSY' } });
      append(event, receivedAt);
    };
    expect(send()).toEqual({ ok: true, status: 'accepted' });
    expect(send()).toEqual({ ok: true, status: 'duplicate' });
    expect(records).toHaveLength(1);
    expect(ports.lock.releaseLock).toHaveBeenCalledTimes(2);
  });

  it('deduplicates a retry after append succeeded but the acknowledgment failed', () => {
    const { ports, records, send } = setup();
    const append = ports.append;
    ports.append = (event, receivedAt) => {
      append(event, receivedAt);
      throw new Error('simulated flush failure');
    };
    expect(send()).toEqual({ error: { code: 'USAGE_UNAVAILABLE' } });
    expect(send()).toEqual({ ok: true, status: 'duplicate' });
    expect(records).toHaveLength(1);
  });

  it('AC-16.8: disabled means no policy, lock, catalog or log access', () => {
    const { ports, send } = setup();
    ports.enabled = false;
    ports.policy = () => {
      throw new Error('must not read policy');
    };
    expect(send()).toEqual({ error: { code: 'USAGE_DISABLED' } });
    expect(ports.lock.tryLock).not.toHaveBeenCalled();
    expect(ports.catalog).not.toHaveBeenCalled();
    expect(ports.records).not.toHaveBeenCalled();
    expect(ports.append).not.toHaveBeenCalled();
  });

  it.each([
    undefined,
    { type: 'application/json', contents: '{}' },
    { type: 'text/plain', contents: '{' },
    { type: 'text/plain' },
    request({ ...searchEvent, goal: 'synthetic private input' }),
    request({ ...searchEvent, target: 'embed' }),
  ])('rejects invalid requests without acquiring a lock %#', (post) => {
    const { ports } = setup();
    expect(JSON.parse(receiveUsage(post, ports))).toHaveProperty('error');
    expect(ports.lock.tryLock).not.toHaveBeenCalled();
  });

  it('AC-16.3: enforces 16 KiB of UTF-8, including exact-size and Unicode bodies', () => {
    const { ports } = setup();
    const unpadded = JSON.stringify({ ...searchEvent, src: '' });
    const contents = JSON.stringify({
      ...searchEvent,
      src: 'x'.repeat(MAX_USAGE_BYTES - usageBodyBytes(unpadded)),
    });
    expect(usageBodyBytes(contents)).toBe(MAX_USAGE_BYTES);
    expect(
      JSON.parse(receiveUsage({ type: 'text/plain', contents }, ports)),
    ).toEqual({ ok: true, status: 'accepted' });
    expect(
      JSON.parse(
        receiveUsage({ type: 'text/plain', contents: `${contents} ` }, ports),
      ),
    ).toEqual({ error: { code: 'USAGE_INVALID_SIZE' } });
    const unicode = request({ ...searchEvent, src: '😀'.repeat(5000) });
    expect(unicode.contents.length).toBeLessThan(MAX_USAGE_BYTES);
    expect(JSON.parse(receiveUsage(unicode, ports))).toEqual({
      error: { code: 'USAGE_INVALID_SIZE' },
    });
    expect(usageBodyBytes('Aé中😀\ud800')).toBe(13);
  });

  it.each([
    { retentionDays: NaN },
    { retentionDays: 0 },
    { retentionDays: 366 },
    { maxPerMinute: 0 },
    { maxPerMinute: 4 },
    { maxPerDay: 5 },
    { maxRows: 10_001 },
    { recommendationVersions: [{ modelVersion: 'fixture-v1' }] },
  ])('AC-16.8: missing or unsafe policy fails closed %#', (change) => {
    const { ports, policy, send } = setup();
    Object.assign(policy, change);
    expect(send()).toEqual({ error: { code: 'USAGE_INVALID_CONFIG' } });
    expect(ports.records).not.toHaveBeenCalled();
    expect(ports.append).not.toHaveBeenCalled();
  });

  it.each(['2026-10-20T11:00:00Z', '2026-10-20T12:05:01Z'])(
    'rejects expired or future event time %s',
    (time) => {
      const { send, ports } = setup();
      expect(send({ ...searchEvent, time })).toEqual({
        error: { code: 'USAGE_INVALID_TIME' },
      });
      expect(ports.append).not.toHaveBeenCalled();
      expect(ports.lock.releaseLock).toHaveBeenCalledOnce();
    },
  );

  it('AC-16.6: checks catalog tags, IDs, and version on the server', () => {
    const { send, ports } = setup();
    for (const value of [
      { ...searchEvent, tasks: ['unapproved tag'] },
      { ...impressionEvent, youtubeId: 'xxxxxxxxxxx' },
      { ...searchEvent, catalogVersion: `sha256:${'0'.repeat(64)}` },
    ]) {
      expect(send(value)).toEqual({
        error: { code: 'USAGE_INVALID_REFERENCE' },
      });
    }
    expect(ports.append).not.toHaveBeenCalled();
  });

  it('rejects arbitrary model/prompt text unless the pair is configured', () => {
    const { send, policy } = setup();
    const event = {
      ...searchEvent,
      recommendationEngine: 'llm',
      llmFallbackReason: 'none',
      modelVersion: 'fixture-model-v1',
      promptVersion: 'v1',
    };
    expect(send(event)).toEqual({ error: { code: 'USAGE_INVALID_EVENT' } });
    policy.recommendationVersions.push({
      modelVersion: 'fixture-model-v1',
      promptVersion: 'v1',
    });
    expect(send(event)).toEqual({ ok: true, status: 'accepted' });
  });

  it('AC-16.8: caps the rolling minute and still acknowledges duplicates', () => {
    const { send, records } = setup();
    expect(send()).toHaveProperty('status', 'accepted');
    expect(send(impressionEvent)).toHaveProperty('status', 'accepted');
    expect(send({ ...impressionEvent, eventId: searchEvent.searchId })).toEqual(
      { error: { code: 'USAGE_RATE_LIMITED' } },
    );
    expect(send()).toHaveProperty('status', 'duplicate');
    expect(records).toHaveLength(2);
  });

  it('AC-16.8: caps UTC-day writes using server time, not client time', () => {
    const { send, records } = setup();
    for (let index = 0; index < 3; index++) {
      records.push({
        eventId: `prior-${index}`,
        receivedAt: '2026-10-20T08:00:00Z',
      });
    }
    expect(send()).toEqual({ error: { code: 'USAGE_RATE_LIMITED' } });
    records[0].receivedAt = '2026-10-19T23:59:59Z';
    expect(send()).toHaveProperty('status', 'accepted');
  });

  it('AC-16.8: stops at the row cap even when old rows need a purge', () => {
    const { send, records } = setup();
    for (let index = 0; index < 4; index++) {
      records.push({
        eventId: `prior-${index}`,
        receivedAt: '2026-09-01T00:00:00Z',
      });
    }
    expect(send()).toEqual({ error: { code: 'USAGE_FULL' } });
  });

  it('service failures release the lock without echoing data', () => {
    const { ports, send } = setup();
    ports.catalog = () => {
      throw new Error('synthetic private cell');
    };
    expect(send()).toEqual({ error: { code: 'USAGE_UNAVAILABLE' } });
    expect(ports.lock.releaseLock).toHaveBeenCalledOnce();
    expect(ports.append).not.toHaveBeenCalled();
  });

  it('AC-16.8: retention uses server receipt time and preserves the header', () => {
    expect(
      expiredUsageRows(
        [
          { eventId: 'a', receivedAt: '2026-09-20T12:00:00Z' },
          { eventId: 'b', receivedAt: '2026-09-20T12:00:00.001Z' },
          { eventId: 'c', receivedAt: '2026-09-19T00:00:00Z' },
        ],
        now,
        30,
      ),
    ).toEqual([4, 2]);
  });
});
