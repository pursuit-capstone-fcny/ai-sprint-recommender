import { describe, expect, it } from 'vitest';
import {
  expandSynonyms,
  normalizeText,
  normalizeWord,
  toolTier,
} from './vocabulary';

describe('normalizeWord', () => {
  it('lowercases, strips punctuation, and folds simple plurals', () => {
    expect(normalizeWord('Reports!')).toBe('report');
    expect(normalizeWord('class')).toBe('class');
    expect(normalizeWord('Fundraising')).toBe('fundraising');
  });
});

describe('expandSynonyms', () => {
  it('includes the canonical word plus its mapped synonyms', () => {
    expect(expandSynonyms('deck').sort()).toEqual(
      ['deck', 'presentation', 'slide'].sort(),
    );
  });

  it('normalizes synonym groups at load time, so a plural and singular goal word expand the same way', () => {
    const fromPlural = expandSynonyms('notes');
    const fromSingular = expandSynonyms('note');
    expect(fromPlural).toEqual(fromSingular);
    expect(fromPlural).toContain('minute');
  });

  it('goalWords=["notes"] expands to match text containing "meeting minutes"', () => {
    const expanded = new Set(expandSynonyms('notes'));
    const tokens = normalizeText('meeting minutes');
    expect(tokens.some((token) => expanded.has(token))).toBe(true);
  });

  it('goalWords=["volunteers"] matches text containing "volunteer onboarding"', () => {
    const expanded = new Set(expandSynonyms('volunteers'));
    const tokens = normalizeText('volunteer onboarding');
    expect(tokens.some((token) => expanded.has(token))).toBe(true);
  });

  it('goalWords=["analysis"] still matches plain text containing "analysis"', () => {
    const expanded = new Set(expandSynonyms('analysis'));
    const tokens = normalizeText('data analysis dashboard');
    expect(tokens.some((token) => expanded.has(token))).toBe(true);
  });
});

describe('toolTier', () => {
  it('returns exact over adjacent over none, case-insensitively', () => {
    expect(toolTier(['excel'], ['Excel'])).toBe('exact');
    expect(toolTier(['Excel'], ['Sheets'])).toBe('adjacent');
    expect(toolTier(['Excel'], ['Notion'])).toBe('none');
  });

  it('returns none for an unknown tool with no adjacency entry', () => {
    expect(toolTier(['Airtable'], ['Notion'])).toBe('none');
  });
});
