import { candidate as c, rule as r } from './operationRules';
import type { OperationRule } from '../taskIntent';

/** Action/source combinations for work described without canonical task names. */
export const taskParaphrases: readonly OperationRule[] = [
  r(
    'spreadsheet-report',
    [
      ['spreadsheet', 'csv', 'dataset'],
      ['pattern', 'explore', 'exploratory'],
      ['chart', 'visualization'],
      ['report', 'article'],
    ],
    ['Exploratory analysis', 'Chart creation', 'Report generation'],
    'spreadsheet',
    ['analysis', 'chart', 'document'],
    [
      c(['Exploratory analysis'], 110, {
        allTasks: ['Report generation', 'Chart creation'],
      }),
    ],
  ),
  r(
    'source-document-summary',
    [
      ['document', 'word', 'pdf'],
      ['summarize', 'summary'],
    ],
    ['Document summary'],
    'document',
    ['summary'],
    [
      c(['Document summary'], 110, {
        allTasks: ['Document Q&A', 'Document drafting'],
        teaching: ['source reference', 'against the text'],
      }),
    ],
    { unless: ['rfp', 'compare', 'flier', 'flyer'] },
  ),
  r(
    'configure-faq-assistant',
    [
      ['faq', 'repeated internal question'],
      ['assistant', 'gpt', 'helper'],
      ['configure', 'instruction', 'reference knowledge', 'reference file'],
    ],
    ['Knowledge management', 'Custom assistants'],
    'document',
    ['assistant'],
    [
      c(['Custom assistants'], 110, {
        allTasks: ['Knowledge management'],
        teaching: ['faq', 'internal question'],
        minimumStrength: 0.5,
      }),
    ],
    { explanatory: true, precedence: 1 },
  ),
  r(
    'intervention-app',
    [
      ['student', 'intervention'],
      ['track', 'tracking', 'follow up'],
      ['app', 'apps script', 'record'],
    ],
    ['Student interventions', 'App building'],
    'context',
    ['app', 'spreadsheet'],
    [c(['Student interventions'], 110, { allTasks: ['App building'] })],
  ),
  r(
    'curriculum-activity-assistant',
    [
      ['curriculum', 'lesson'],
      ['activity', 'icebreaker'],
      ['assistant', 'generator', 'playlab'],
    ],
    ['Lesson planning', 'Custom assistants'],
    'curriculum',
    ['assistant', 'lesson'],
    [
      c(['Custom assistants'], 110, {
        allTasks: ['Lesson planning'],
        teaching: ['activity', 'reference curriculum'],
        excludeTasks: ['Language learning'],
      }),
    ],
  ),
  r(
    'distinct-record-count',
    [
      ['distinct', 'unique', 'repeat'],
      ['count', 'counting', 'list'],
      ['sheet', 'spreadsheet', 'row', 'client id'],
    ],
    ['List comparison', 'Spreadsheet formulas'],
    'spreadsheet',
    ['analysis'],
    [
      c(['List comparison'], 110, { allTasks: ['Spreadsheet formulas'] }),
      c(['List comparison'], 85),
      c(['Spreadsheet formulas'], 80, { excludeTasks: ['Data aggregation'] }),
    ],
  ),
  r(
    'approved-writing-assistant',
    [
      ['write', 'writing', 'draft', 'copy'],
      ['approved', 'example', 'reference'],
      ['save', 'style', 'voice', 'consistent'],
    ],
    ['Brand voice', 'Custom assistants'],
    'document',
    ['assistant'],
    [
      c(['Brand voice'], 100, {
        allTasks: ['Custom assistants'],
        minimumStrength: 0.5,
      }),
      c(['Knowledge management'], 75, {
        allTasks: ['Process documentation'],
        minimumStrength: 0.5,
      }),
      c(['Workflow automation'], 75, { allTasks: ['Custom assistants'] }),
    ],
  ),
  r(
    'internal-faq-tutorial',
    [
      ['faq', 'help desk'],
      ['hr', 'policy', 'document based'],
      ['perplexity', 'tutorial', 'setup'],
    ],
    ['Knowledge management', 'Custom assistants'],
    'document',
    ['assistant'],
    [
      c(['Custom assistants'], 110, {
        allTasks: ['Responsible AI', 'Knowledge management'],
      }),
    ],
  ),
  r(
    'record-action-lookup',
    [
      ['board', 'minute', 'mins', 'record'],
      ['original', 'link', 'source', 'citation'],
      ['action', 'agreed', 'owner', 'own', 'decision'],
    ],
    ['Document Q&A'],
    'document',
    ['answer'],
    [
      c(['Document Q&A'], 110, {
        teaching: ['collection of source documents', 'notebook'],
      }),
      c(['Document Q&A'], 80, {
        teaching: ['source reference', 'targeted document question'],
      }),
      c(['Meeting minutes'], 80),
    ],
  ),
  r(
    'pay-counterproposal',
    [
      ['negotiation', 'counterproposal', 'counteroffer'],
      ['pay', 'salary', 'market rate'],
    ],
    ['Negotiation preparation'],
    'context',
    ['counteroffer'],
    [c(['Negotiation preparation'], 100, { minimumStrength: 0.5 })],
  ),
  r(
    'ai-starting-point',
    [
      ['ai'],
      ['new', 'beginner', 'starting'],
      ['start', 'what to ask', 'introduction'],
    ],
    ['AI literacy', 'Prompting'],
    undefined,
    [],
    [
      c(['AI literacy'], 110, { excludeTasks: ['Responsible AI'] }),
      c(['Prompting'], 100, {
        excludeTasks: [
          'Grant drafting',
          'Difficult conversations',
          'Brand naming',
          'Custom assistants',
        ],
      }),
      c(['Peer learning'], 95),
      c(['Responsible AI'], 95, { excludeTasks: ['Custom assistants'] }),
      c(['Prompting'], 80, { allTasks: ['Custom assistants'] }),
      c(['AI policy'], 75, { excludeTasks: ['Document drafting'] }),
    ],
    { explanatory: true, clearSource: true },
  ),
  r(
    'survey-board-followup',
    [
      ['survey', 'response'],
      ['board', 'slide', 'plain english'],
      ['checklist', 'follow up'],
    ],
    ['Survey analysis', 'Presentation creation', 'Process documentation'],
    'survey',
    ['analysis', 'presentation', 'checklist'],
    [
      c(['Survey analysis'], 110, {
        allTasks: ['Chart creation', 'Qualitative analysis'],
      }),
      c(['Survey analysis'], 85, {
        teaching: ['theme', 'summary', 'summarize'],
      }),
      c(['Presentation creation'], 80, { teaching: ['gamma'] }),
      c(['Board communications'], 75, { minimumStrength: 0.5 }),
      c(['Process documentation'], 75, { excludeTasks: ['Custom assistants'] }),
    ],
  ),
  r(
    'reusable-writing-tutorial',
    [
      ['helper', 'assistant', 'gpt'],
      ['write', 'writing'],
      ['reusable', 'setup', 'setting up'],
    ],
    ['Custom assistants', 'Brand voice'],
    'context',
    ['assistant'],
    [
      c(['Brand voice'], 100, {
        allTasks: ['Custom assistants'],
        minimumStrength: 0.5,
      }),
      c(['Prompting'], 100, { allTasks: ['Custom assistants'] }),
      c(['Lesson planning'], 75, { teaching: ['lesson planning gpt'] }),
    ],
  ),
  r(
    'presentation-handout',
    [
      ['slide', 'presentation', 'deck'],
      ['handout', 'one page', 'main point'],
      ['already have', 'existing'],
    ],
    ['Document summary', 'Plain language'],
    'presentation',
    ['document', 'summary'],
    [
      c(['Document summary'], 100, {
        allTasks: ['Document drafting', 'Document Q&A'],
      }),
      c(['Board communications', 'Newsletter writing'], 80, {
        minimumStrength: 0.5,
      }),
      c(['Audio generation'], 75),
    ],
  ),
  r(
    'accessible-agent-introduction',
    [
      ['accessible', 'accessibility', 'adapting lesson'],
      ['agent', 'assistant'],
      ['introduction', 'setting', 'introductory', 'proposed instruction'],
    ],
    ['Custom assistants'],
    undefined,
    [],
    [
      c(['Custom assistants'], 110, {
        teaching: ['accessible personalized'],
        minimumStrength: 0.5,
      }),
      c(['Lesson planning'], 80, { teaching: ['lesson planning gpt'] }),
      c(['Knowledge management'], 75, {
        teaching: ['project', 'curate supporting'],
        minimumStrength: 0.5,
        excludeTasks: ['Workflow automation'],
      }),
    ],
    { explanatory: true, clearSource: true },
  ),
  r(
    'staff-ai-input-guidance',
    [
      ['ai'],
      ['staff', 'information', 'put into', 'upload'],
      ['explain', 'talk', 'introduction', 'should'],
    ],
    ['AI policy', 'Responsible AI'],
    undefined,
    [],
    [
      c(['AI policy'], 110, { excludeTasks: ['Document drafting'] }),
      c(['Responsible AI'], 110, { excludeTasks: ['Custom assistants'] }),
      c(['Prompting'], 75, { teaching: ['confidentiality'] }),
      c(['Custom assistants'], 75, { allTasks: ['Responsible AI'] }),
    ],
    { explanatory: true, clearSource: true },
  ),
  r(
    'visitor-intake-form',
    [
      ['visitor', 'walk in', 'reception'],
      ['form', 'contact detail'],
      ['build', 'enter', 'capture'],
    ],
    ['Client intake', 'Form generation'],
    'context',
    ['form'],
    [
      c(['Client intake'], 100, { allTasks: ['App building'] }),
      c(['Form generation'], 80),
      c(['Student interventions'], 75),
    ],
  ),
];
