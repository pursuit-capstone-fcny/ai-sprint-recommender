import type { OperationRule } from '../taskIntent';
import { candidate as c, rule as r } from './operationRules';
const voice = [c(['Brand voice'], 80, { allTasks: ['Custom assistants'] })];
const prompting = [
  c(['Prompting'], 80, {
    minimumStrength: 0.5,
    excludeTasks: ['Grant drafting', 'Difficult conversations', 'Brand naming'],
  }),
];

/** Canonical tasks and registered transfers, selected by the requested operation rather than output nouns. */
export const taskOperations: readonly OperationRule[] = [
  r(
    'presentation-creation',
    [
      ['create', 'build', 'draft', 'make', 'generate', 'design'].flatMap(
        (action) =>
          [
            'slides',
            'the slides',
            'a slide deck',
            'the slide deck',
            'a presentation',
            'the presentation',
            'a slide presentation',
            'a slideshow',
          ].map((object) => `${action} ${object}`),
      ),
    ],
    ['Presentation creation'],
    undefined,
    ['presentation'],
    [c(['Presentation creation'], 100, { requireSourceMatch: true })],
    {
      requireToolOnlyProof: true,
      phraseContinuations: [
        'for',
        'about',
        'on',
        'from',
        'with',
        'using',
        'in',
        'that',
        'which',
        'and',
        'to',
        'please',
        'quickly',
      ],
    },
  ),
  r(
    'newsletter-adaptation',
    [
      ['newsletter', 'bulletin', 'article'],
      [
        'adult learner',
        'adult learning',
        'everyday english',
        'short sentence',
        'easier english',
        'reading level',
        'discussion',
        'paragraph',
        '150 word',
      ],
    ],
    ['Newsletter writing', 'Plain language'],
    'context',
    ['document'],
    [
      c(['Newsletter writing']),
      c(['Plain language'], 80, {
        minimumStrength: 0.5,
        when: [
          'rewrite',
          'version',
          'beginner',
          'easier',
          'reading level',
          'simplify',
          '150 word',
        ],
      }),
      c(['Accessible content'], 75, {
        allTasks: ['Educational materials'],
        excludeTasks: ['Custom assistants'],
        when: [
          'visual',
          'icon',
          'parent',
          'student right',
          'version',
          'learner',
        ],
      }),
    ],
  ),
  r(
    'newsletter-drafting',
    [
      ['draft', 'write', 'create', 'compose'].flatMap((action) =>
        [
          'a newsletter',
          'the newsletter',
          'a weekly newsletter',
          'a donor newsletter',
        ].map((object) => `${action} ${object}`),
      ),
    ],
    ['Newsletter writing'],
    'context',
    ['document'],
    [c(['Newsletter writing'])],
    {
      requireToolOnlyProof: true,
      phraseContinuations: [
        'for',
        'about',
        'on',
        'from',
        'with',
        'using',
        'in',
        'that',
        'which',
        'and',
        'to',
        'please',
        'quickly',
      ],
    },
  ),
  r(
    'client-correspondence',
    [
      ['landlord', 'tenant'],
      ['letter', 'response', 'notice'],
      ['write', 'draft', 'question', 'calm'],
    ],
    ['Client correspondence', 'Document drafting'],
    'context',
    ['document'],
    [
      c(['Client correspondence']),
      c(['Document drafting'], 80, {
        allTasks: ['Role play'],
        excludeTasks: ['Difficult conversations'],
        when: ['tone', 'style', 'bio', 'resume', 'calm'],
      }),
      c(['Reimbursement documentation'], 80, {
        when: ['blank', 'placeholder', 'identifying', 'anonymous'],
      }),
      c(['Document drafting'], 75, {
        allTasks: ['Document Q&A', 'Document summary'],
        when: [
          'upload',
          'reference',
          'document',
          'overview',
          'tone',
          'calm',
          'style',
          'review',
          'edit',
          'check',
        ],
      }),
      c(['Editing proofreading'], 75, {
        when: ['review', 'edit', 'proofread', 'check'],
      }),
    ],
  ),
  r(
    'supervision-notes',
    [
      ['supervision', 'supervisor', 'administrative session'],
      ['record', 'recording', 'session'],
      ['summary', 'editable', 'note', 'computer'],
    ],
    ['Supervision documentation', 'Meeting notes'],
    'recording',
    ['summary', 'notes'],
    [
      c(['Supervision documentation']),
      c(['Meeting minutes'], 80),
      c(['Document drafting'], 75, {
        allTasks: ['Document Q&A', 'Document summary'],
        when: ['summary', 'word', 'export', 'document'],
      }),
      c(['Document summary'], 70, {
        teaching: ['speaker', 'panel'],
        whenAll: [
          ['audio', 'recording'],
          ['document', 'word', 'outline', 'detailed'],
        ],
      }),
    ],
  ),
  r(
    'briefing-rehearsal',
    [
      ['rehearse', 'practice', 'practise'],
      ['briefing', 'trustee', 'presentation'],
      ['questioner', 'respond', 'skeptical', 'explain'],
    ],
    ['Role play'],
    'context',
    ['role-play'],
    [
      c(['Role play'], 100, { excludeTasks: ['Language learning'] }),
      c(['Board communications'], 75, { minimumStrength: 0.5 }),
    ],
  ),
  r(
    'reimbursement-letter',
    [
      ['reimbursement', 'medical necessity', 'medically necessary', 'insurer'],
      ['letter', 'draft'],
      ['outline', 'placeholder', 'fact', 'treatment'],
    ],
    ['Reimbursement documentation', 'Document drafting'],
    'context',
    ['document'],
    [
      c(['Reimbursement documentation']),
      c(['Client correspondence'], 80, {
        when: [
          'letter to',
          'landlord',
          'correspondence',
          'question',
          'ask',
          'missing',
          'clarify',
          'fact',
          'confirm',
          'checklist',
        ],
      }),
      c(['Editing proofreading'], 75, {
        when: ['review', 'edit', 'proofread', 'check', 'fact', 'confirm'],
      }),
      c(['Document drafting'], 75, {
        allTasks: ['Document Q&A', 'Document summary'],
        when: [
          'word',
          'copilot',
          'overview',
          'summary',
          'outline',
          'ask',
          'missing',
        ],
      }),
    ],
  ),
  r(
    'combined-survey-analysis',
    [
      ['survey', 'questionnaire', 'rating', 'pulse check'],
      ['chart', 'graph', 'bar'],
      ['comment', 'written answer', 'written response', 'main issue', 'theme'],
    ],
    ['Chart creation', 'Qualitative analysis', 'Survey analysis'],
    'survey',
    ['chart', 'analysis'],
    [
      c(['Survey analysis'], 110, {
        allTasks: ['Chart creation', 'Qualitative analysis'],
      }),
      c(['Survey analysis'], 110, {
        allTasks: ['Chart creation'],
        teaching: ['qualitative comment'],
      }),
      c(['Survey analysis'], 85),
      c(['Chart creation'], 80, { allTasks: ['Exploratory analysis'] }),
    ],
  ),
  r(
    'survey-choice-analysis',
    [
      ['survey', 'questionnaire'],
      [
        'semicolon',
        'multi select',
        'multilingual',
        'several language',
        'several choice',
      ],
      ['graph', 'chart', 'pattern', 'analysis'],
    ],
    ['Survey analysis', 'Chart creation'],
    'spreadsheet',
    ['analysis', 'chart'],
    [
      c(['Survey analysis'], 110, { allTasks: ['Translation'] }),
      c(['Chart creation'], 85, { allTasks: ['Survey analysis'] }),
      c(['Chart creation'], 80, { allTasks: ['Exploratory analysis'] }),
      c(['Survey analysis'], 80, {
        allTasks: ['Qualitative analysis'],
        when: ['account', 'summary', 'comment', 'theme'],
      }),
    ],
  ),
  r(
    'career-alignment',
    [
      ['job description', 'competency', 'career'],
      ['level', 'progression', 'framework', 'standardize'],
    ],
    ['Career frameworks', 'Job description writing'],
    'document',
    ['document', 'spreadsheet'],
    [
      c(['Career frameworks']),
      c(['Editing proofreading'], 75, {
        when: [
          'competency',
          'framework',
          'compare',
          'review',
          'proofread',
          'edit',
          'grammar',
        ],
      }),
    ],
  ),
  r(
    'budget-consolidation',
    [
      ['budget'],
      ['folder', 'file', 'workbook', 'spreadsheet'],
      ['pull', 'consolidate', 'combine', 'master', 'copying'],
    ],
    ['Budget consolidation', 'Spreadsheet automation'],
    'spreadsheet',
    ['spreadsheet'],
    [
      c(['Budget consolidation', 'Spreadsheet automation']),
      c(['Spreadsheet formulas'], 75, {
        excludeTasks: ['List comparison'],
        whenAll: [
          ['summary', 'total'],
          ['explain', 'where the code', 'how to run'],
        ],
      }),
    ],
  ),
  r(
    'strategic-actions',
    [
      ['plan', 'priority', 'goal'],
      ['progress', 'indicator', 'measurable', 'smaller action', 'next action'],
    ],
    ['Strategic planning', 'Work planning'],
    'plan',
    ['plan', 'checklist'],
    [
      c(['Strategic planning']),
      c(['Process documentation'], 75, { excludeTasks: ['Custom assistants'] }),
    ],
  ),
  r(
    'case-tracking',
    [
      ['client', 'caseworker', 'case manager', 'patient'],
      ['milestone', 'overdue', 'due date', 'worker view', 'manager overview'],
    ],
    ['Case management', 'Dashboard design'],
    'context',
    ['spreadsheet'],
    [
      c(['Case management']),
      c(['Process documentation'], 75, { allTasks: ['Client intake'] }),
    ],
  ),
  r(
    'quick-contact-capture',
    [
      [
        'desk',
        'reception',
        'outreach worker',
        'outreach table',
        'client intake',
        'outreach session',
        'contact detail',
      ],
      ['capture', 'jot', 'field', 'record'],
      ['phone', 'thirty second', 'two minute', 'follow up', 'call them back'],
    ],
    ['Client intake', 'App building'],
    'context',
    ['app', 'spreadsheet'],
    [
      c(['Client intake'], 110, { allTasks: ['App building'] }),
      c(['Case management'], 80),
      c(['Process documentation'], 75, {
        allTasks: ['Client intake'],
        excludeTasks: ['Custom assistants'],
        when: [
          'office',
          'handoff',
          'process',
          'responsibility',
          'follow up team',
        ],
      }),
      c(['Data structuring'], 70, {
        excludeTasks: ['App building'],
        whenAll: [
          ['structured', 'column', 'tab separated'],
          ['copy', 'existing'],
        ],
      }),
    ],
  ),
  r(
    'grounded-case-note',
    [
      ['case record', 'case note', 'case-record', 'case entry'],
      ['bullet', 'visit', 'heading'],
    ],
    ['Case notes', 'Document review'],
    'context',
    ['notes'],
    [
      c(['Case notes'], 80),
      c(['Editing proofreading'], 75),
      c(['Document drafting'], 70, {
        allTasks: ['Document Q&A', 'Document summary'],
        whenAll: [
          ['anonymized', 'anonymised'],
          ['check', 'verify', 'against', 'source'],
        ],
      }),
    ],
  ),
  r(
    'employee-conversation',
    [
      ['supervisor', 'employee', 'manager', 'operations lead', 'team lead'],
      ['play', 'practice', 'practise', 'rehearse'],
      [
        'conversation',
        'wording',
        'feedback',
        'pause',
        'telling',
        'expectation',
        'push back',
        'pushing back',
      ],
    ],
    ['Role play', 'Difficult conversations'],
    'context',
    ['role-play'],
    [
      c(['Difficult conversations'], 110, {
        teaching: ['supervisor', 'employee'],
      }),
      c(['Difficult conversations'], 100),
      c(['Role play'], 80, {
        excludeTasks: [
          'Language learning',
          'Grantmaker communications',
          'Staff training',
        ],
      }),
      c(['Role play'], 75, {
        allTasks: ['Grantmaker communications'],
        whenAll: [
          ['aloud', 'spoken', 'voice'],
          ['feedback', 'stop', 'pause', 'respond'],
        ],
      }),
      c(['Role play'], 75, {
        allTasks: ['Staff training'],
        whenAll: [
          ['aloud', 'spoken', 'voice'],
          ['feedback', 'stop', 'pause', 'respond'],
        ],
      }),
    ],
  ),
  r(
    'grant-conversation',
    [
      [
        'program officer',
        'grantmaker',
        'funding decision',
        'foundation',
        'grant award',
        'grant announcement',
      ],
      ['practice', 'practise', 'conversation', 'exchange', 'rehearsal'],
      ['nonprofit', 'funding', 'grant'],
    ],
    ['Role play', 'Grantmaker communications'],
    'context',
    ['role-play'],
    [
      c(['Grantmaker communications']),
      c(['Role play'], 80, {
        excludeTasks: ['Language learning', 'Staff training'],
      }),
      c(['Role play'], 75, {
        allTasks: ['Staff training'],
        when: [
          'exchange',
          'back and forth',
          'voice',
          'spoken',
          'simulation',
          'training',
        ],
      }),
    ],
  ),
  r(
    'negotiation-preparation',
    [
      [
        'counteroffer',
        'counter offer',
        'counterproposal',
        'low offer',
        'lump sum',
      ],
      [
        'condition',
        'used',
        'equipment',
        'furniture',
        'laptop',
        'proposed agreement',
      ],
    ],
    ['Negotiation preparation'],
    'context',
    ['counteroffer'],
    [
      c(['Negotiation preparation'], 110, { minimumStrength: 0.5 }),
      c(['Role play'], 75, {
        teaching: ['grant conversation', 'performance conversation'],
      }),
      c(['Role play'], 70, {
        excludeTasks: ['Language learning', 'Staff training'],
        when: ['practice', 'practise', 'role play', 'rehearsal'],
      }),
    ],
  ),
  r(
    'guest-research',
    [
      [
        'guest',
        'interview subject',
        'campaigner',
        'campaign organiser',
        'interview the',
        'public figure',
        'public conversation',
      ],
      ['public', 'source', 'speech', 'briefing', 'research'],
    ],
    ['Research', 'Interview preparation'],
    'web',
    ['briefing', 'interview-questions'],
    [
      c(['Research'], 110, { allTasks: ['Interview preparation'] }),
      c(['Regulatory document review'], 80),
    ],
  ),
  r(
    'official-source-search',
    [
      ['government', 'official', 'regulatory', 'regulation'],
      ['guidance', 'pdf', 'source', 'original', 'source document'],
      [
        'research',
        'perplexity',
        'search',
        'government',
        'official',
        'regulatory',
      ],
    ],
    ['Research', 'Regulatory document review'],
    'web',
    ['answer'],
    [
      c(['Regulatory document review']),
      c(['Research'], 80, { allTasks: ['Interview preparation'] }),
    ],
    { precedence: 1 },
  ),
  r(
    'job-application',
    [
      [
        'cover letter',
        'applying for a job',
        'job application',
        'application letter',
        'job advert',
      ],
      ['resume', 'cv', 'experience', 'role'],
    ],
    ['Cover letter writing', 'Interview preparation'],
    'resume',
    ['document', 'interview-questions'],
    [
      c(['Cover letter writing']),
      c(['Document drafting'], 80, { teaching: ['bio', 'resume'] }),
      c(['Editing proofreading'], 75, {
        when: ['interview', 'review', 'edit', 'proofread', 'check', 'revise'],
      }),
      c(['Document drafting'], 70, {
        allTasks: ['Document Q&A', 'Document summary'],
        when: ['check', 'verify', 'catch'],
      }),
    ],
  ),
  r(
    'classroom-story',
    [
      ['character', 'mascot', 'fox', 'owl', 'illustration'],
      ['story', 'adventure', 'chapter', 'note'],
      ['class', 'classroom', 'children', 'school', 'student', 'lesson'],
    ],
    ['Storytelling', 'Image generation'],
    'context',
    ['document', 'image'],
    [
      c(['Storytelling']),
      c(['Design feedback'], 80, { teaching: ['icon', 'character'] }),
      c(['Lesson planning'], 75, { allTasks: ['Brainstorming'] }),
    ],
  ),
  r(
    'classroom-story-translation',
    [
      ['story', 'chapter'],
      ['spanish', 'translate', 'translation'],
      ['english', 'classroom', 'children'],
      ['version', 'need', 'translate'],
    ],
    ['Translation', 'Storytelling'],
    'document',
    ['translation'],
    [c(['Translation'], 100, { allTasks: ['Storytelling'] })],
  ),
  r(
    'one-off-learning-activity',
    [
      [
        'math',
        'maths',
        'numeracy',
        'escape room',
        'worksheet',
        'teaching resource',
      ],
      ['session', 'activity', 'lesson', 'tutor'],
      ['material', 'answer key', 'outline', 'timed', 'activity'],
    ],
    ['Lesson planning', 'Educational materials'],
    'curriculum',
    ['lesson'],
    [
      c(['Lesson planning'], 110, { allTasks: ['Brainstorming'] }),
      c(['Lesson planning'], 80, {
        allTasks: ['Custom assistants'],
        excludeTeaching: ['vocabulary', 'accessible personalized'],
      }),
    ],
  ),
  r(
    'volunteer-animation',
    [
      ['volunteer', 'shift'],
      ['animated', 'animation', 'storyboard', 'scene', 'welcome'],
      ['description', 'instruction', 'orientation'],
    ],
    ['Volunteer onboarding', 'Video creation'],
    'document',
    ['video'],
    [
      c(['Volunteer onboarding']),
      c(['Video creation'], 80, { allTasks: ['Audio generation'] }),
    ],
  ),
  r(
    'organizational-writing-helper',
    [
      ['helper', 'assistant', 'reusable'],
      [
        'voice',
        'tone',
        'mission',
        'naming rule',
        'rule for name',
        'approved wording',
        'writing guide',
        'language guideline',
        'writing convention',
        'cliche',
        'program name',
      ],
      ['writing', 'write', 'draft', 'announcement'],
    ],
    ['Custom assistants', 'Brand voice'],
    'context',
    ['assistant', 'document'],
    [
      c(['Brand voice'], 110, {
        allTasks: ['Custom assistants', 'Document drafting'],
        teaching: ['naming rule', 'clarification question'],
      }),
      ...voice,
      c(['Prompting'], 75, {
        teaching: ['writing sample'],
        minimumStrength: 0.5,
        whenAll: [['example', 'sample'], ['reference']],
      }),
      c(['Knowledge management'], 70, {
        allTasks: ['Process documentation'],
        minimumStrength: 0.5,
        when: ['reference', 'file', 'document'],
      }),
      c(['Workflow automation'], 70, {
        allTasks: ['Custom assistants'],
        when: ['again', 'every time', 'routine', 'later work'],
      }),
      c(['Content repurposing'], 115, {
        allTasks: ['Custom assistants'],
        when: ['op ed', 'speech', 'carousel'],
      }),
    ],
    { supersedes: ['program-naming'], preferDetectedSource: true },
  ),
  r(
    'speech-repurposing',
    [['speech'], ['op ed', 'opinion article', 'argument', 'print']],
    ['Content repurposing', 'Document drafting'],
    'document',
    ['document'],
    [
      c(['Content repurposing'], 110, { allTasks: ['Custom assistants'] }),
      c(['Brand voice'], 80, {
        allTasks: ['Custom assistants', 'Document drafting'],
      }),
      c(['Brand voice'], 80, {
        allTasks: ['Custom assistants', 'Social media writing'],
      }),
      c(['Content repurposing'], 75, {
        allTasks: ['Speechwriting'],
        when: ['voice', 'mission', 'tone'],
      }),
    ],
  ),
  r(
    'social-post-assistant',
    [
      ['linkedin', 'social media', 'social post'],
      ['post', 'announce', 'caption'],
      ['example', 'mission', 'voice', 'reusable'],
    ],
    ['Social media writing', 'Brand voice'],
    'context',
    ['assistant'],
    [
      c(['Social media writing'], 110, { allTasks: ['Custom assistants'] }),
      c(['Social media writing'], 85, {
        when: ['draft', 'revise', 'opening remark', 'outline', 'promotion'],
      }),
      c(['Brand voice'], 80, {
        allTasks: ['Custom assistants', 'Document drafting'],
      }),
      c(['Brand voice'], 75, {
        allTasks: ['Custom assistants'],
        minimumStrength: 0.5,
        whenAll: [
          ['every time', 'keep', 'recurring', 'routine'],
          ['example', 'sample', 'reference'],
        ],
      }),
      c(['Prompting'], 75, {
        teaching: ['writing sample'],
        minimumStrength: 0.5,
        whenAll: [
          ['every time', 'keep', 'recurring', 'routine'],
          ['example', 'sample', 'reference'],
        ],
      }),
      c(['Workflow automation'], 70, {
        allTasks: ['Custom assistants'],
        whenAll: [
          ['every time', 'keep', 'recurring', 'routine'],
          ['example', 'sample', 'reference'],
        ],
      }),
    ],
    { precedence: 1 },
  ),
  r(
    'researched-deck',
    [
      ['deck', 'powerpoint', 'slide'],
      ['history', 'research', 'public record'],
      ['brand', 'organization', 'board'],
    ],
    ['Presentation creation', 'Research'],
    'web',
    ['presentation'],
    [
      c(['Presentation creation'], 110, { allTasks: ['Research'] }),
      c(['Presentation creation'], 80, {
        excludeTasks: ['Survey analysis', 'Document Q&A'],
      }),
      c(['Brand voice'], 70, {
        allTasks: ['Custom assistants', 'Document drafting'],
        whenAll: [
          ['writing guide', 'language guideline', 'brand voice'],
          ['draft', 'review', 'resource'],
        ],
      }),
    ],
  ),
  r(
    'responsible-ai-explanation',
    [
      ['mistake', 'privacy', 'bias', 'overreliance', 'wrong'],
      [
        'talk',
        'explain',
        'learn',
        'judge',
        'consider',
        'discuss responsible',
        'discussing responsible',
      ],
    ],
    ['Responsible AI', 'AI literacy'],
    undefined,
    [],
    [
      c(['Responsible AI'], 110, { excludeTasks: ['Custom assistants'] }),
      c(['AI literacy'], 85),
      c(['Responsible AI'], 75, { allTasks: ['Custom assistants'] }),
      c(['AI policy'], 75, { excludeTasks: ['Document drafting'] }),
      c(['Prompting'], 75, { teaching: ['confidentiality'] }),
    ],
    { explanatory: true },
  ),
  r(
    'ai-vocabulary',
    [
      ['ai', 'machine learning', 'generative ai'],
      [
        'difference',
        'distinction',
        'differ',
        'introduction',
        'vocabulary',
        'mean the same',
      ],
    ],
    ['AI literacy'],
    undefined,
    [],
    [
      c(['AI literacy'], 110, { excludeTasks: ['Responsible AI'] }),
      c(['Responsible AI'], 80, { excludeTasks: ['Custom assistants'] }),
    ],
    { explanatory: true },
  ),
  r(
    'interim-ai-policy',
    [
      ['policy', 'guideline', 'interim note', 'interim rule'],
      ['interim', 'pending', 'experiment', 'sensitive', 'responsible'],
      [
        'staff',
        'organization',
        'trying',
        'guidance',
        'people',
        'team',
        'board',
        'manager',
      ],
    ],
    ['AI policy', 'Responsible AI'],
    undefined,
    ['policy'],
    [
      c(['AI policy'], 110, { excludeTasks: ['Document drafting'] }),
      c(['Responsible AI', 'AI policy'], 80),
    ],
    { explanatory: true },
  ),
  r(
    'improve-prompt',
    [
      ['prompt', 'request', 'brief', 'instruction'],
      ['rewrite', 'improve', 'refine', 'small change', 'follow up'],
      ['background', 'audience', 'answer', 'output', 'generic', 'context'],
    ],
    ['Prompting'],
    'context',
    ['prompt'],
    [
      c(['Prompting'], 110, {
        teaching: ['meta prompt', 'before answering', 'improve the prompt'],
        minimumStrength: 0.5,
      }),
      ...prompting,
    ],
    { explanatory: true },
  ),
  r(
    'program-naming',
    [
      ['name', 'naming'],
      ['program', 'brand', 'alternative', 'group'],
      ['question', 'welcoming', 'narrow', 'one at a time', 'feedback'],
    ],
    ['Brand naming', 'Brainstorming'],
    'context',
    ['names'],
    [
      c(['Brand naming']),
      c(['Prompting'], 80, { teaching: ['prompt'], minimumStrength: 0.5 }),
    ],
    { explanatory: true },
  ),
  r(
    'staff-day-activity',
    [
      ['staff day', 'retreat', 'department', 'finance', 'hr'],
      ['activity', 'breakout', 'facilitator'],
      ['timing', 'timed', 'minute', 'print'],
    ],
    ['Retreat planning', 'Staff training'],
    'context',
    ['plan', 'lesson'],
    [
      c(['Retreat planning']),
      c(['Lesson planning'], 75, { allTasks: ['Brainstorming'] }),
      c(['Lesson planning'], 70, {
        allTasks: ['Custom assistants'],
        excludeTasks: ['Curriculum design', 'Language learning'],
        excludeTeaching: ['vocabulary'],
        when: ['work up', 'refine', 'properly'],
      }),
    ],
  ),
  r(
    'project-workspace',
    [
      ['project', 'workspace', 'related chat'],
      ['reference', 'document', 'instruction'],
      ['context', 'together', 'organize', 'throughout'],
    ],
    ['Knowledge management'],
    'document',
    [],
    [
      c(['Knowledge management'], 110, {
        allTasks: ['Process documentation'],
        minimumStrength: 0.5,
      }),
      c(['Knowledge management'], 80, {
        excludeTasks: ['Responsible AI'],
        minimumStrength: 0.5,
      }),
    ],
    { explanatory: true },
  ),
  r(
    'saved-workflow',
    [
      ['claude', 'skill'],
      ['routine', 'workflow', 'monthly', 'skill'],
      ['invoke', 'package', 'copying', 'save', 'again', 'reuse'],
    ],
    ['Workflow automation', 'Custom assistants'],
    'context',
    ['assistant'],
    [
      c(['Workflow automation'], 110, { allTasks: ['Custom assistants'] }),
      c(['Knowledge management'], 75, {
        allTasks: ['Process documentation'],
        minimumStrength: 0.5,
      }),
      c(['Custom assistants'], 70, {
        allTasks: ['Knowledge management', 'Brand voice'],
        when: ['reference', 'material', 'source', 'instruction'],
      }),
    ],
  ),
  r(
    'recording-summary',
    [
      ['recording', 'panel', 'speaker'],
      ['summary', 'outline', 'said', 'summarize'],
    ],
    ['Document summary', 'Transcription'],
    'recording',
    ['summary'],
    [
      c(['Document summary'], 110, { teaching: ['speaker', 'panel'] }),
      c(['Transcription'], 85, { allTasks: ['Meeting notes'] }),
      c(['Document summary'], 80, {
        allTasks: ['Document drafting', 'Document Q&A'],
      }),
      c(['Document Q&A'], 75, {
        teaching: ['collection of source documents', 'citation'],
        excludeTasks: ['App building'],
      }),
    ],
  ),
  r(
    'visual-icon-critique',
    [
      ['icon', 'logo', 'image', 'flyer', 'poster'],
      ['critique', 'visual direction', 'muddy', 'readability', 'balance'],
    ],
    ['Design feedback'],
    'image',
    ['image'],
    [
      c(['Design feedback'], 100, { excludeTasks: ['Outreach materials'] }),
      c(['Design feedback'], 80, {
        allTasks: ['Outreach materials'],
        when: ['poster', 'flier', 'flyer', 'handout', 'print', 'printed'],
      }),
    ],
  ),
];
