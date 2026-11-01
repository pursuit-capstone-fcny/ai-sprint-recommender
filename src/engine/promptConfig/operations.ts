import type { OperationRule } from '../taskIntent';

import { candidate, rule } from './operationRules';
import { taskOperations } from './taskOperations';
import { taskDiscovery } from './taskDiscovery';
import { taskParaphrases } from './taskParaphrases';
const formulas = [candidate(['Spreadsheet formulas'])];
const survey = [
  candidate(['Survey analysis'], 100, {
    teaching: ['theme', 'summary', 'summarize'],
  }),
];
const lesson = [
  candidate(['Lesson planning'], 80, {
    excludeTasks: ['Language learning'],
    excludeTeaching: ['vocabulary'],
  }),
];
const citedDocuments = candidate(['Document Q&A'], 80, {
  teaching: [
    'citation',
    'source reference',
    'against the text',
    'targeted document question',
  ],
  excludeTasks: ['App building'],
});
/** Predicate groups express requested operations; candidate links describe transferable instruction. */
export const operationRules: readonly OperationRule[] = [
  ...taskOperations,
  ...taskDiscovery,
  ...taskParaphrases,
  rule(
    'vocabulary-helper',
    [
      ['word', 'vocabulary'],
      [
        'grade',
        'teaching',
        'sentence',
        'teach',
        'class',
        'classroom',
        'year group',
        'unit',
      ],
      ['helper', 'assistant', 'routine'],
    ],
    ['Lesson planning', 'Custom assistants'],
    'curriculum',
    ['assistant', 'lesson'],
    [
      candidate(['Custom assistants'], 110, { teaching: ['vocabulary'] }),
      candidate(['Lesson planning'], 80, {
        excludeTasks: ['Curriculum design', 'Language learning'],
        excludeTeaching: ['accessible personalized syllabus'],
      }),
      candidate(['Storytelling'], 75, {
        when: ['visual', 'character', 'picture'],
      }),
    ],
  ),
  rule(
    'educational-agent-explanation',
    [
      ['assistant', 'agent'],
      ['course', 'curriculum', 'learner'],
      [
        'explanation',
        'explain',
        'presentation',
        'conceptual',
        'design discussion',
        'understand',
        'structure',
      ],
    ],
    ['Custom assistants'],
    undefined,
    [],
    [
      candidate(['Custom assistants'], 100, { allTasks: ['Lesson planning'] }),
      candidate(['Accessible content'], 75, {
        when: ['accessibility', 'accessible', 'parent', 'student'],
        excludeTasks: ['Custom assistants'],
      }),
    ],
    { explanatory: true, clearSource: true },
  ),
  rule(
    'scanned-feedback',
    [
      ['photo', 'scan'],
      ['feedback', 'evaluation'],
      ['report', 'account', 'what went well', 'summary'],
    ],
    ['Survey analysis', 'Qualitative analysis', 'Report generation'],
    'form',
    ['analysis', 'document'],
    [
      ...survey,
      candidate(['Chart creation'], 75, {
        allTasks: ['Exploratory analysis'],
        whenAll: [
          ['rating', 'score', 'chart', 'quantitative'],
          ['correct', 'error', 'mistaken', 'verify'],
        ],
      }),
      candidate(['Chart creation'], 75, {
        allTasks: ['Survey analysis'],
        whenAll: [
          ['rating', 'score', 'chart', 'quantitative'],
          ['correct', 'error', 'mistaken', 'verify'],
        ],
      }),
    ],
  ),
  rule(
    'numeric-survey-chart',
    [
      ['graph', 'chart', 'bar'],
      ['score', 'rating', 'questionnaire', 'survey'],
      ['average', 'mean', 'question', 'label'],
    ],
    ['Chart creation'],
    'spreadsheet',
    ['chart'],
    [
      candidate(['Chart creation'], 100, { allTasks: ['Survey analysis'] }),
      candidate(['Chart creation'], 80, { allTasks: ['Exploratory analysis'] }),
    ],
  ),
  rule(
    'feedback-themes',
    [
      ['answer', 'response', 'comment', 'feedback'],
      ['theme', 'pattern', 'what went well'],
    ],
    ['Qualitative analysis', 'Survey analysis'],
    'survey',
    ['analysis'],
    survey,
  ),
  rule(
    'conditional-totals',
    [
      ['total', 'amount owed', 'sum', 'add up', 'adds up', 'add'],
      ['each', 'per', 'only where', 'one volunteer', 'one person'],
      ['hour', 'employee', 'person', 'volunteer', 'claim'],
    ],
    ['Spreadsheet formulas', 'Data aggregation'],
    'spreadsheet',
    ['formula'],
    [candidate(['Data aggregation']), candidate(['Spreadsheet formulas'], 80)],
  ),
  rule(
    'formula-repair',
    [
      ['formula', 'calculation', 'clock in'],
      ['fix', 'error', 'late', 'blank', 'explain', 'understand'],
    ],
    ['Spreadsheet formulas'],
    'spreadsheet',
    ['formula'],
    formulas,
    { precedence: 1 },
  ),
  rule(
    'participation-comparison',
    [
      ['partner', 'organization', 'participation', 'list'],
      [
        'new',
        'joining',
        'came back',
        'stopped',
        'distinct',
        'first time',
        'different organization',
      ],
      ['separate', 'event', 'fair', 'file', 'across'],
    ],
    ['List comparison'],
    'spreadsheet',
    ['comparison'],
    [
      candidate(['List comparison']),
      candidate(['Data cleaning'], 75),
      candidate(['Spreadsheet formulas'], 70, {
        excludeTasks: ['List comparison', 'Data aggregation'],
        whenAll: [
          ['count'],
          ['row', 'formula', 'calculation', 'unique', 'distinct', 'once'],
        ],
      }),
    ],
  ),
  rule(
    'terminology-replacement',
    [
      ['replacement', 'approved'],
      ['name', 'language', 'term', 'label'],
      ['workbook', 'spreadsheet', 'throughout'],
    ],
    ['Terminology updates'],
    'spreadsheet',
    ['spreadsheet'],
    [candidate(['Terminology updates']), candidate(['Data cleaning'], 80)],
    { supersedes: ['record-action-lookup'] },
  ),
  rule(
    'data-cleaning',
    [
      [
        'duplicate',
        'impossible',
        'missing',
        'blank field',
        'blank',
        'inconsistent',
        'empty field',
        'repeated row',
        'odd date',
        'spelling',
      ],
      ['row', 'export', 'date', 'value', 'spreadsheet'],
    ],
    ['Data cleaning'],
    'spreadsheet',
    ['cleaned-data'],
    [
      candidate(['Data cleaning']),
      candidate(['Exploratory analysis'], 80, { teaching: ['data cleaning'] }),
      candidate(['List comparison'], 75, {
        whenAll: [
          ['duplicate', 'repeat', 'repeated'],
          ['name', 'label', 'organization', 'program'],
        ],
      }),
      candidate(['Terminology updates'], 75, {
        when: [
          'term',
          'category',
          'replacement',
          'language',
          'standardize',
          'corrected',
          'change log',
          'spelling',
        ],
      }),
    ],
  ),
  rule(
    'directory-structuring',
    [
      [
        'directory',
        'stuck onto',
        'exhibitor',
        'copied text',
        'unstructured',
        'jumble',
        'pasted',
        'one cell',
        'mess',
      ],
      ['column', 'table', 'row'],
    ],
    ['Data structuring'],
    'context',
    ['spreadsheet'],
    [
      candidate(['Data structuring'], 100, { excludeTasks: ['App building'] }),
      candidate(['Data cleaning'], 75, {
        when: ['mess', 'tidy', 'clean', 'check', 'excel', 'one cell'],
      }),
    ],
  ),
  rule(
    'attendance-triage',
    [
      ['attendance', 'attended', 'barely coming'],
      [
        'contact',
        'follow up',
        'outreach',
        'drifting',
        'prioritize',
        'call first',
        'call',
      ],
    ],
    ['Attendance analysis', 'Student outreach'],
    'spreadsheet',
    ['analysis'],
    [
      candidate(['Attendance analysis']),
      candidate(['Student interventions'], 80, {
        unlessExcludedTasks: ['App building'],
      }),
      candidate(['Case management'], 75, {
        allTasks: ['Spreadsheet generation'],
        whenAll: [
          ['follow up', 'contact'],
          ['record', 'next date', 'tracker'],
        ],
      }),
      candidate(['Data cleaning'], 75, {
        when: [
          'missing value',
          'strange value',
          'data quality',
          'invalid record',
        ],
      }),
      candidate(['Exploratory analysis'], 75, {
        allTasks: ['Report generation', 'Chart creation'],
        when: [
          'missing value',
          'strange value',
          'data quality',
          'invalid record',
        ],
      }),
      candidate(['Survey analysis'], 70, {
        allTasks: ['Translation'],
        whenAll: [['attendance band'], ['missing', 'strange', 'quality']],
      }),
    ],
    { supersedes: ['data-cleaning'] },
  ),
  rule(
    'financial-review',
    [
      [
        'financial statement',
        'public account',
        'ratio',
        'reserve',
        'irs filing',
        'auditor pdf',
      ],
      [
        'year',
        'income',
        'expense',
        'spending',
        'revenue',
        'financial',
        'finance',
      ],
    ],
    ['Financial analysis'],
    'document',
    ['analysis'],
    [candidate(['Financial analysis']), candidate(['Grant due diligence'], 80)],
  ),
  rule(
    'grantee-comparison',
    [
      ['annual report', 'grantee', 'publication'],
      [
        'compare',
        'comparison',
        'renewing',
        'developed',
        'evolved',
        'side by side',
      ],
    ],
    ['Grant due diligence', 'Document comparison'],
    'document',
    ['comparison'],
    [
      candidate(['Grant due diligence']),
      candidate(['Financial analysis', 'Document comparison'], 80),
      candidate(['Document Q&A'], 80, {
        teaching: ['collection of source documents', 'cross document'],
        excludeTasks: ['App building'],
        when: ['several', 'renewing', 'over time', 'evolved', 'developed'],
      }),
    ],
  ),
  rule(
    'document-comparison',
    [
      [
        'agreement',
        'policy',
        'disclosure',
        'document',
        'banking',
        'bank terms',
      ],
      ['compare', 'version', 'changed', 'fee change', 'replacement agreement'],
    ],
    ['Document comparison'],
    'document',
    ['comparison'],
    [
      candidate(['Document comparison']),
      candidate(['Grant due diligence'], 80),
      citedDocuments,
      candidate(['Editing proofreading'], 75, {
        whenAll: [
          ['message', 'letter', 'communication'],
          ['claim', 'check', 'review'],
        ],
      }),
    ],
    { supersedes: ['document-review'] },
  ),
  rule(
    'rfp-review',
    [
      ['rfp', 'funding notice', 'funder'],
      [
        'qualify',
        'requirement',
        'submitted',
        'submission',
        'allow',
        'eligibility',
        'eligible',
        'summary',
        'draft',
        'template',
      ],
    ],
    ['RFP review'],
    'document',
    ['summary'],
    [
      candidate(['RFP review']),
      candidate(['Document Q&A'], 75, {
        allTasks: ['Document summary', 'Document drafting'],
      }),
    ],
  ),
  rule(
    'grant-inquiry',
    [
      ['foundation', 'funder', 'inquiry'],
      ['response', 'answer', 'draft', 'write'],
      ['instruction', 'overview', 'future', 'launch', 'guidance'],
    ],
    ['Grant drafting'],
    'document',
    ['document'],
    [
      candidate(['Grant drafting']),
      candidate(['Editing proofreading'], 75, {
        when: ['review', 'edit', 'check', 'proofread', 'catch', 'overclaim'],
      }),
    ],
    { preferDetectedSource: true },
  ),
  rule(
    'donor-repurposing',
    [
      ['report', 'research'],
      [
        'donor',
        'supporter',
        'briefing event',
        'online event',
        'online briefing',
      ],
      ['post', 'opening remark', 'webinar', 'event'],
    ],
    ['Content repurposing', 'Webinar planning', 'Social media writing'],
    'document',
    ['briefing', 'email'],
    [
      candidate(['Webinar planning']),
      candidate(['Social media writing'], 80),
      candidate(['Content repurposing'], 75, {
        allTasks: ['Custom assistants'],
        when: [
          'voice',
          'style',
          'opening remark',
          'briefing event',
          'online event',
          'online briefing',
        ],
      }),
      candidate(['Presentation creation'], 75, {
        teaching: ['presentation outline'],
        when: ['webinar', 'outline', 'slide', 'presentation'],
      }),
    ],
  ),
  rule(
    'biography',
    [
      ['bio', 'biography'],
      ['resume', 'cv', 'qualification', 'experience'],
      ['draft', 'website', 'word'],
    ],
    ['Document drafting'],
    'resume',
    ['document'],
    [
      candidate(['Document drafting'], 100, { teaching: ['bio'] }),
      candidate(['Cover letter writing'], 80),
      candidate(['Editing proofreading'], 75, {
        when: ['review', 'edit', 'check', 'proofread'],
      }),
    ],
  ),
  rule(
    'document-review',
    [
      ['review', 'check', 'proofread', 'edit', 'comment'],
      [
        'grammar',
        'claim',
        'tracked change',
        'tracked edit',
        'unsupported',
        'accept or reject',
        'accept each',
      ],
      ['draft', 'letter', 'document', 'word'],
    ],
    ['Editing proofreading', 'Document review'],
    'document',
    ['edited-document'],
    [
      candidate(['Editing proofreading', 'Document review']),
      candidate(['Document drafting'], 75, {
        allTasks: ['Document Q&A', 'Document summary'],
        when: ['voice', 'style', 'summarize', 'draft from'],
      }),
      candidate(['Brand voice'], 75, {
        allTasks: ['Custom assistants', 'Document drafting'],
        when: ['voice', 'style'],
      }),
      candidate(['Brand voice'], 70, {
        allTasks: ['Custom assistants', 'Document drafting'],
        teaching: ['writing convention', 'op ed'],
        whenAll: [['tracked change'], ['comment', 'grammar', 'verify']],
      }),
      candidate(['Document drafting'], 70, {
        allTasks: ['Document Q&A', 'Document summary'],
        whenAll: [['tracked change'], ['comment', 'grammar', 'verify']],
      }),
    ],
  ),
  rule(
    'technical-plain-language',
    [
      ['technical', 'security', 'jargon', 'risk assessment', 'it consultant'],
      ['trustee', 'board', 'nontechnical', 'chair', 'treasurer'],
      [
        'explain',
        'explanation',
        'understand',
        'adapt',
        'decision',
        'act on',
        'rewrite',
      ],
    ],
    ['Plain language', 'Board communications'],
    'document',
    ['document', 'email'],
    [
      candidate(['Board communications']),
      candidate(['Plain language'], 80),
      candidate(['Editing proofreading'], 80, {
        when: [
          'security',
          'fact',
          'version',
          'draft',
          'claim',
          'proofread',
          'review',
          'check',
        ],
      }),
      candidate(['Document drafting'], 75, {
        allTasks: ['Document Q&A', 'Document summary'],
        when: ['email', 'summary'],
      }),
    ],
    { explanatory: true, outputWhen: { email: ['email'] } },
  ),
  rule(
    'visual-rights-guide',
    [
      ['student', 'teenager'],
      ['participation', 'take part', 'taking part', 'right'],
      ['family', 'parent', 'visual'],
    ],
    ['Accessible content', 'Educational materials'],
    'context',
    ['image', 'document'],
    [
      candidate(['Accessible content'], 110, {
        allTasks: ['Educational materials'],
        excludeTasks: ['Custom assistants'],
      }),
      candidate(['Outreach materials'], 80),
      candidate(['Plain language'], 80, {
        when: [
          'english',
          'reading level',
          'simplify',
          'sentence',
          'language',
          'wording',
        ],
      }),
      candidate(['Board communications'], 80, { minimumStrength: 0.5 }),
      candidate(['Design feedback'], 75, {
        when: ['icon', 'layout', 'critique'],
      }),
    ],
  ),
  rule(
    'design-critique',
    [
      ['flyer', 'poster', 'flier', 'screenshot'],
      ['crowded', 'spacing', 'balance', 'layout', 'critique'],
    ],
    ['Design feedback'],
    'image',
    ['image'],
    [
      candidate(['Design feedback'], 100, {
        excludeTasks: ['Outreach materials'],
      }),
      candidate(['Design feedback'], 80, {
        allTasks: ['Outreach materials'],
        when: ['poster', 'flier', 'flyer', 'handout', 'print'],
      }),
    ],
  ),
  rule(
    'attachment-flow',
    [
      ['attachment'],
      ['gmail', 'inbox', 'email'],
      ['save', 'saved', 'drive', 'flow'],
    ],
    ['Email automation', 'Document inventory'],
    'email',
    ['spreadsheet'],
    [candidate(['Email automation', 'Document inventory'])],
  ),
  rule(
    'outlook-thread',
    [
      ['outlook'],
      ['thread', 'exchange', 'back and forth', 'chain'],
      ['reply', 'invitation', 'invite', 'summary', 'agreed'],
    ],
    ['Email summary', 'Email drafting', 'Meeting scheduling'],
    'email',
    ['email', 'summary'],
    [candidate(['Email summary', 'Email drafting', 'Meeting scheduling'])],
  ),
  rule(
    'formal-minutes',
    [
      ['recording', 'transcript', 'discussion', 'text of'],
      ['formal minute', 'decision', 'deadline', 'action', 'structured minute'],
      ['committee', 'meeting', 'minute', 'call', 'steering group'],
    ],
    ['Meeting minutes', 'Transcription'],
    'transcript',
    ['minutes'],
    [
      candidate(['Meeting minutes']),
      candidate(['Transcription'], 80),
      candidate(['Document summary'], 75, {
        allTasks: ['Document drafting', 'Document Q&A'],
        when: ['word record', 'summary', 'outline'],
      }),
      candidate(['Document summary'], 75, {
        teaching: ['panel', 'speaker'],
        when: [
          'outline',
          'word file',
          'word record',
          'download',
          'detailed summary',
        ],
      }),
    ],
  ),
  rule(
    'policy-helper',
    [
      ['helper', 'assistant', 'bot', 'help desk', 'answer service'],
      ['policy', 'manual', 'leave', 'reimbursement', 'handbook', 'hr'],
      ['answer', 'question', 'cite', 'admit'],
    ],
    ['Knowledge management', 'Custom assistants'],
    'document',
    ['assistant'],
    [
      candidate(['Custom assistants'], 100, {
        allTasks: ['Knowledge management'],
        excludeTasks: ['Workflow automation', 'Process documentation'],
        minimumStrength: 0.5,
      }),
      candidate(['Knowledge management'], 75, {
        allTasks: ['Process documentation'],
        minimumStrength: 0.5,
        when: [
          'manual',
          'policy pdf',
          'reference',
          'project',
          'source document',
          'knowledge file',
        ],
      }),
      candidate(['Document Q&A'], 75, {
        teaching: ['notebook', 'collection of source documents'],
      }),
      candidate(['Document Q&A'], 75, {
        teaching: ['cited source'],
        when: [
          'source',
          'reference',
          'handbook',
          'faq',
          'lookup',
          'look up',
          'retrieve',
        ],
      }),
      candidate(['Knowledge management'], 75, {
        allTasks: ['Process documentation'],
        minimumStrength: 0.5,
        whenAll: [['handbook'], ['hand off', 'human', 'person', 'exception']],
      }),
    ],
    { precedence: 1 },
  ),
  rule(
    'historical-document-question',
    [
      ['minute', 'document', 'source'],
      ['board', 'historical', 'years'],
      ['citation', 'find what', 'original', 'when', 'which year', 'evidence'],
    ],
    ['Document Q&A'],
    'document',
    ['answer'],
    [
      candidate(['Document Q&A'], 100, {
        teaching: [
          'citation',
          'source reference',
          'targeted document',
          'cited source',
        ],
      }),
      candidate(['Custom assistants'], 75, {
        teaching: ['policy pdf'],
        minimumStrength: 0.5,
      }),
    ],
  ),
  rule(
    'employer-rehearsal',
    [['employer'], ['practice', 'rehearse', 'simulation', 'pitch']],
    ['Role play', 'Staff training'],
    'context',
    ['role-play'],
    [
      candidate(['Role play'], 110, { teaching: ['employer'] }),
      candidate(['Role play'], 80, { excludeTasks: ['Language learning'] }),
    ],
  ),
  rule(
    'peer-conversation',
    [
      ['peer', 'coordinator', 'coworker', 'teammate'],
      ['conversation', 'deadline', 'handoff', 'shift', 'unfinished'],
      ['practice', 'feedback', 'pause', 'role play'],
    ],
    ['Role play', 'Difficult conversations'],
    'context',
    ['role-play'],
    [
      candidate(['Difficult conversations']),
      candidate(['Role play'], 80, {
        excludeTasks: [
          'Grantmaker communications',
          'Staff training',
          'Language learning',
        ],
      }),
    ],
  ),
  rule(
    'staff-process',
    [
      [
        'process',
        'procedure',
        'handoff',
        'step',
        'hand over',
        'handover',
        'passed on',
        'who does what',
        'way of working',
      ],
      ['checklist', 'responsibility', 'responsibilities', 'requirement'],
    ],
    ['Process documentation'],
    'context',
    ['checklist'],
    [
      candidate(['Process documentation']),
      candidate(['Process documentation'], 80, { minimumStrength: 0.5 }),
    ],
  ),
  rule(
    'peer-learning',
    [
      [
        'cross department',
        'across department',
        'peer learning',
        'mixed group',
        'sharing',
        'share what',
      ],
      ['practice time', 'protected', 'experiment', 'demonstration', 'group'],
    ],
    ['Peer learning', 'Change management'],
    'context',
    [],
    [
      candidate(['Peer learning']),
      candidate(['AI policy', 'Responsible AI'], 80, {
        excludeTasks: ['Document drafting', 'Custom assistants'],
        when: [
          'policy',
          'privacy',
          'responsible',
          'safe',
          'guideline',
          'risk',
          'sensitive',
          'stopped',
          'adoption',
          'barrier',
          'concern',
        ],
      }),
    ],
    { explanatory: true },
  ),
  rule(
    'training-media',
    [
      ['audio', 'podcast'],
      [
        'document',
        'training pack',
        'training material',
        'text',
        'refresher',
        'source material',
        'guide',
        'induction',
        'manual',
      ],
      [
        'video',
        'explainer',
        'conversation',
        'listen',
        'overview',
        'reinforcement',
        'sample',
      ],
    ],
    ['Audio generation', 'Video creation'],
    'document',
    ['audio', 'video'],
    [candidate(['Audio generation']), candidate(['Audio review'], 80)],
    { outputWhen: { video: ['video', 'explainer'] } },
  ),
  rule(
    'song-generation',
    [
      ['song', 'music'],
      ['style', 'voice', 'lyric', 'version', 'mood', 'brief'],
    ],
    ['Music generation'],
    'context',
    ['music'],
    [candidate(['Music generation'])],
  ),
  rule(
    'language-practice',
    [
      ['spanish', 'french', 'mandarin', 'german', 'arabic'],
      ['practice', 'conversation', 'tutor'],
      ['correct', 'mistake', 'learn', 'explain'],
    ],
    ['Language learning'],
    'context',
    ['role-play'],
    [candidate(['Language learning'])],
  ),
  rule(
    'activity-helper',
    [
      ['activity', 'activities', 'lesson'],
      ['tutor', 'curriculum', 'age group'],
      ['helper', 'tool', 'suggest', 'reusable'],
    ],
    ['Lesson planning', 'Custom assistants'],
    'curriculum',
    ['assistant', 'lesson'],
    [
      candidate(['Custom assistants'], 110, {
        allTasks: ['Lesson planning'],
        excludeTeaching: ['personalized syllabus'],
      }),
      candidate(['Lesson planning'], 80, {
        excludeTasks: ['Language learning'],
      }),
      candidate(['Workflow automation'], 70, {
        allTasks: ['Custom assistants'],
        when: ['reusable', 'every time', 'routine'],
      }),
    ],
  ),
  rule(
    'course-syllabus',
    [
      ['paper', 'course'],
      ['week', 'session', 'syllabus', 'term'],
      ['reading', 'objective', 'assignment', 'assessment'],
    ],
    ['Curriculum design', 'Lesson planning'],
    'document',
    ['lesson'],
    [candidate(['Curriculum design']), ...lesson],
  ),
  rule(
    'form-code',
    [
      ['form'],
      ['apps script', 'generate', 'question'],
      ['accommodation', 'rubric', 'google form'],
    ],
    ['Form generation', 'Code generation'],
    'context',
    ['form'],
    [
      candidate(['Form generation'], 110, {
        allTasks: ['Evaluation design'],
        when: ['rubric', 'evaluation'],
      }),
      candidate(['Form generation']),
      candidate(['Process documentation'], 75, {
        allTasks: ['Client intake'],
        when: ['intake', 'handoff', 'procedure', 'accommodation'],
      }),
      candidate(['Code debugging'], 70, {
        whenAll: [
          ['script', 'code'],
          ['error', 'debug', 'correct'],
        ],
      }),
    ],
  ),
  rule(
    'code-debugging',
    [
      ['error', 'broke', 'throws'],
      ['code', 'javascript', 'php', 'function', 'website'],
      ['fix', 'change', 'suggest', 'explain'],
    ],
    ['Code debugging'],
    'code',
    ['code'],
    [
      candidate(['Code debugging']),
      candidate(['Code generation'], 75, {
        teaching: ['execution error', 'error message', 'corrected full script'],
        when: ['apps script', 'google form', 'javascript'],
      }),
    ],
  ),
  rule(
    'photo-editing',
    [
      ['photo', 'portrait'],
      ['brighter', 'dark', 'exposure', 'lightroom', 'edit'],
    ],
    ['Photo editing'],
    'image',
    ['image'],
    [
      candidate(['Photo editing']),
      candidate(['Design feedback'], 75, {
        teaching: ['diagnose', 'screenshot'],
        when: [
          'crop',
          'subject',
          'background',
          'mask',
          'layout',
          'balance',
          'critique',
        ],
      }),
    ],
  ),
];
