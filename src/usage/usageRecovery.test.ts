import { afterEach, expect, it, vi } from 'vitest';
import fixture from '../../fixtures/public-catalog.json';
import { impressionEvent, searchEvent } from '../../fixtures/usage-events';
import { parsePublicCatalog } from '../contracts/publicCatalog';
import {
  receiveUsage,
  type UsagePorts,
  type UsageRecord,
} from '../../apps-script/usage';
import { createUsageSender } from './sendUsage';

afterEach(() => vi.useRealTimers());

it.each(['catalog unavailable', 'acknowledgment lost'])(
  'recovers a display burst after %s, preserving IDs and exactly one row per event',
  async (failure) => {
    vi.useFakeTimers();
    vi.setSystemTime(searchEvent.time);
    const catalog = parsePublicCatalog(fixture);
    const records: UsageRecord[] = [];
    let fail = true;
    const ports: UsagePorts = {
      enabled: true,
      policy: () => ({
        retentionDays: 1,
        maxPerMinute: 20,
        maxPerDay: 100,
        maxRows: 1000,
        recommendationVersions: [],
      }),
      now: () => new Date(),
      lock: { tryLock: () => true, releaseLock: () => {} },
      catalog: () => {
        if (fail && failure === 'catalog unavailable') {
          fail = false;
          throw new Error('Transient catalog service failure');
        }
        return catalog;
      },
      records: () => records,
      append: (event, receivedAt) =>
        records.push({ eventId: event.eventId, receivedAt }),
    };
    const bodies: string[] = [];
    const sender = createUsageSender(
      'https://script.google.com/macros/s/test/exec',
      {
        fetcher: async (_url, init) => {
          const body = String(init?.body);
          bodies.push(body);
          const receipt = receiveUsage(
            { type: 'text/plain', contents: body },
            ports,
          );
          if (fail && failure === 'acknowledgment lost') {
            fail = false;
            throw new TypeError('Failed to fetch');
          }
          return new Response(receipt);
        },
      },
    );
    const events = [searchEvent, impressionEvent];
    expect(
      await Promise.all(events.map((event) => sender.send(event, catalog))),
    ).toEqual([
      failure === 'acknowledgment lost' ? 'duplicate' : 'accepted',
      'accepted',
    ]);
    expect(bodies).toHaveLength(3);
    expect(bodies[0]).toBe(bodies[1]);
    expect(records.map((row) => row.eventId)).toEqual(
      events.map((event) => event.eventId),
    );
  },
);
