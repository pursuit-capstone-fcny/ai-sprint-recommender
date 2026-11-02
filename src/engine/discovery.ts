import type { PublicCatalog } from '../contracts/publicCatalog';
import type { PromptOptions } from './prompt';
import { languageTokens } from './promptLanguage';
import type { interpretOperation } from './taskIntent';
import { compatibleCandidates } from './taskCompatibility';

type Intent = ReturnType<typeof interpretOperation>;
// Request scaffolding is not a topic. Catalog tags and title words supply the
// positive anchor; a tool name alone is an explicit request to browse that tool.
const SCAFFOLDING = new Set([
  'example',
  'coordinate',
  'plan',
  'planning',
  'nonprofit',
  'organization',
  'interested',
  'interest',
  'learn',
  'learning',
  'explore',
  'introduction',
]);
const SPECIFIC_ACTIONS = new Set([
  'create',
  'draft',
  'compose',
  'generate',
  'build',
  'make',
  'write',
  'edit',
  'summarize',
  'analyze',
  'extract',
  'convert',
  'repair',
  'fix',
  'merge',
  'review',
  'hold',
  'turn',
  'clean',
  'export',
  'import',
  'automate',
]);

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
    intent.constraints.length ||
    intent.positive.some((word) => SPECIFIC_ACTIONS.has(word))
  )
    return [];
  const topics = interpreted.keywords.filter((word) => !SCAFFOLDING.has(word));
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
