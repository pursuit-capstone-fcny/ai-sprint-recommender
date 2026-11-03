import type { CatalogItem } from '../contracts/catalogItem';
import type { RankedMatch } from '../contracts/rankedMatch';
import { eligibleCatalog } from './resultPolicy';

// Editorial order approved November 2, 2026. Resolve public metadata from the
// current catalog so edits and retirements continue to take effect.
export const DEFAULT_VIDEO_IDS = [
  'rFhgVTsItlU', // Starter Skills: Reading, Writing, Chatting
  'FMQJH3c5cLc', // How to Prompt with aiSPIRE
  'DP0rtrJVOvM', // Write and Edit Faster with MS Word Copilot
  'tIekXJLsm8g', // Simple Charts with Gemini
  'kONzk7f2M5o', // Proofreading External Communications with Claude in Word
  '33a0qYtCMvc', // Develop a Slide Deck with Notebook LM
  'W-j725bzPJU', // Using Perplexity AI in Human Services
  '_wdiyBIC8uc', // Build a Slide Presentation with AI
] as const;

export const FALLBACK_VIDEO_IDS = [
  '6d2bKhdmqqA', // Placeholder AI Guidelines
  'rjaMvND2IRU', // Breaking down an RFP with ChatGPT
  'Xlvo2_eUBLo', // Transforming Print to Podcast
  'cwCVpchJHB4', // Turn Program Feedback into a Director-Ready Report with AI
  'maR3ZerQIJU', // Automate Email Attachments with Google Workspace Studio
  'nBAaIIz9QFg', // Build a Custom AI Assistant for Staff Training
  'Kv0C743lCUw', // Design a Class Syllabus in Minutes with AI
  'C7wclvAF0Mc', // Using AI to Translate Technical Risks into Executive Action
] as const;

const COLLECTION_SIZE = 8;

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function collectionVideos(
  catalog: CatalogItem[],
  preferredIds: readonly string[],
  otherCollectionIds: readonly string[],
): RankedMatch[] {
  const order = new Map(preferredIds.map((id, index) => [id, index]));
  const reserved = new Set(otherCollectionIds);
  return eligibleCatalog(catalog)
    .sort((a, b) => {
      const preferred =
        (order.get(a.youtubeId) ?? COLLECTION_SIZE) -
        (order.get(b.youtubeId) ?? COLLECTION_SIZE);
      if (preferred !== 0) return preferred;
      return (
        Number(reserved.has(a.youtubeId)) - Number(reserved.has(b.youtubeId)) ||
        Number(b.isStartHere) - Number(a.isStartHere) ||
        compareText(b.addedAt ?? '', a.addedAt ?? '') ||
        compareText(a.youtubeId, b.youtubeId)
      );
    })
    .slice(0, COLLECTION_SIZE)
    .map((item) => ({
      item,
      matchType: 'fallback',
      reason: item.isStartHere
        ? 'Marked Start here by the library.'
        : 'A general suggestion for exploring the library.',
    }));
}

export function defaultVideos(catalog: CatalogItem[]): RankedMatch[] {
  return collectionVideos(catalog, DEFAULT_VIDEO_IDS, FALLBACK_VIDEO_IDS);
}

export function fallbackVideos(catalog: CatalogItem[]): RankedMatch[] {
  // Reserve actual default replacements too, so both collections can remain
  // distinct when more than one approved video disappears.
  return collectionVideos(
    catalog,
    FALLBACK_VIDEO_IDS,
    defaultVideos(catalog).map(({ item }) => item.youtubeId),
  );
}
