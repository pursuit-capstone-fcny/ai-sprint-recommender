import { describe, expect, it, vi } from 'vitest';
import { topicCatalog } from '../../fixtures/topic-catalog';
import { createTopicUsage } from './topicUsage';
import { searchTopics } from '../engine/topicSearch';
import {
  hasUsageCatalogReferences,
  UsageEventSchema,
} from '../contracts/usageEvent';

describe('topic usage', () => {
  it('records full result counts, unique contexts and full-list ranks without raw wording or repeated-render duplicates', async () => {
    const query = {
      topic: 'presentation',
      functionAreas: ['Fundraising', 'Operations'],
      tools: [],
    };
    const results = searchTopics(topicCatalog, query);
    const send = vi.fn().mockResolvedValue('accepted');
    const session = {
      sessionId: crypto.randomUUID(),
      src: 'team' as const,
      sender: { send },
    };
    const usage = createTopicUsage(session, topicCatalog, query, results);
    usage.display();
    usage.display();
    usage.click(13, 'youtube');
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(16));
    const events = send.mock.calls.map(([value]) =>
      UsageEventSchema.parse(value),
    );
    expect(events[0]).toMatchObject({
      type: 'search',
      mode: 'topic',
      src: 'team',
      resultCount: 14,
      functionArea: null,
      functionAreas: ['Fundraising', 'Operations'],
      fallbackType: 'none',
    });
    expect(events[15]).toMatchObject({
      type: 'click',
      rank: 14,
      target: 'youtube',
      youtubeId: results[13].item.youtubeId,
    });
    expect(
      events.every((event) => hasUsageCatalogReferences(event, topicCatalog)),
    ).toBe(true);
    const second = createTopicUsage(
      session,
      topicCatalog,
      { ...query, topic: 'private arbitrary wording' },
      [],
    );
    second.display();
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(17));
    expect(send.mock.calls[16][0].searchId).not.toBe(events[0].searchId);
    expect(JSON.stringify(send.mock.calls)).not.toContain(
      'private arbitrary wording',
    );
    expect(send.mock.calls[16][0].tasks).toEqual([]);
  });
  it('validates plural function filters and retains legacy search compatibility', () => {
    const event = {
      schemaVersion: 1,
      eventId: crypto.randomUUID(),
      sessionId: crypto.randomUUID(),
      searchId: crypto.randomUUID(),
      time: new Date().toISOString(),
      catalogVersion: topicCatalog.catalogVersion,
      type: 'search',
      mode: 'topic',
      src: 'team',
      functionArea: null,
      functionAreas: ['Fundraising', 'Operations'],
      tools: [],
      tasks: [],
      resultCount: 0,
      strongMatchCount: 0,
      fallbackType: 'none',
    };
    expect(UsageEventSchema.safeParse(event).success).toBe(true);
    expect(
      UsageEventSchema.safeParse({ ...event, functionAreas: ['Fundraising'] })
        .success,
    ).toBe(false);
    const unknown = UsageEventSchema.parse({
      ...event,
      functionAreas: ['Unapproved', 'Operations'],
    });
    expect(hasUsageCatalogReferences(unknown, topicCatalog)).toBe(false);
  });
});
