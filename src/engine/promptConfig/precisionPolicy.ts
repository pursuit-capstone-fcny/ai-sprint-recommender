import type { ExpansionRefinementPolicy } from '../expandedPrecision';
export const precisionPolicy: ExpansionRefinementPolicy = {
  minimumProcedureStrength: 0.75,
  requireCompanionSourceMatch: true,
  numericChart: {
    tasks: ['Chart creation', 'Survey analysis', 'Exploratory analysis'],
    chartTerms: ['chart', 'graph', 'bar', 'histogram'],
    measureTerms: [
      'mean',
      'average',
      'score',
      'total',
      'count',
      'percentage',
      'proportion',
    ],
    requiredTask: 'Chart creation',
  },
  interviewResearch: {
    tasksAll: ['Interview preparation', 'Research'],
    conductingCues: [
      'interview subject',
      'interviewee',
      'interview the',
      'interview a',
      'interview our',
      'interview someone',
    ],
    applicantCues: [
      'interview for',
      'my interview',
      'my job interview',
      'my resume',
      'my CV',
      'cover letter',
      'my application',
    ],
    applicantTask: 'Cover letter writing',
    researchTask: 'Research',
  },
  assistantDesign: {
    assistantTerms: ['assistant', 'agent', 'bot'],
    educationTerms: ['course', 'curriculum', 'syllabus', 'learner'],
    conceptualCues: [
      'conceptual',
      'design discussion',
      'trade offs',
      'design explanation',
    ],
    learningFormat: 'explainer',
    courseTasks: [
      'Curriculum design',
      'Lesson planning',
      'Educational materials',
    ],
    assistantTask: 'Custom assistants',
  },
  immediateWriting: {
    tasks: [
      'Reimbursement documentation',
      'Document drafting',
      'Client correspondence',
      'Newsletter writing',
    ],
    setupTasks: ['Custom assistants', 'Workflow automation'],
    assistantTask: 'Custom assistants',
    assistantOutput: 'assistant',
  },
};
