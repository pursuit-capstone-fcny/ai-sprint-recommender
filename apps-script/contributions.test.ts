import { describe, expect, it, vi } from 'vitest';
import {
  receiveContribution,
  type ContributionPorts,
  type ContributionRecord,
} from './contributions';

const now = new Date('2026-10-30T12:00:00Z');
const entry = {
  schemaVersion: 1,
  type: 'contribution',
  requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  time: now.toISOString(),
  policyVersion: 'fictional-v1',
  kind: 'topic',
  topic: 'Fictional missing topic',
};
function setup() {
  const records: ContributionRecord[] = [];
  const policy = {
    version: 'fictional-v1',
    topicPrompt: 'Fictional prompt',
    demoInvitation: 'Fictional invitation',
    purpose: 'Fictional purpose',
    access: 'Approved staff only',
    owner: 'Fictional owner',
    retentionDays: 7,
    demoOffers: false,
  };
  const ports: ContributionPorts = {
    enabled: true,
    now: () => now,
    policy: vi.fn(() => policy),
    lock: { tryLock: vi.fn(() => true), releaseLock: vi.fn() },
    records: vi.fn(() => records),
    append: vi.fn((value, receivedAt) => {
      records.push({ requestId: value.requestId, receivedAt });
    }),
  };
  const send = (change = {}) =>
    JSON.parse(
      receiveContribution(
        {
          type: 'text/plain',
          contents: JSON.stringify({ ...entry, ...change }),
        },
        ports,
      ),
    );
  return { ports, records, policy, send };
}
describe('restricted request ingestion', () => {
  it('AC-26.2/6: appends once, acknowledges retry and never returns private fields', () => {
    const { send, records, ports } = setup();
    expect(send()).toEqual({ ok: true, status: 'accepted' });
    expect(send()).toEqual({ ok: true, status: 'duplicate' });
    expect(records).toHaveLength(1);
    expect(ports.append).toHaveBeenCalledTimes(1);
    expect(ports.lock.releaseLock).toHaveBeenCalledTimes(2);
  });
  it('requires enablement, matching policy and approved consented email collection', () => {
    const { ports, policy, send } = setup();
    ports.enabled = false;
    expect(send().error.code).toBe('REQUESTS_DISABLED');
    expect(ports.policy).not.toHaveBeenCalled();
    ports.enabled = true;
    expect(send({ policyVersion: 'old' }).error.code).toBe(
      'REQUESTS_POLICY_CHANGED',
    );
    expect(
      send({ kind: 'demo', email: 'fictional@example.org', consent: true })
        .error.code,
    ).toBe('REQUESTS_POLICY_CHANGED');
    policy.demoOffers = true;
    expect(
      send({ kind: 'demo', email: 'fictional@example.org', consent: false })
        .error.code,
    ).toBe('REQUESTS_INVALID');
    expect(
      send({ kind: 'demo', email: 'fictional@example.org', consent: true }).ok,
    ).toBe(true);
  });
  it('rejects contact fields on topics, usage IDs, oversized input, expired requests and non-simple POSTs', () => {
    const { ports, send } = setup();
    for (const change of [
      { email: 'fictional@example.org' },
      { sessionId: crypto.randomUUID() },
      { topic: 'x'.repeat(1001) },
    ])
      expect(send(change).error.code).toBe('REQUESTS_INVALID');
    expect(send({ time: '2026-10-30T10:00:00Z' }).error.code).toBe(
      'REQUESTS_EXPIRED',
    );
    expect(
      JSON.parse(
        receiveContribution(
          { type: 'application/json', contents: JSON.stringify(entry) },
          ports,
        ),
      ).error.code,
    ).toBe('REQUESTS_INVALID');
    expect(ports.append).not.toHaveBeenCalled();
  });
  it('bounds spam and reports lock or storage failures without exception contents', () => {
    const { ports, records, send } = setup();
    for (let i = 0; i < 10; i++)
      records.push({
        requestId: crypto.randomUUID(),
        receivedAt: now.toISOString(),
      });
    expect(send().error.code).toBe('REQUESTS_FULL');
    vi.mocked(ports.lock.tryLock).mockReturnValue(false);
    expect(send().error.code).toBe('REQUESTS_BUSY');
    vi.mocked(ports.lock.tryLock).mockReturnValue(true);
    records.length = 0;
    ports.append = () => {
      throw new Error('private fixture contact');
    };
    expect(send()).toEqual({ error: { code: 'REQUESTS_UNAVAILABLE' } });
  });
});
