import {
  ContributionPolicySchema,
  ContributionSchema,
  type Contribution,
  type ContributionPolicy,
} from '../src/contracts/contribution';
import { usageBodyBytes, type UsageRequest } from './usage';

export const MAX_CONTRIBUTION_ROWS = 5000;
export const contributionHeaders = [
  'requestId',
  'receivedAt',
  'status',
  'kind',
  'topic',
  'email',
  'policyVersion',
];
export type ContributionRecord = { requestId: string; receivedAt: string };
export type ContributionPorts = {
  enabled: boolean;
  policy: () => ContributionPolicy;
  now: () => Date;
  lock: { tryLock: (ms: number) => boolean; releaseLock: () => void };
  records: () => ContributionRecord[];
  append: (request: Contribution, receivedAt: string) => void;
};
const error = (code: string) => JSON.stringify({ error: { code } });
export function isContributionRequest(request?: UsageRequest): boolean {
  try {
    return (
      typeof request?.contents === 'string' &&
      request.contents.length <= 8192 &&
      JSON.parse(request.contents)?.type === 'contribution'
    );
  } catch {
    return false;
  }
}
export function receiveContribution(
  request: UsageRequest | undefined,
  ports: ContributionPorts,
): string {
  if (!ports.enabled) return error('REQUESTS_DISABLED');
  if (
    request?.type?.split(';')[0].trim().toLowerCase() !== 'text/plain' ||
    typeof request.contents !== 'string' ||
    usageBodyBytes(request.contents) > 8192
  )
    return error('REQUESTS_INVALID');
  const parsed = (() => {
    try {
      return ContributionSchema.safeParse(JSON.parse(request.contents));
    } catch {
      return null;
    }
  })();
  if (!parsed?.success) return error('REQUESTS_INVALID');
  const entry = parsed.data;
  let locked = false;
  try {
    const policy = ContributionPolicySchema.parse(ports.policy());
    if (
      entry.policyVersion !== policy.version ||
      (entry.kind === 'demo' && !policy.demoOffers)
    )
      return error('REQUESTS_POLICY_CHANGED');
    locked = ports.lock.tryLock(1500);
    if (!locked) return error('REQUESTS_BUSY');
    const now = ports.now();
    const age = now.getTime() - Date.parse(entry.time);
    if (age >= 3_600_000 || age < -300_000) return error('REQUESTS_EXPIRED');
    const records = ports.records();
    if (records.some((r) => r.requestId === entry.requestId))
      return JSON.stringify({ ok: true, status: 'duplicate' });
    if (
      records.length >= MAX_CONTRIBUTION_ROWS ||
      records.filter((r) => now.getTime() - Date.parse(r.receivedAt) < 60_000)
        .length >= 10 ||
      records.filter(
        (r) => r.receivedAt.slice(0, 10) === now.toISOString().slice(0, 10),
      ).length >= 200
    )
      return error('REQUESTS_FULL');
    ports.append(entry, now.toISOString());
    return JSON.stringify({ ok: true, status: 'accepted' });
  } catch {
    return error('REQUESTS_UNAVAILABLE');
  } finally {
    if (locked) ports.lock.releaseLock();
  }
}
