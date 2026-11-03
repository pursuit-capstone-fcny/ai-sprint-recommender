import type { PublicCatalog } from '../contracts/publicCatalog';
import type { PromptOptions } from './prompt';
import { languageTokens } from './promptLanguage';
import type { interpretOperation } from './taskIntent';
import { compatibleCandidates } from './taskCompatibility';

type Intent = ReturnType<typeof interpretOperation>;

function markTools(words: string[], names: string[][]): string {
  const marked = [...words];
  for (const name of [...names].sort((a, b) => b.length - a.length)) {
    for (let i = 0; i < marked.length; i++) {
      if (name.every((word, offset) => marked[i + offset] === word))
        marked.splice(i, name.length, '@tool');
    }
  }
  return marked.join(' ');
}

function discoveryWords(catalog: PublicCatalog, intent: Intent): string[] {
  const excludedNames = intent.interpretation.excludedTools
    .flatMap((tool) => [
      tool,
      ...catalog.synonyms
        .filter((row) => row.category === 'tool' && row.target === tool)
        .map((row) => row.alias),
    ])
    .map(languageTokens);
  const words: string[] = [];
  for (let start = 0, end = 0; end <= intent.scoped.length; end++) {
    if (
      end < intent.scoped.length &&
      !['\u0000', '\u0001'].includes(intent.scoped[end])
    )
      continue;
    const clause = markTools(
      languageTokens(intent.scoped.slice(start, end).join(' ')),
      excludedNames,
    );
    // Remove only complete excluded-tool clauses, never arbitrary negated work.
    const toolExclusion =
      /^(?:please )?(?:(?:i|we) )?(?:(?:do|will|would|should|must|can|could) )?(?:not (?:(?:want|need) (?:to )?)?(?:(?:use|using|install|with|switch to|switching to|work with) )?|(?:avoid|exclude|excluding|without|never|no) (?:(?:use|using) )?)@tool(?: (?:and|or) @tool)*(?: please)?$/.test(
        clause,
      );
    if (!toolExclusion)
      words.push(
        ...intent.positive
          .slice(start, end)
          .filter((word) => /^[a-z0-9-]+$/.test(word)),
      );
    start = end + 1;
  }
  return words;
}

// Recognize broad inquiries positively. An unknown verb is not evidence that a
// specific operation can safely fall back to topic browsing.
function discoveryTopics(
  catalog: PublicCatalog,
  intent: Intent,
): string[] | null {
  const words = discoveryWords(catalog, intent);
  const phrases = [
    ...catalog.tasks,
    ...catalog.functionAreas,
    ...catalog.synonyms
      .filter((row) => row.category !== 'tool')
      .map((row) => row.alias),
    ...catalog.items.map((item) => item.title),
  ].map(languageTokens);
  const nominalTopic = (value: string) => {
    const terms = value
      .split(' ')
      .filter((word) => !['a', 'an', 'the', 'our', 'my'].includes(word));
    return (
      terms.length > 0 &&
      phrases.some((phrase) =>
        phrase.some((_, start) =>
          terms.every((term, offset) => phrase[start + offset] === term),
        ),
      )
    );
  };
  const text = words.join(' ').replace(/^for example /, '');
  const names = intent.interpretation.tools
    .flatMap((tool) => [
      tool,
      ...catalog.synonyms
        .filter((row) => row.category === 'tool' && row.target === tool)
        .map((row) => row.alias),
    ])
    .map(languageTokens);
  const toolQuery = markTools(words, names);
  if (
    names.length &&
    (/^(?:please )?(?:(?:tell|show) (?:me|us) (?:more |a bit )?about |(?:i|we) (?:want|need|would like) to (?:learn|know|understand|explore) (?:more )?(?:about )?|(?:learn|learning|explore|understand|introduction to|about) )?@tool(?: (?:tutorial|example|overview|help|introduction|idea|use|use case))?$/.test(
      toolQuery,
    ) ||
      /^(?:what|which) (?:can|could) (?:i|we) (?:do|create|make|build) (?:with|using|in) @tool$/.test(
        toolQuery,
      ) ||
      /^what (?:can|does) @tool (?:do|offer|help (?:me|us) (?:do|with))$/.test(
        toolQuery,
      ) ||
      /^how (?:can|could|do) (?:i|we) (?:use|learn|explore|get started with) @tool$/.test(
        toolQuery,
      ) ||
      /^(?:please )?(?:(?:can|could|would) you )?(?:help (?:(?:me|us) )?|(?:i|we) (?:need|want|would like) (?:some )?help )(?:with |(?:to )?(?:learn|learning|understand|explore|use|using) (?:more )?(?:about |how to use )?|get(?:ting)? started with )@tool(?: please)?$/.test(
        toolQuery,
      ))
  )
    return [];
  const role = text.match(
    /^(?:i|we) (?:coordinate|manage|support|lead) (.+?)(?: and (?:need|want) help (?:with )?(?:plan|coordinate|manage|support) (.+))?$/,
  );
  if (role && nominalTopic(role[1]) && (!role[2] || nominalTopic(role[2])))
    return [...new Set(languageTokens(`${role[1]} ${role[2] ?? ''}`))];
  if (!intent.interpretation.tools.length && nominalTopic(text)) return words;
  return null;
}

export function discoveryCandidates(
  catalog: PublicCatalog,
  intent: Intent,
  options: PromptOptions,
) {
  const interpreted = intent.interpretation;
  // A specific task or source/output request must pass its own compatibility
  // route. Discovery cannot rescue a rejected operation or invent a method.
  if (
    intent.operation ||
    interpreted.tasks.length ||
    interpreted.sourceMaterials.length ||
    interpreted.desiredOutputs.length ||
    intent.requiredTool ||
    intent.constraints.length
  )
    return [];
  const topics = discoveryTopics(catalog, intent);
  if (topics === null) return [];
  const candidates = catalog.items.filter((item) => {
    if (item.tasks.some((task) => interpreted.excludedTasks.includes(task)))
      return false;
    const toolMatch = interpreted.tools.some((tool) =>
      item.tools.includes(tool),
    );
    if (interpreted.tools.length && !toolMatch) return false;
    if (!topics.length)
      return (
        toolMatch ||
        interpreted.functionAreas.some((area) =>
          item.functionAreas.includes(area),
        )
      );
    const anchor = new Set(
      languageTokens(`${item.title} ${item.tasks.join(' ')}`),
    );
    return topics.some((word) => anchor.has(word));
  });
  const operation = {
    id: 'catalog-discovery',
    when: [],
    tasks: [],
    outputs: [],
    candidates: [{ tasks: catalog.tasks, priority: 50, minimumStrength: 0.5 }],
  };
  const ids = new Set(candidates.map((item) => item.youtubeId));
  return compatibleCandidates(catalog, { ...intent, operation }, options)
    .filter((row) => ids.has(row.item.youtubeId))
    .map((row) => ({
      ...row,
      reason: interpreted.tools.length
        ? `Browse videos tagged ${interpreted.tools.join(', ')}.`
        : topics.length
          ? `Related to your topic: ${topics.filter((word) => languageTokens(`${row.item.title} ${row.item.tasks.join(' ')}`).includes(word)).join(', ')}.`
          : 'Browse videos in your function area.',
    }));
}
