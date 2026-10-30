import type { OperationRule } from '../taskIntent';

import { candidate, rule } from './operationRules';
import { taskOperations } from './taskOperations';
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
  rule(
    'vocabulary-helper',
    [
      ['word', 'vocabulary'],
      ['grade', 'teaching', 'sentence'],
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
      ],
    ],
    ['Custom assistants'],
    undefined,
    [],
    [candidate(['Custom assistants'], 100, { allTasks: ['Lesson planning'] })],
    { explanatory: true },
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
    survey,
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
      ['total', 'amount owed', 'sum'],
      ['each', 'per', 'only where'],
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
  ),
  rule(
    'participation-comparison',
    [
      ['partner', 'organization', 'participation', 'list'],
      ['new', 'joining', 'came back', 'stopped', 'distinct'],
      ['separate', 'event', 'fair', 'file', 'across'],
    ],
    ['List comparison'],
    'spreadsheet',
    ['comparison'],
    [candidate(['List comparison']), candidate(['Data cleaning'], 75)],
  ),
  rule(
    'terminology-replacement',
    [
      ['replacement', 'approved'],
      ['name', 'language', 'term'],
      ['workbook', 'spreadsheet', 'throughout'],
    ],
    ['Terminology updates'],
    'spreadsheet',
    ['spreadsheet'],
    [candidate(['Terminology updates']), candidate(['Data cleaning'], 80)],
  ),
  rule(
    'data-cleaning',
    [
      ['duplicate', 'impossible', 'missing', 'blank field'],
      ['row', 'export', 'date', 'value'],
    ],
    ['Data cleaning'],
    'spreadsheet',
    ['cleaned-data'],
    [candidate(['Data cleaning']), candidate(['Terminology updates'], 75)],
  ),
  rule(
    'directory-structuring',
    [
      ['directory', 'copied text', 'unstructured', 'jumble'],
      ['column', 'table', 'row'],
    ],
    ['Data structuring'],
    'context',
    ['spreadsheet'],
    [
      candidate(['Data structuring'], 100, { excludeTasks: ['App building'] }),
      candidate(['Data cleaning'], 75),
    ],
  ),
  rule(
    'attendance-triage',
    [
      ['attendance', 'attended', 'barely coming'],
      ['contact', 'follow up', 'outreach', 'drifting', 'prioritize'],
    ],
    ['Attendance analysis', 'Student outreach'],
    'spreadsheet',
    ['analysis'],
    [
      candidate(['Attendance analysis']),
      candidate(['Student interventions'], 80),
    ],
  ),
  rule(
    'financial-review',
    [
      ['financial statement', 'public account', 'ratio', 'reserve'],
      ['year', 'income', 'expense', 'spending', 'revenue'],
    ],
    ['Financial analysis'],
    'document',
    ['analysis'],
    [candidate(['Financial analysis']), candidate(['Grant due diligence'], 80)],
  ),
  rule(
    'grantee-comparison',
    [
      ['annual report', 'grantee'],
      ['compare', 'comparison', 'renewing', 'developed', 'evolved'],
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
      }),
    ],
  ),
  rule(
    'document-comparison',
    [
      ['agreement', 'policy', 'disclosure', 'document'],
      ['compare', 'version', 'changed', 'fee change', 'replacement agreement'],
    ],
    ['Document comparison'],
    'document',
    ['comparison'],
    [
      candidate(['Document comparison']),
      candidate(['Grant due diligence'], 80),
      citedDocuments,
    ],
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
      ['response', 'answer', 'draft'],
      ['instruction', 'overview', 'future', 'launch'],
    ],
    ['Grant drafting'],
    'document',
    ['document'],
    [candidate(['Grant drafting']), candidate(['Editing proofreading'], 75)],
  ),
  rule(
    'donor-repurposing',
    [
      ['report', 'research'],
      ['donor', 'briefing event', 'online event'],
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
      }),
    ],
  ),
  rule(
    'biography',
    [
      ['bio', 'biography'],
      ['resume', 'qualification', 'experience'],
      ['draft', 'website', 'word'],
    ],
    ['Document drafting'],
    'resume',
    ['document'],
    [
      candidate(['Document drafting'], 100, { teaching: ['bio'] }),
      candidate(['Editing proofreading'], 75),
    ],
  ),
  rule(
    'document-review',
    [
      ['review', 'check', 'proofread'],
      ['grammar', 'claim', 'tracked change', 'accept or reject'],
      ['draft', 'letter', 'document', 'word'],
    ],
    ['Editing proofreading', 'Document review'],
    'document',
    ['edited-document'],
    [candidate(['Editing proofreading', 'Document review'])],
  ),
  rule(
    'technical-plain-language',
    [
      ['technical', 'security', 'jargon'],
      ['trustee', 'board', 'nontechnical'],
      ['explain', 'understand', 'adapt', 'decision'],
    ],
    ['Plain language', 'Board communications'],
    'document',
    ['document'],
    [
      candidate(['Board communications']),
      candidate(['Plain language', 'Editing proofreading'], 80),
    ],
    { explanatory: true },
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
      candidate(['Outreach materials', 'Plain language'], 80),
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
    [candidate(['Design feedback'])],
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
      ['thread', 'exchange'],
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
      ['recording', 'transcript', 'discussion'],
      ['formal minute', 'decision', 'deadline', 'action'],
      ['committee', 'meeting', 'minute'],
    ],
    ['Meeting minutes', 'Transcription'],
    'recording',
    ['minutes'],
    [candidate(['Meeting minutes']), candidate(['Transcription'], 80)],
  ),
  rule(
    'policy-helper',
    [
      ['helper', 'assistant', 'bot'],
      ['policy', 'manual', 'leave', 'reimbursement'],
      ['answer', 'question', 'cite', 'admit'],
    ],
    ['Knowledge management', 'Custom assistants'],
    'document',
    ['assistant'],
    [
      candidate(['Custom assistants'], 100, {
        allTasks: ['Knowledge management'],
        excludeTasks: ['Workflow automation'],
        minimumStrength: 0.5,
      }),
      candidate(['Document Q&A'], 75, {
        teaching: ['citation', 'notebook'],
        excludeTasks: ['App building'],
      }),
    ],
  ),
  rule(
    'historical-document-question',
    [
      ['minute', 'document', 'source'],
      ['board', 'historical', 'years'],
      ['citation', 'find what', 'original', 'when'],
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
      ['peer', 'coordinator', 'coworker'],
      ['conversation', 'deadline', 'handoff'],
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
      ['process', 'procedure', 'handoff'],
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
      ['cross department', 'peer learning', 'sharing'],
      ['practice time', 'protected', 'experiment', 'demonstration', 'group'],
    ],
    ['Peer learning', 'Change management'],
    'context',
    [],
    [
      candidate(['Peer learning']),
      candidate(['AI policy', 'Responsible AI'], 80, {
        excludeTasks: ['Document drafting', 'Custom assistants'],
      }),
    ],
    { explanatory: true },
  ),
  rule(
    'training-media',
    [
      ['audio', 'podcast'],
      ['document', 'training pack', 'source material'],
      ['video', 'explainer', 'conversation', 'listen'],
    ],
    ['Audio generation', 'Video creation'],
    'document',
    ['audio', 'video'],
    [candidate(['Audio generation']), candidate(['Audio review'], 80)],
  ),
  rule(
    'song-generation',
    [
      ['song', 'music'],
      ['style', 'voice', 'lyric', 'version'],
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
      ['week', 'session', 'syllabus'],
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
      candidate(['Form generation']),
      candidate(['Process documentation'], 75, { allTasks: ['Client intake'] }),
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
      }),
    ],
  ),
  rule(
    'photo-editing',
    [['photo'], ['brighter', 'dark', 'exposure', 'lightroom', 'edit']],
    ['Photo editing'],
    'image',
    ['image'],
    [
      candidate(['Photo editing']),
      candidate(['Design feedback'], 75, {
        teaching: ['diagnose', 'screenshot'],
      }),
    ],
  ),
];
