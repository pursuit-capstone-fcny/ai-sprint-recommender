import type { PublicCatalog } from '../contracts/publicCatalog';
import type { RankedMatch } from '../contracts/rankedMatch';
import { topicKeywords, type TopicQuery } from '../engine/topicSearch';
import type { UsageSession } from './usageSession';

export function createTopicUsage(
  session: UsageSession,
  catalog: PublicCatalog,
  query: TopicQuery,
  results: RankedMatch[],
) {
  const functionAreas = [
    ...new Set([
      ...query.functionAreas,
      ...topicKeywords(catalog, query.topic, 'functionArea'),
    ]),
  ]
    .filter((value) => catalog.functionAreas.includes(value))
    .slice(0, 50);
  const common = {
    schemaVersion: 1 as const,
    sessionId: session.sessionId,
    searchId: crypto.randomUUID(),
    catalogVersion: catalog.catalogVersion,
    mode: 'topic' as const,
    src: session.src,
  };
  const seen = new Set<string>();
  let started = false;
  // Sequential delivery avoids overflowing the sender queue when browsing >32 videos.
  let delivery = Promise.resolve<unknown>(undefined);
  const send = (fields: object) => {
    const event = {
      ...common,
      ...fields,
      eventId: crypto.randomUUID(),
      time: new Date().toISOString(),
    };
    delivery = delivery
      .then(() => session.sender.send(event, catalog))
      .catch(() => undefined);
  };
  const start = () => {
    if (started) return;
    started = true;
    send({
      type: 'search',
      functionArea: functionAreas.length === 1 ? functionAreas[0] : null,
      functionAreas,
      tools: [
        ...new Set([
          ...query.tools,
          ...topicKeywords(catalog, query.topic, 'tool'),
        ]),
      ]
        .filter((value) => catalog.tools.includes(value))
        .slice(0, 50),
      tasks: topicKeywords(catalog, query.topic, 'task'),
      resultCount: results.length,
      strongMatchCount: results.length,
      fallbackType: 'none',
    });
  };
  const impression = (match: RankedMatch, index: number) => {
    if (seen.has(match.item.youtubeId)) return;
    seen.add(match.item.youtubeId);
    send({
      type: 'impression',
      youtubeId: match.item.youtubeId,
      rank: index + 1,
      matchType: 'strong',
    });
  };
  return {
    display() {
      start();
      results.forEach(impression);
    },
    click(index: number, target: 'embed' | 'youtube') {
      const match = results[index];
      if (!match) return;
      start();
      impression(match, index);
      send({
        type: 'click',
        youtubeId: match.item.youtubeId,
        rank: index + 1,
        matchType: 'strong',
        target,
      });
    },
  };
}
