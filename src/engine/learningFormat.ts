import { normalizeTerm, type PublicCatalog } from '../contracts/publicCatalog';
import { languageWord } from './promptLanguage';
import { promptPolarity } from './promptPolarity';

export type LearningFormat =
  'demo' | 'walkthrough' | 'presentation' | 'explainer';

export interface FormatDefinition {
  id: LearningFormat;
  label: string;
  aliases: string[];
  ambiguousArtifact?: boolean;
}

export interface VideoLearningFormat {
  youtubeId: string;
  primary: LearningFormat;
  secondary: LearningFormat[];
}

export interface LearningFormatConfig {
  formats: readonly FormatDefinition[];
  videos: readonly VideoLearningFormat[];
}

export interface LearningFormatEvidence {
  requested: LearningFormat[];
  primary: LearningFormat | null;
  secondary: LearningFormat[];
  affinity: number;
}

const DEFAULT_FORMATS: FormatDefinition[] = [
  {
    id: 'demo',
    label: 'Demonstration',
    aliases: [
      'demo',
      'demos',
      'demonstration',
      'demonstrations',
      'live demo',
      'live demonstration',
    ],
  },
  {
    id: 'walkthrough',
    label: 'Guided walkthrough',
    aliases: [
      'walkthrough',
      'walkthroughs',
      'walk through',
      'tutorial',
      'tutorials',
      'step by step tutorial',
      'step by step guide',
    ],
  },
  {
    id: 'presentation',
    label: 'Presentation or talk',
    aliases: [
      'presentation',
      'presentations',
      'lecture',
      'lectures',
      'talk',
      'talks',
    ],
    ambiguousArtifact: true,
  },
  {
    id: 'explainer',
    label: 'Conceptual explainer',
    aliases: [
      'explainer',
      'explainers',
      'conceptual explanation',
      'overview',
      'overviews',
    ],
    ambiguousArtifact: true,
  },
];
const FORMAT_IDS = new Set(DEFAULT_FORMATS.map((format) => format.id));
const LEARNING_CUES = new Set([
  'watch',
  'watching',
  'show',
  'find',
  'recommend',
  'prefer',
  'looking',
  'learn',
  'learning',
]);
const PRODUCTION_CUES = new Set([
  'create',
  'creating',
  'make',
  'making',
  'build',
  'building',
  'generate',
  'generating',
  'draft',
  'drafting',
  'write',
  'writing',
  'produce',
  'producing',
  'prepare',
  'preparing',
  'turn',
  'turning',
  'convert',
  'converting',
  'transform',
  'transforming',
  'repurpose',
  'repurposing',
  'summarize',
  'summarizing',
  'analyse',
  'analyze',
  'analyzing',
]);
const SCAFFOLDING = new Set([
  'show',
  'watch',
  'watching',
  'find',
  'recommend',
  'prefer',
  'looking',
  'like',
  'about',
  'covering',
  'explaining',
]);
const lastIndex = (words: string[], set: Set<string>) =>
  words.reduce((last, word, index) => (set.has(word) ? index : last), -1);

/** Genre words are removed before artifact/task parsing; the topic stays intact. */
export function prepareLearningFormats(
  catalog: PublicCatalog,
  config: LearningFormatConfig | undefined,
  inputWords: string[],
  preference?: LearningFormat,
) {
  const words = promptPolarity(inputWords).positiveWords;
  const definitions = config?.formats ?? DEFAULT_FORMATS;
  const ids = new Set<LearningFormat>();
  const aliases = new Map<
    string,
    { id: LearningFormat; tokens: string[]; ambiguous: boolean }
  >();
  for (const definition of definitions) {
    if (
      !FORMAT_IDS.has(definition.id) ||
      ids.has(definition.id) ||
      !definition.label ||
      !definition.aliases.length
    )
      throw new Error('Invalid learning format vocabulary.');
    ids.add(definition.id);
    for (const alias of definition.aliases) {
      const tokens = normalizeTerm(alias.normalize('NFKC'))
        .split(' ')
        .filter(Boolean);
      const key = tokens.join(' ');
      if (!key || aliases.has(key))
        throw new Error('Duplicate or empty learning format alias.');
      aliases.set(key, {
        id: definition.id,
        tokens,
        ambiguous: definition.ambiguousArtifact ?? false,
      });
    }
  }
  if (preference !== undefined && !ids.has(preference))
    throw new Error('Unknown learning format preference.');
  const videos = new Map<string, VideoLearningFormat>();
  for (const video of config?.videos ?? []) {
    if (
      videos.has(video.youtubeId) ||
      !catalog.items.some((item) => item.youtubeId === video.youtubeId) ||
      !ids.has(video.primary) ||
      video.secondary.some((id) => !ids.has(id) || id === video.primary) ||
      new Set(video.secondary).size !== video.secondary.length
    )
      throw new Error('Invalid or duplicate video learning format evidence.');
    videos.set(video.youtubeId, video);
  }
  const consumed = new Set<number>();
  const detected = new Set<LearningFormat>();
  const genreSpans: { start: number; end: number }[] = [];
  // Watching a person perform an action is an observable demonstration preference.
  for (let start = 0; start < words.length; start++) {
    const span = words.slice(start, start + 6);
    if (span[0] !== 'watch' || !['someone', 'somebody', 'a'].includes(span[1]))
      continue;
    const action = span.findIndex(
      (word, index) =>
        index > 1 &&
        [
          'doing',
          'configure',
          'configuring',
          'build',
          'building',
          'demonstrate',
        ].includes(word),
    );
    if (
      action < 0 ||
      span
        .slice(0, action)
        .some((word) => word === '\u0000' || word === '\u0001')
    )
      continue;
    detected.add('demo');
    genreSpans.push({ start, end: start + action + 1 });
    // Preserve the action itself for task parsing.
    for (let index = start; index < start + action; index++)
      consumed.add(index);
  }
  const entries = [...aliases.values()].sort(
    (a, b) =>
      b.tokens.length - a.tokens.length ||
      (a.id === b.id ? 0 : a.id < b.id ? -1 : 1),
  );
  for (const entry of entries) {
    for (
      let start = 0;
      start <= words.length - entry.tokens.length;
      start += 1
    ) {
      const end = start + entry.tokens.length;
      if (
        !entry.tokens.every(
          (word, offset) =>
            words[start + offset] === word && !consumed.has(start + offset),
        )
      )
        continue;
      const prefix = words.slice(
        Math.max(
          words.lastIndexOf('\u0000', start - 1),
          words.lastIndexOf('\u0001', start - 1),
        ) + 1,
        start,
      );
      const learning = lastIndex(prefix, LEARNING_CUES);
      const production = lastIndex(prefix, PRODUCTION_CUES);
      const possession = Math.max(
        prefix.lastIndexOf('have'),
        prefix.lastIndexOf('got'),
      );
      if (
        production > learning ||
        /^(no|not|without|avoid)$/.test(words[start - 1] ?? '')
      )
        continue;
      if (
        entry.ambiguous &&
        (possession > learning ||
          (learning < 0 &&
            !['about', 'on', 'covering', 'explaining'].includes(
              words[end] ?? '',
            )))
      )
        continue;
      // "Need a presentation about X" still describes a desired artifact.
      if (
        entry.ambiguous &&
        entry.tokens.some((word) =>
          ['presentation', 'presentations'].includes(word),
        ) &&
        learning < 0 &&
        prefix.some((word) => ['need', 'want'].includes(word))
      )
        continue;
      detected.add(entry.id);
      genreSpans.push({ start, end });
      for (let index = start; index < end; index += 1) consumed.add(index);
    }
  }
  const requested = preference ? [preference] : [...detected].sort();
  const maskedWords = words.map((word, index) =>
    consumed.has(index) ? '' : word,
  );
  // A genre/topic query needs no artifact inference unless it also asks for an action.
  let workflowIntent =
    genreSpans.length === 0 ||
    words.some(
      (word) =>
        PRODUCTION_CUES.has(word) ||
        [
          'have',
          'got',
          'need',
          'configure',
          'practice',
          'research',
          'debug',
          'adapt',
          'review',
          'organize',
          'aggregate',
          'proofread',
          'audit',
          'refine',
          'improve',
          'build',
          'create',
        ].includes(languageWord(word)),
    );
  const firstGenre = genreSpans.sort((a, b) => a.start - b.start)[0];
  if (
    firstGenre &&
    detected.size &&
    [...detected].every(
      (format) => format === 'presentation' || format === 'explainer',
    )
  ) {
    const prefix = words.slice(0, firstGenre.start);
    const after = words.slice(firstGenre.end).map(languageWord).join(' ');
    workflowIntent =
      prefix.some((word) => ['have', 'got'].includes(word)) ||
      /how to (create|make|build|generate|draft|write|turn|convert)/.test(
        after,
      ) ||
      /using [a-z ]{1,40} to (research|inspect|analyze|summarize)/.test(
        after,
      ) ||
      /setup for (adapt|configure|create)/.test(after);
  }
  if (genreSpans.length)
    words.forEach((word, index) => {
      if (
        SCAFFOLDING.has(word) ||
        ['turning', 'converting', 'transforming', 'repurposing'].includes(word)
      )
        consumed.add(index);
    });
  return {
    requested,
    topicSpecified: genreSpans.some((span) =>
      words
        .slice(span.end)
        .some((word) =>
          ['about', 'on', 'covering', 'explaining'].includes(word),
        ),
    ),
    consumed,
    maskedWords,
    workflowIntent,
    evidence(youtubeId: string): LearningFormatEvidence {
      const video = videos.get(youtubeId);
      return {
        requested: [...requested],
        primary: video?.primary ?? null,
        secondary: [...(video?.secondary ?? [])].sort(),
        affinity:
          !requested.length || !video
            ? 0
            : requested.includes(video.primary)
              ? 1
              : video.secondary.some((format) => requested.includes(format))
                ? 0.5
                : 0,
      };
    },
  };
}
