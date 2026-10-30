import { AcceptedUsageSchema, type AcceptedUsage } from '../analytics/report';
import type { FeedbackEvent } from './vote';

// Reduce across the full retained log before any source/context filtering.
// No session/search/event IDs leave the report.
export function buildFeedbackReport(
  records: AcceptedUsage[],
  includeTeam = false,
) {
  if (records.length > 10_000) throw new Error('Feedback capacity reached');
  const events = new Map<string, FeedbackEvent>();
  const latest = new Map<string, FeedbackEvent>();
  const revisions = new Map<string, string>();
  for (const raw of records) {
    const { event } = AcceptedUsageSchema.parse(raw);
    if (event.type !== 'feedback') continue;
    const prior = events.get(event.eventId);
    if (prior && JSON.stringify(prior) !== JSON.stringify(event))
      throw new Error('Conflicting feedback event');
    events.set(event.eventId, event);
    const key = JSON.stringify([event.sessionId, event.youtubeId]);
    const revisionKey = JSON.stringify([key, event.voteRevision]);
    const priorId = revisions.get(revisionKey);
    if (priorId && priorId !== event.eventId)
      throw new Error('Conflicting vote revision');
    revisions.set(revisionKey, event.eventId);
    const previous = latest.get(key);
    if (!previous || event.voteRevision > previous.voteRevision)
      latest.set(key, event);
  }
  const rows = new Map<
    string,
    {
      youtubeId: string;
      helpful: number;
      notHelpful: number;
      responses: number;
      helpfulRate: number;
    }
  >();
  for (const event of latest.values()) {
    if (!includeTeam && event.src === 'team') continue;
    const row = rows.get(event.youtubeId) ?? {
      youtubeId: event.youtubeId,
      helpful: 0,
      notHelpful: 0,
      responses: 0,
      helpfulRate: 0,
    };
    if (event.helpful) row.helpful++;
    else row.notHelpful++;
    row.responses++;
    row.helpfulRate = row.helpful / row.responses;
    rows.set(event.youtubeId, row);
  }
  return [...rows.values()].sort((a, b) =>
    a.youtubeId.localeCompare(b.youtubeId),
  );
}
