import { normalizeTerm } from './publicCatalog';
import { language } from '../engine/promptConfig/language';

// Sheet vocabulary -> #102 vocabulary. Only equivalent task names belong here;
// broad tags such as "content creation" must not imply a specific taught method.
const equivalents: Readonly<Record<string, string>> = {
  'ai basics': 'AI literacy',
  'ai policy drafting': 'AI policy',
  'grant application drafting': 'Grant drafting',
  'grant opportunity review': 'RFP review',
  'grantee assessment': 'Grant due diligence',
  'newsletter drafting': 'Newsletter writing',
  'copy editing': 'Editing proofreading',
  'email summarization': 'Email summary',
  'social media drafting': 'Social media writing',
  'job description drafting': 'Job description writing',
  'career framework design': 'Career frameworks',
  'case note drafting': 'Case notes',
  'client letter drafting': 'Client correspondence',
  'form creation': 'Form generation',
  'video scripting': 'Scriptwriting',
  'image creation': 'Image generation',
  'audio creation': 'Audio generation',
  'song creation': 'Music generation',
  'custom gpt setup': 'Custom assistants',
  'roleplay simulation': 'Role play',
  'interview practice': 'Interview preparation',
  'language practice': 'Language learning',
  'document querying': 'Document Q&A',
  'report drafting': 'Report generation',
  'curriculum development': 'Curriculum design',
};
const vocabulary = language.tasks.map((rule) => rule.task);
const canonical = new Map(
  vocabulary.map((task) => [normalizeTerm(task), task]),
);

export function canonicalTaskName(task: string): string {
  return (
    canonical.get(normalizeTerm(task)) ??
    (Object.hasOwn(equivalents, normalizeTerm(task))
      ? equivalents[normalizeTerm(task)]
      : undefined) ??
    task
  );
}
