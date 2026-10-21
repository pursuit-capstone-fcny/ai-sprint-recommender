import { describe, expect, it } from 'vitest';
import fixture from '../../fixtures/public-catalog.json';
import { impressionEvent, searchEvent } from '../../fixtures/usage-events';
import { parsePublicCatalog } from './publicCatalog';
import { hasUsageCatalogReferences, UsageEventSchema } from './usageEvent';

const catalog = parsePublicCatalog(fixture);

describe('usage event contract', () => {
  it.each([
    searchEvent,
    impressionEvent,
    { ...impressionEvent, type: 'click', target: 'embed' },
    { ...impressionEvent, type: 'click', target: 'youtube' },
    { ...impressionEvent, mode: 'direct', matchType: 'direct' },
    {
      ...searchEvent,
      recommendationEngine: 'llm',
      llmFallbackReason: 'none',
      modelVersion: 'fixture-model-v1',
      promptVersion: 'v1',
    },
  ])('AC-16.1: accepts each supported event shape %#', (event) => {
    expect(UsageEventSchema.safeParse(event).success).toBe(true);
  });

  it.each([
    { goal: 'synthetic free text' },
    { referrer: 'synthetic' },
    { email: 'synthetic' },
    { ip: 'synthetic' },
    { receivedAt: searchEvent.time },
    { type: 'visit' },
    { schemaVersion: 2 },
    { eventId: 'bad' },
    { sessionId: 'bad' },
    { searchId: 'bad' },
    { catalogVersion: 'bad' },
    { time: '2026-10-20T08:00:00-04:00' },
    { time: '2026-02-30T12:00:00Z' },
    { tools: ['ChatGPT', 'ChatGPT'] },
    { tools: ['x'.repeat(121)] },
    { tasks: 'grant reports' },
    { resultCount: -1 },
    { strongMatchCount: 3 },
    { fallbackType: 'provider-error' },
    { src: 123 },
    { mode: 'direct' },
    { recommendationEngine: undefined },
    { llmFallbackReason: undefined },
    { llmFallbackReason: 'provider said something' },
    { modelVersion: 'fixture-model-v1' },
    { recommendationEngine: 'llm', llmFallbackReason: 'none' },
    { llmFallbackReason: 'none' },
    { mode: 'topic' },
  ])('AC-16.3/16.4: rejects invalid search fields %#', (change) => {
    expect(
      UsageEventSchema.safeParse({ ...searchEvent, ...change }).success,
    ).toBe(false);
  });

  it.each([
    { rank: 0 },
    { rank: 1.5 },
    { youtubeId: 'not-an-id' },
    { matchType: 'fallback' },
    { matchType: 'semantic' },
    { mode: 'direct' },
    { matchType: 'direct' },
    { target: 'embed' },
    { type: 'click' },
    { type: 'click', target: 'other' },
    { functionArea: 'Fundraising' },
  ])('AC-16.1: rejects invalid result fields %#', (change) => {
    expect(
      UsageEventSchema.safeParse({ ...impressionEvent, ...change }).success,
    ).toBe(false);
  });

  it.each([
    ['website', 'website'],
    ['email', 'email'],
    ['session', 'session'],
    ['pilot', 'pilot'],
    ['team', 'team'],
    ['other', 'other'],
    ['untrusted source text', 'other'],
    [undefined, 'website'],
  ])('AC-16.5: normalizes source %s to %s', (src, expected) => {
    expect(UsageEventSchema.parse({ ...searchEvent, src }).src).toBe(expected);
  });

  it('normalizes UUID case before deduplication', () => {
    expect(
      UsageEventSchema.parse({
        ...searchEvent,
        eventId: searchEvent.eventId.toUpperCase(),
      }).eventId,
    ).toBe(searchEvent.eventId);
  });

  it.each([
    { functionArea: 'Unknown area' },
    { tools: ['chatgpt'] },
    { tasks: ['grant reporting'] },
    { catalogVersion: `sha256:${'0'.repeat(64)}` },
  ])('AC-16.6: rejects noncanonical or stale references %#', (change) => {
    const event = UsageEventSchema.parse({ ...searchEvent, ...change });
    expect(hasUsageCatalogReferences(event, catalog)).toBe(false);
  });

  it('accepts canonical tags and null area; rejects unknown or retired videos', () => {
    expect(
      hasUsageCatalogReferences(UsageEventSchema.parse(searchEvent), catalog),
    ).toBe(true);
    expect(
      hasUsageCatalogReferences(
        UsageEventSchema.parse({ ...searchEvent, functionArea: null }),
        catalog,
      ),
    ).toBe(true);
    expect(
      hasUsageCatalogReferences(UsageEventSchema.parse(impressionEvent), {
        ...catalog,
        items: [],
      }),
    ).toBe(false);
  });
});
