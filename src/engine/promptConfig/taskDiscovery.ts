import { candidate as c, rule as r } from './operationRules';
import type { OperationRule } from '../taskIntent';

/** Requested actions with source context, including common noncanonical task wording. */
export const taskDiscovery: readonly OperationRule[] = [
  r(
    'funding-application-fit',
    [
      [
        'funding call',
        'funding notice',
        'rfp',
        'funding opportunity',
        'commissioning pack',
      ],
      ['eligibility', 'eligible', 'fit', 'spending rule', 'qualify'],
      [
        'application',
        'bid',
        'project',
        'program',
        'lay out',
        'staff role',
        'work plan',
      ],
    ],
    ['RFP review', 'Grant drafting'],
    'document',
    ['plan', 'document'],
    [
      c(['RFP review'], 110, { allTasks: ['Grant drafting'] }),
      c(['RFP review'], 85),
      c(['Grant drafting'], 80, {
        teaching: ['funder guidance', 'funder requirement'],
        when: ['application', 'attachment', 'program summary', 'write'],
      }),
      c(['Document drafting'], 75, {
        allTasks: ['Document Q&A', 'Document summary'],
        when: ['fact', 'verify', 'check', 'source'],
      }),
    ],
  ),
  r(
    'spreadsheet-formula',
    [
      ['formula', 'calculation'],
      ['sheet', 'spreadsheet', 'workbook', 'column', 'timesheet'],
    ],
    ['Spreadsheet formulas'],
    'spreadsheet',
    ['formula'],
    [
      c(['Spreadsheet formulas'], 110, {
        allTasks: ['List comparison'],
        when: ['repeat', 'repeated', 'duplicate', 'once', 'unique'],
      }),
      c(['Spreadsheet formulas'], 100, { excludeTasks: ['Data aggregation'] }),
      c(['List comparison', 'Data cleaning'], 75, {
        when: ['repeat', 'repeated', 'duplicate', 'once', 'unique'],
      }),
    ],
  ),
  r(
    'source-document-answer',
    [
      ['report', 'document', 'pdf'],
      ['question', 'answer'],
      ['main point', 'verify', 'source', 'where the answer', 'reference'],
    ],
    ['Document Q&A', 'Document summary'],
    'document',
    ['answer', 'summary'],
    [
      c(['Document Q&A'], 110, {
        allTasks: ['Document summary'],
        teaching: ['source reference', 'against the text'],
      }),
      c(['Document Q&A'], 80, {
        teaching: [
          'citation',
          'targeted document question',
          'policy pdf',
          'cited source',
        ],
        minimumStrength: 0.5,
      }),
      c(['Custom assistants'], 75, {
        allTasks: ['Responsible AI'],
        teaching: ['policy pdf'],
        minimumStrength: 0.5,
      }),
    ],
  ),
  r(
    'source-presentation',
    [
      ['slide', 'deck', 'presentation'],
      ['roadmap', 'pdf', 'document', 'strategic plan', 'paper'],
      [
        'outline',
        'draft',
        'convert',
        'turn',
        'repurpose',
        'generate',
        'presentation from',
        'slides from',
        'deck from',
      ],
    ],
    ['Presentation creation'],
    'document',
    ['presentation'],
    [
      c(['Presentation creation'], 115, {
        allTasks: ['Content repurposing'],
        teaching: ['gamma'],
      }),
      c(['Presentation creation'], 110, { teaching: ['gamma'] }),
      c(['Presentation creation'], 80, {
        excludeTasks: ['Survey analysis', 'Document Q&A'],
      }),
    ],
  ),
  r(
    'organization-visibility-audit',
    [
      ['ai', 'assistant', 'copilot'],
      ['website', 'online', 'site', 'page'],
      [
        'audit',
        'inaccurate',
        'leaves out',
        'missing',
        'old event',
        'incomplete answer',
        'miss',
        'challenge',
      ],
    ],
    ['AI search visibility'],
    'website',
    ['analysis'],
    [c(['AI search visibility'], 100, { minimumStrength: 0.5 })],
  ),
];
