import { describe, expect, it } from 'vitest';
import { topicCatalog } from '../../fixtures/topic-catalog';
import { parsePublicCatalog } from '../contracts/publicCatalog';
import { searchTopics, topicKeywords, type TopicQuery } from './topicSearch';
const blank: TopicQuery = { topic: '', functionAreas: [], tools: [] };
const search = (topic: string, filters: Partial<TopicQuery> = {}) =>
  searchTopics(topicCatalog, { ...blank, topic, ...filters });

describe('staff topic search', () => {
  it('returns every active match including >8 videos sharing tasks, with no fallback additions', () => {
    expect(search('fundraising')).toHaveLength(14);
    expect(search('')).toHaveLength(14);
    expect(search('uncovered marine biology')).toEqual([]);
    const sparse = {
      ...topicCatalog,
      items: [
        ...topicCatalog.items,
        {
          ...topicCatalog.items[0],
          youtubeId: 'isolated001',
          title: 'Unique zebras',
          description: 'Zebra research',
          tasks: [],
        },
      ],
    };
    expect(
      searchTopics(sparse, { ...blank, topic: 'zebras' }).map(
        (row) => row.item.youtubeId,
      ),
    ).toEqual(['isolated001']);
  });
  it('requires topic AND filter categories, OR within each category; exact tools do not expand to adjacent tools', () => {
    expect(
      search('presentation', {
        functionAreas: ['Fundraising'],
        tools: ['ChatGPT'],
      }).every(
        (row) =>
          row.item.functionAreas.includes('Fundraising') &&
          row.item.tools.includes('ChatGPT'),
      ),
    ).toBe(true);
    expect(
      search('presentation', {
        functionAreas: ['Fundraising', 'Operations'],
        tools: ['ChatGPT', 'Sheets'],
      }),
    ).toHaveLength(14);
    expect(search('marine', { functionAreas: ['Fundraising'] })).toEqual([]);
    expect(search('', { tools: ['Claude'] })).toEqual([]);
  });
  it('uses complete published aliases and refreshed mappings, never a partial alias', () => {
    expect(search('PITCH—DECK')).toHaveLength(14);
    expect(search('pitch')).toEqual([]);
    expect(search('giving')).toHaveLength(14);
    expect(
      searchTopics(
        { ...topicCatalog, synonyms: [] },
        { ...blank, topic: 'giving' },
      ),
    ).toEqual([]);
    expect(
      topicKeywords(topicCatalog, 'pitch deck private original phrase', 'task'),
    ).toEqual(['presentation creation']);
  });
  it('supports one edit in long tokens but not short-token or substring matches', () => {
    for (const word of ['fundrasing', 'fundraissing', 'fundraixing'])
      expect(search(word)).toHaveLength(14);
    expect(search('fundrsng')).toEqual([]);
    expect(search('hat')).toEqual([]);
    expect(search('fund')).toEqual([]);
    expect(search('!!!')).toEqual([]);
  });
  it.each(['giving', 'giving guidance'])(
    'preserves every category mapping for %s regardless of synonym row order',
    (alias) => {
      const catalog = parsePublicCatalog({
        ...topicCatalog,
        synonyms: [
          { alias, category: 'functionArea', target: 'Fundraising' },
          { alias, category: 'task', target: 'budget planning' },
          { alias, category: 'tool', target: 'Claude' },
        ],
        items: topicCatalog.items.slice(0, 4).map((item, index) => ({
          ...item,
          title: `Session ${index + 1}`,
          description: 'Fictional demonstration.',
          functionAreas: index === 0 ? ['Fundraising'] : [],
          tasks: index === 1 ? ['budget planning'] : [],
          tools: index === 2 ? ['Claude'] : [],
        })),
      });
      const expectedIds = catalog.items
        .slice(0, 3)
        .map((item) => item.youtubeId);
      for (const synonyms of [
        catalog.synonyms,
        [...catalog.synonyms].reverse(),
      ]) {
        const reordered = { ...catalog, synonyms };
        expect(
          searchTopics(reordered, { ...blank, topic: alias }).map(
            (row) => row.item.youtubeId,
          ),
        ).toEqual(expectedIds);
        expect(
          searchTopics(reordered, { ...blank, topic: `${alias} unrelated` }),
        ).toEqual([]);
        expect(topicKeywords(reordered, alias, 'functionArea')).toEqual([
          'Fundraising',
        ]);
        expect(topicKeywords(reordered, alias, 'task')).toEqual([
          'budget planning',
        ]);
        expect(topicKeywords(reordered, alias, 'tool')).toEqual(['Claude']);
      }
    },
  );
  it('requires all topic concepts and matches descriptions and tags as well as titles', () => {
    expect(search('fundraising presentation')).toHaveLength(14);
    expect(search('fundraising unrelated')).toEqual([]);
    expect(search('fictional')).toHaveLength(14);
    expect(search('presentation creation')).toHaveLength(14);
  });
  it('ranks exact and alias evidence before fuzzy evidence, deterministically without mutations', () => {
    const catalog = {
      ...topicCatalog,
      items: [
        {
          ...topicCatalog.items[0],
          title: 'Fundrasing tips',
          functionAreas: [],
          description: 'Example',
          tasks: [],
        },
        {
          ...topicCatalog.items[1],
          title: 'Fundraising',
          description: 'Example',
          tasks: [],
        },
        {
          ...topicCatalog.items[2],
          title: 'Other session',
          functionAreas: [],
          description: 'Example',
          tasks: ['fundraising'],
        },
      ],
    };
    const before = structuredClone(catalog);
    const result = searchTopics(catalog, { ...blank, topic: 'fundraising' });
    expect(result.map((row) => row.item.youtubeId)).toEqual([
      catalog.items[1].youtubeId,
      catalog.items[2].youtubeId,
      catalog.items[0].youtubeId,
    ]);
    expect(
      searchTopics(
        { ...catalog, items: [...catalog.items].reverse() },
        { ...blank, topic: 'fundraising' },
      ),
    ).toEqual(result);
    expect(catalog).toEqual(before);
  });
  it('excludes retired items and every duplicate ID without collapsing shared tasks', () => {
    const catalog = {
      ...topicCatalog,
      items: [
        ...topicCatalog.items,
        topicCatalog.items[0],
        { ...topicCatalog.items[1], status: 'retired' as const },
      ],
    };
    expect(searchTopics(catalog, blank)).toHaveLength(12);
  });
});
