// Minimal matching vocabulary for #12. Shaped so the Sheet's synonym table
// can replace SYNONYM_GROUPS/ADJACENT_GROUPS later without touching callers.

export function normalizeWord(word: string): string {
  const stripped = word.toLowerCase().replace(/[^a-z0-9]+/g, '');
  if (stripped.endsWith('ies') && stripped.length > 4) {
    return `${stripped.slice(0, -3)}y`;
  }
  if (
    stripped.endsWith('s') &&
    !stripped.endsWith('ss') &&
    stripped.length > 3
  ) {
    return stripped.slice(0, -1);
  }
  return stripped;
}

export function normalizeText(text: string): string[] {
  return text
    .split(/\s+/)
    .map((token) => normalizeWord(token))
    .filter((token) => token.length > 0);
}

// Symmetric groups: any word matches every other word in its group.
const RAW_SYNONYM_GROUPS: readonly string[][] = [
  ['slides', 'deck', 'presentation'],
  ['grant', 'proposal', 'funding'],
  ['donor', 'donation', 'giving'],
  ['email', 'newsletter'],
  ['report', 'summary', 'reporting'],
  ['meeting', 'notes', 'minutes'],
  ['volunteer', 'volunteers'],
  ['social', 'post', 'instagram'],
  ['budget', 'finance', 'spreadsheet'],
  ['board', 'governance'],
  ['event', 'events', 'gala'],
  ['data', 'analysis', 'dashboard'],
];

// Normalized once at load time so a plural goal word, a singular synonym
// entry, and the plural/singular forms in video text all fold identically.
const SYNONYM_GROUPS: string[][] = RAW_SYNONYM_GROUPS.map((group) =>
  Array.from(new Set(group.map(normalizeWord))),
);

export function expandSynonyms(word: string): string[] {
  const normalized = normalizeWord(word);
  const group = SYNONYM_GROUPS.find((candidate) =>
    candidate.includes(normalized),
  );
  return group ?? [normalized];
}

export type ToolTier = 'exact' | 'adjacent' | 'none';

export interface ToolMatch {
  tier: ToolTier;
  tool?: string;
  profileTool?: string;
}

// Mutually-adjacent group (general AI assistants for writing tasks) plus
// explicit pairs from the issue/spec examples.
const ADJACENT_GROUPS: readonly string[][] = [
  ['ChatGPT', 'Claude', 'Gemini', 'Copilot'],
  ['Excel', 'Sheets'],
];

// One-directional: an unmapped tool points at its nearest known relative,
// but the relative doesn't point back (it isn't "adjacent to itself").
const ADJACENT_EXTRA: Record<string, string[]> = {
  'Claude Design': ['Claude'],
};

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function adjacentToolsFor(tool: string): string[] {
  const key = normalizeKey(tool);
  const fromGroups = ADJACENT_GROUPS.filter((group) =>
    group.some((candidate) => normalizeKey(candidate) === key),
  ).flatMap((group) =>
    group.filter((candidate) => normalizeKey(candidate) !== key),
  );

  const extraKey = Object.keys(ADJACENT_EXTRA).find(
    (candidate) => normalizeKey(candidate) === key,
  );
  const fromExtra = extraKey ? ADJACENT_EXTRA[extraKey] : [];

  return [...fromGroups, ...fromExtra];
}

export function matchTool(
  profileTools: string[],
  videoTools: string[],
): ToolMatch {
  for (const profileTool of profileTools) {
    for (const videoTool of videoTools) {
      if (normalizeKey(profileTool) === normalizeKey(videoTool)) {
        return { tier: 'exact', tool: videoTool, profileTool };
      }
    }
  }

  for (const profileTool of profileTools) {
    const adjacents = adjacentToolsFor(profileTool);
    for (const videoTool of videoTools) {
      if (
        adjacents.some(
          (candidate) => normalizeKey(candidate) === normalizeKey(videoTool),
        )
      ) {
        return { tier: 'adjacent', tool: videoTool, profileTool };
      }
    }
  }

  return { tier: 'none' };
}

export function toolTier(
  profileTools: string[],
  videoTools: string[],
): ToolTier {
  return matchTool(profileTools, videoTools).tier;
}
