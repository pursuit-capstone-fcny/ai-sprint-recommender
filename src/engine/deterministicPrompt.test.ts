import { describe, expect, it } from 'vitest';
import {
  parsePublicCatalog,
  type PublicCatalogItem,
} from '../contracts/publicCatalog';
import { recommendVideos } from './deterministicPrompt';
import type { PromptOptions } from './prompt';

const lesson = (
  id: number,
  tasks: string[],
  description: string,
  tools: string[] = [],
): PublicCatalogItem => ({
  youtubeId: `lesson_${String(id).padStart(4, '0')}`,
  title: description,
  description,
  tasks,
  tools,
  functionAreas: [],
  status: 'active',
  startHere: false,
  addedAt: null,
  lengthSeconds: 100,
});
function fixture(items: PublicCatalogItem[]) {
  const catalog = parsePublicCatalog({
    schemaVersion: 1,
    catalogVersion: `sha256:${'e'.repeat(64)}`,
    items,
    tasks: [...new Set(items.flatMap((row) => row.tasks))],
    tools: [...new Set(items.flatMap((row) => row.tools))],
    functionAreas: [],
    adjacentTools: [],
    synonyms: [],
  });
  const options: PromptOptions = {
    language: { tasks: [], artifacts: [] },
    workflows: { artifacts: [], workflows: [] },
    learningFormats: { formats: [], videos: [] },
    instructions: items.flatMap((item) =>
      item.tasks.map((task) => ({
        youtubeId: item.youtubeId,
        task,
        form: 'demonstrated',
      })),
    ),
  };
  const run = (prompt: string, limit = 8) =>
    recommendVideos(catalog, { prompt, limit }, options);
  return { catalog, options, run };
}
const ids = (result: ReturnType<typeof recommendVideos>) =>
  result.recommendations.map((row) => row.item.youtubeId);

describe('deterministic free-text recommendations', () => {
  it.each([
    'Clean duplicate spreadsheet rows, a lecture will not help.',
    'Clean duplicate spreadsheet rows, a presentation is not our goal.',
    'Clean duplicate spreadsheet rows, making an illustration is a different job.',
  ])('keeps a comma-separated rejected alternative scoped: %s', (prompt) => {
    const cleaning = lesson(
      1,
      ['Data cleaning'],
      'Clean duplicate spreadsheet rows.',
    );
    const { run } = fixture([cleaning]);
    expect(ids(run(prompt))).toEqual([cleaning.youtubeId]);
  });

  it.each(['I want to use', 'we prefer', 'please use'])(
    'ends a tool-exclusion list at a positive request: %s',
    (request) => {
      const excel = lesson(
        1,
        ['Data cleaning'],
        'Clean duplicate spreadsheet rows.',
        ['Microsoft Excel'],
      );
      const claude = lesson(
        2,
        ['Data cleaning'],
        'Clean duplicate spreadsheet rows.',
        ['Claude'],
      );
      const { run } = fixture([excel, claude]);
      const result = run(
        `Clean duplicate spreadsheet rows without using Excel, ${request} Claude.`,
      );
      expect(result.interpretation.excludedTools).toEqual(['Microsoft Excel']);
      expect(ids(result)).toEqual([claude.youtubeId]);
    },
  );

  it('still excludes every tool in a comma-separated rejection list', () => {
    const items = ['Microsoft Excel', 'ChatGPT', 'Claude'].map((tool, i) =>
      lesson(i + 1, ['Data cleaning'], 'Clean duplicate spreadsheet rows.', [
        tool,
      ]),
    );
    const { run } = fixture(items);
    const result = run(
      'Clean duplicate spreadsheet rows without using Excel, ChatGPT, or Claude.',
    );
    expect(result.interpretation.excludedTools).toEqual([
      'ChatGPT',
      'Claude',
      'Microsoft Excel',
    ]);
    expect(ids(result)).toEqual([]);
  });

  it.each(['with no network', 'without a network'])(
    'requires offline teaching evidence for a negative environment requirement: %s',
    (environment) => {
      const cloud = lesson(
        1,
        ['Data cleaning'],
        'Clean duplicate spreadsheet rows.',
        ['Claude'],
      );
      const local = lesson(
        2,
        ['Data cleaning'],
        'Clean duplicate spreadsheet rows offline.',
        ['Local Lab'],
      );
      const { run } = fixture([cloud, local]);
      expect(
        ids(run(`Clean duplicate spreadsheet rows ${environment}.`)),
      ).toEqual([local.youtubeId]);
      expect(
        ids(run('Clean duplicate spreadsheet rows, not without a network.')),
      ).toContain(cloud.youtubeId);
    },
  );

  it.each(['Microsoft Excel', 'Claude'])(
    'preserves canonical-task abstention for an exclusive tool: %s',
    (tool) => {
      const excel = lesson(
        1,
        ['Data cleaning'],
        'Clean duplicate spreadsheet rows.',
        ['Microsoft Excel'],
      );
      const claude = lesson(
        2,
        ['Data cleaning'],
        'Clean duplicate spreadsheet rows.',
        ['Claude'],
      );
      const { run } = fixture([excel, claude]);
      expect(ids(run(`Data cleaning using only ${tool}.`))).toEqual([]);
      expect(ids(run(`Data cleaning using ${tool}.`))).toContain(
        claude.youtubeId,
      );
    },
  );

  it.each([
    {
      name: 'traceable financial figures',
      main: ['Financial analysis'],
      part: ['Document Q&A'],
      teaching: 'Ask a targeted document question.',
      prompt:
        'Review four years of public accounts and trace the ratios to source references.',
      control: 'Review four years of public accounts and explain the ratios.',
    },
    {
      name: 'funding-criteria review',
      main: ['Grant drafting'],
      part: ['RFP review', 'Work planning'],
      prompt: 'Write foundation answers about future plans using the criteria.',
      control: 'Write foundation answers about future plans.',
    },
    {
      name: 'briefing-source drafting',
      main: ['Webinar planning'],
      part: ['Document summary', 'Document drafting', 'Document Q&A'],
      prompt: 'Use a report for a donor event with posts and presenter notes.',
      control: 'Use a report for a donor event with posts.',
    },
    {
      name: 'briefing-source summarization',
      main: ['Webinar planning'],
      part: ['Document summary'],
      teaching: 'Summarize a panel speaker.',
      prompt: 'Use a report for a donor event with posts and presenter notes.',
      control: 'Use a report for a donor event with posts.',
    },
    {
      name: 'handover intake records',
      main: ['Process documentation'],
      part: ['Client intake', 'App building'],
      prompt:
        'Follow-ups get lost at reception. Document a handover checklist covering what is recorded.',
      control:
        'Document a handover checklist of responsibilities at reception.',
    },
    {
      name: 'handover follow-up records',
      main: ['Process documentation'],
      part: ['Student interventions', 'App building'],
      prompt:
        'Follow-ups get lost at reception. Document a handover checklist covering what is recorded.',
      control:
        'Document a handover checklist of responsibilities at reception.',
    },
    {
      name: 'reimbursement fact elicitation',
      main: ['Reimbursement documentation'],
      part: ['Client correspondence'],
      prompt:
        'Draft a reimbursement letter about treatment and ask what is missing.',
      control: 'Draft a reimbursement letter about treatment.',
    },
    {
      name: 'checked reimbursement claims',
      main: ['Reimbursement documentation'],
      part: ['Editing proofreading'],
      prompt:
        'Draft a reimbursement letter about treatment and get it checked.',
      control: 'Draft a reimbursement letter about treatment.',
    },
    {
      name: 'spoken grant simulation transfer',
      main: ['Difficult conversations'],
      part: ['Role play', 'Grantmaker communications'],
      prompt:
        'A manager wants to practice a conversation aloud and get feedback.',
      control: 'A manager wants to practice a conversation and get feedback.',
    },
    {
      name: 'spoken staff simulation transfer',
      main: ['Difficult conversations'],
      part: ['Role play', 'Staff training'],
      prompt:
        'A manager wants to practice a conversation aloud and get feedback.',
      control: 'A manager wants to practice a conversation and get feedback.',
    },
    {
      name: 'recurring peer facilitation',
      main: ['Peer learning'],
      part: ['Retreat planning'],
      prompt:
        'Organize a mixed group with protected practice time and monthly sessions.',
      control: 'Organize a mixed group with protected practice time.',
    },
    {
      name: 'budget formula coaching',
      main: ['Budget consolidation', 'Spreadsheet automation'],
      part: ['Spreadsheet formulas'],
      prompt:
        'Pull budget files from a folder into a summary and explain how to run the code.',
      control: 'Pull budget files from a folder into a summary.',
    },
    {
      name: 'intake data structuring',
      main: ['Client intake', 'App building'],
      part: ['Data structuring'],
      prompt:
        'Capture structured fields on a phone at an outreach table and copy them into an existing system.',
      control: 'Capture fields on a phone at an outreach table.',
    },
    {
      name: 'intake team handoff',
      main: ['Client intake', 'App building'],
      part: ['Process documentation', 'Client intake'],
      prompt:
        'Capture fields on a phone at an outreach table for the follow-up team.',
      control: 'Capture fields on a phone at an outreach table.',
    },
    {
      name: 'comparison source-boundary testing',
      main: ['Document comparison'],
      part: ['Custom assistants', 'Knowledge management', 'Responsible AI'],
      teaching: 'Test answers against a policy PDF.',
      prompt:
        'Compare agreement versions and find the exact passage for a specific question.',
      control: 'Compare agreement versions.',
    },
    {
      name: 'comparison cited-source lookup',
      main: ['Document comparison'],
      part: ['Document Q&A', 'App building'],
      teaching: 'Retrieve a cited source.',
      prompt:
        'Compare agreement versions and find the exact passage for a specific question.',
      control: 'Compare agreement versions.',
    },
    {
      name: 'comparison note review',
      main: ['Document comparison'],
      part: ['Editing proofreading'],
      prompt: 'Compare policy versions and review a customer note for claims.',
      control: 'Compare policy versions.',
    },
    {
      name: 'retested handbook lookup',
      main: ['Custom assistants', 'Knowledge management'],
      part: ['Document Q&A', 'Document drafting', 'Document summary'],
      prompt:
        'Build a policy helper to answer handbook questions, change the instructions and try the same questions again.',
      control: 'Build a policy helper to answer handbook questions.',
    },
    {
      name: 'training-media source drafting',
      main: ['Audio generation'],
      part: ['Document summary', 'Document drafting', 'Document Q&A'],
      prompt:
        'Use a training document for a podcast and video overview with a description and learning objectives.',
      control: 'Use a training document for a podcast and video overview.',
    },
    {
      name: 'training-media source summarization',
      main: ['Audio generation'],
      part: ['Document summary'],
      teaching: 'Summarize a panel speaker.',
      prompt:
        'Use a training document for a podcast and video overview with a description and learning objectives.',
      control: 'Use a training document for a podcast and video overview.',
    },
    {
      name: 'training-media scripting',
      main: ['Audio generation'],
      part: ['Scriptwriting', 'Video creation'],
      prompt:
        'Use a training document for a podcast and video overview with a description and learning objectives.',
      control: 'Use a training document for a podcast and video overview.',
    },
  ])(
    'AC-12.20 scopes $name',
    ({
      main,
      part,
      prompt,
      control,
      teaching = 'Teach a transferable component.',
    }) => {
      const direct = lesson(
        1,
        main,
        'Teach the primary method with supervisor context.',
      );
      const component = lesson(2, part, teaching);
      const { run } = fixture([component, direct]);
      expect(ids(run(prompt))).toEqual([direct.youtubeId, component.youtubeId]);
      expect(ids(run(control))).toEqual([direct.youtubeId]);
    },
  );
  it('AC-12.20 separates concrete peer-group boundaries from risk and adoption discussion', () => {
    const group = lesson(1, ['Peer learning'], 'Organize peer practice.');
    const policy = lesson(2, ['AI policy'], 'Set interim boundaries.');
    const risks = lesson(
      3,
      ['Responsible AI'],
      'Explain concerns and adoption barriers.',
    );
    const { run } = fixture([risks, policy, group]);
    expect(
      ids(
        run(
          'Organize a mixed group with protected practice time and safe boundaries.',
        ),
      ),
    ).toEqual([group.youtubeId, policy.youtubeId]);
    expect(
      ids(
        run(
          'A mixed group has stopped experimenting. Plan protected practice time.',
        ),
      ),
    ).toContain(risks.youtubeId);
  });
  it('AC-12.20 keeps referral and citation instructions outside relative question limitations', () => {
    const helper = lesson(
      1,
      ['Custom assistants', 'Knowledge management'],
      'Configure a handbook helper.',
    );
    const project = lesson(
      2,
      ['Knowledge management', 'Process documentation'],
      'Organize handbook context.',
    );
    const cite = lesson(
      3,
      ['Document Q&A', 'App building'],
      'Retrieve a cited source.',
    );
    const { run } = fixture([cite, project, helper]);
    const referral = run(
      'Build a policy assistant to answer handbook questions. Try questions that are not answered there and make it refer those to a person.',
    );
    expect(ids(referral)).toContain(project.youtubeId);
    expect(ids(referral)[0]).toBe(helper.youtubeId);
    const citation = run(
      'Build a policy assistant to refuse questions it should not see and show a source.',
    );
    expect(ids(citation)).toContain(cite.youtubeId);
    const excluded = run(
      'Build a policy assistant to answer handbook questions. Do not use Document Q&A.',
    );
    expect(excluded.interpretation.excludedTasks).toContain('Document Q&A');
    expect(ids(excluded)).not.toContain(cite.youtubeId);
    expect(ids(excluded)).toContain(helper.youtubeId);
  });

  it.each([
    {
      task: 'Grant drafting',
      prompt:
        'Help us write short foundation answers about future plans from our instructions.',
    },
    {
      task: 'Webinar planning',
      prompt:
        'Use a research report for an online briefing for supporters with invitation posts.',
    },
    {
      task: 'Data structuring',
      prompt:
        'The exhibitor titles are stuck onto names. Put them in separate columns.',
    },
    {
      task: 'Process documentation',
      prompt: 'Document our way of working as a handover checklist.',
    },
    {
      task: 'Difficult conversations',
      prompt:
        'An operations lead needs to practice a difficult conversation with feedback.',
      teaching: 'Practice a supervisor conversation.',
    },
    {
      task: 'AI policy',
      prompt:
        'People need an interim note about safe AI experiments and when to ask a manager.',
    },
    {
      task: 'Editing proofreading',
      prompt:
        'Check this Word file with tracked edits and comments on unsupported claims.',
    },
    {
      task: 'Document Q&A',
      prompt:
        'Which year did the board approve this in the minutes? Show the evidence.',
      teaching: 'Inspect a citation to the source minutes.',
    },
    {
      task: 'Client intake',
      extra: ['App building'],
      prompt: 'Capture fields on a phone at an outreach table for follow-up.',
    },
    {
      task: 'AI literacy',
      prompt: 'Explain how machine learning and generative AI differ.',
    },
    {
      task: 'Grantmaker communications',
      prompt: 'Practice a grant award conversation with a nonprofit leader.',
    },
    {
      task: 'Qualitative analysis',
      extra: ['Report generation'],
      prompt:
        'Propose analysis questions for comments and assemble an executive brief.',
      teaching: 'Select analysis questions and manually assemble a summary.',
    },
    {
      task: 'Email automation',
      prompt:
        'Store scanned invoice email attachments in a folder and send uncertain readings to a person.',
    },
  ])(
    'AC-12.19 recognizes ordinary source/action wording: $task',
    ({ task, extra = [], prompt, teaching = 'Teach the primary method.' }) => {
      const main = lesson(1, [task, ...extra], teaching);
      const unrelated = lesson(2, ['Music generation'], 'Create a soundtrack.');
      const result = fixture([unrelated, main]).run(prompt);
      expect(result.interpretation.tasks).toContain(task);
      expect(ids(result)).toEqual([main.youtubeId]);
    },
  );
  it('AC-12.19 selects a complete visibility audit over incidental leave-policy wording', () => {
    const audit = lesson(
      1,
      ['AI search visibility'],
      'Audit answers about event pages.',
    );
    const helper = lesson(
      2,
      ['Custom assistants', 'Knowledge management'],
      'Configure a handbook helper.',
    );
    const { run } = fixture([helper, audit]);
    const result = run(
      'An AI assistant leaves out events from our website. Challenge its answers against the page.',
    );
    expect(result.interpretation.tasks).toEqual(['AI search visibility']);
    expect(ids(result)).toEqual([audit.youtubeId]);
    expect(
      ids(
        run(
          'Build an assistant to answer annual leave questions from a policy manual.',
        ),
      ),
    ).toEqual([helper.youtubeId]);
  });
  it('AC-12.19 keeps attendance as the goal and respects a rejected app method', () => {
    const attendance = lesson(
      1,
      ['Attendance analysis'],
      'Prioritize attendance follow-up.',
    );
    const clean = lesson(2, ['Data cleaning'], 'Inspect missing values.');
    const app = lesson(
      3,
      ['Student interventions', 'App building'],
      'Track student interventions in an app.',
    );
    const { catalog, options } = fixture([app, clean, attendance]);
    const run = (prompt: string) =>
      recommendVideos(
        {
          ...catalog,
          synonyms: [
            { alias: 'build an app', category: 'task', target: 'App building' },
          ],
        },
        { prompt },
        options,
      );
    const result = run(
      'Group attendance bands and call people first. Flag missing or strange values. Do not build an app.',
    );
    expect(result.interpretation.tasks).toContain('Attendance analysis');
    expect(result.interpretation.excludedTasks).toContain('App building');
    expect(ids(result)).toEqual([attendance.youtubeId, clean.youtubeId]);
    expect(
      ids(run('Group attendance bands and contact people for follow-up.')),
    ).toContain(app.youtubeId);
  });
  it('AC-12.19 recognizes conditional hours added for one person before generic formula methods', () => {
    const total = lesson(
      1,
      ['Data aggregation', 'Spreadsheet formulas'],
      'Total durations for matching names.',
    );
    const formula = lesson(
      2,
      ['Spreadsheet formulas'],
      'Generate and explain a formula.',
    );
    const result = fixture([formula, total]).run(
      'In Sheets, add hours for one person with matching rows and explain the formula.',
    );
    expect(result.interpretation.tasks).toContain('Data aggregation');
    expect(ids(result)).toEqual([total.youtubeId, formula.youtubeId]);
  });
  it('AC-12.19 treats an unread document as supplied material while preserving imperative exclusions', () => {
    const media = lesson(
      1,
      ['Audio generation', 'Video creation'],
      'Generate training overviews from a document.',
    );
    const music = lesson(2, ['Music generation'], 'Create a song.');
    const { run } = fixture([music, media]);
    const result = run(
      'Staff do not read this training document. We want a podcast and video overview from it.',
    );
    expect(ids(result)).toEqual([media.youtubeId]);
    expect(result.interpretation.sourceMaterials).toEqual(['document']);
    expect(result.interpretation.desiredOutputs).toEqual(['audio', 'video']);
    expect(
      ids(
        run(
          'Do not read this document or create a podcast. Generate a song with lyrics.',
        ),
      ),
    ).toEqual([music.youtubeId]);
  });
  it('AC-12.19 requires the named editor when its controls are requested', () => {
    const native = lesson(
      1,
      ['Photo editing'],
      'Fix a dark photo and crop it.',
      ['Adobe Lightroom'],
    );
    const other = lesson(
      2,
      ['Photo editing'],
      'Fix a dark photo and crop it.',
      ['Canva'],
    );
    const critique = lesson(
      3,
      ['Design feedback'],
      'Diagnose a screenshot and background.',
    );
    const { run } = fixture([critique, other, native]);
    expect(
      ids(
        run(
          'I use Adobe Lightroom and need guidance through its exposure, masking and crop controls for a dark photo.',
        ),
      ),
    ).toEqual([native.youtubeId]);
    expect(
      ids(
        run(
          'A dark photo needs crop and background advice; Lightroom could help.',
        ),
      ),
    ).toContain(critique.youtubeId);
    expect(
      ids(
        run(
          'I do not use Adobe Lightroom or its controls. Make a dark photo brighter in Canva.',
        ),
      ),
    ).toEqual([other.youtubeId]);
  });
  it('AC-12.19 distinguishes ordinary numbers from the Numbers application', () => {
    const table = lesson(
      1,
      ['Data structuring'],
      'Separate an unstructured list into columns.',
      ['Apple Numbers'],
    );
    const { run } = fixture([table]);
    expect(
      run('Put the invoice number into columns from an unstructured list.')
        .interpretation.tools,
    ).not.toContain('Apple Numbers');
    expect(
      run('Put an unstructured list into columns in Apple Numbers.')
        .interpretation.tools,
    ).toContain('Apple Numbers');
    expect(
      run('Put an unstructured list into columns using Numbers.').interpretation
        .tools,
    ).toContain('Apple Numbers');
  });
  it('AC-12.19 preserves supplied slides when the requested output is a written grant answer', () => {
    const draft = lesson(
      1,
      ['Grant drafting'],
      'Draft an answer from foundation guidance.',
    );
    const { catalog, options } = fixture([draft]);
    const result = recommendVideos(
      catalog,
      {
        prompt:
          'I have slides about our service. Help write foundation answers about future plans.',
      },
      {
        ...options,
        workflows: {
          artifacts: [
            {
              id: 'presentation',
              label: 'Slides',
              aliases: ['slides'],
              tasks: [],
            },
          ],
          workflows: [],
        },
      },
    );
    expect(result.interpretation.sourceMaterials).toEqual(['presentation']);
    expect(result.interpretation.desiredOutputs).toEqual(['document']);
    expect(ids(result)).toEqual([draft.youtubeId]);
  });
  it('AC-12.19 preserves creation and translation outputs in a classroom story request', () => {
    const story = lesson(
      1,
      ['Storytelling', 'Image generation', 'Translation'],
      'Create chapter illustrations and translate a classroom story.',
    );
    const design = lesson(2, ['Design feedback'], 'Refine an icon.');
    const parents = lesson(
      3,
      ['Accessible content', 'Educational materials'],
      'Adapt visuals for parents.',
    );
    const { run } = fixture([parents, design, story]);
    const result = run(
      'Plan a classroom fox story with chapter pictures and a Spanish translation for families.',
    );
    expect(result.interpretation.sourceMaterials).toEqual(['context']);
    expect(result.interpretation.desiredOutputs).toEqual([
      'document',
      'image',
      'translation',
    ]);
    expect(ids(result)[0]).toEqual(story.youtubeId);
    expect(ids(result)).toEqual(
      expect.arrayContaining([
        story.youtubeId,
        design.youtubeId,
        parents.youtubeId,
      ]),
    );
    const existing = run(
      'Translate existing English story chapters into Spanish.',
    );
    expect(existing.interpretation.sourceMaterials).toEqual(['document']);
    expect(existing.interpretation.desiredOutputs).toEqual(['translation']);
    expect(ids(existing)).toEqual([story.youtubeId]);
  });
  it('AC-12.19 retains useful audio-quotation components without substituting an overview', () => {
    const speaker = lesson(
      1,
      ['Document summary'],
      'Summarize a panel speaker.',
    );
    const transcript = lesson(
      2,
      ['Transcription', 'Meeting notes'],
      'Export a recording transcript.',
    );
    const check = lesson(
      3,
      ['Document Q&A', 'Document drafting', 'Document summary'],
      'Check wording against source text.',
    );
    const overview = lesson(
      4,
      ['Document Q&A'],
      'Ask a collection of source documents and preview an overview.',
    );
    const { run } = fixture([overview, check, transcript, speaker]);
    const result = run(
      'From this panel audio, check which speaker used these quotations and locate the wording.',
    );
    expect(ids(result)).toEqual([
      speaker.youtubeId,
      transcript.youtubeId,
      check.youtubeId,
    ]);
    expect(result.interpretation.sourceMaterials).toEqual(['recording']);
    expect(result.interpretation.desiredOutputs).not.toContain('summary');
    expect(
      result.recommendations.every((x) =>
        x.reason.includes('transferable component'),
      ),
    ).toBe(true);
    expect(ids(run('Summarize this panel recording in an outline.'))).toContain(
      overview.youtubeId,
    );
  });
  it('AC-12.19 keeps reusable writing-helper setup ahead of incidental speech repurposing', () => {
    const configure = lesson(
      1,
      [
        'Content repurposing',
        'Custom assistants',
        'Brand voice',
        'Document drafting',
      ],
      'Configure writing conventions and turn a speech into an op-ed.',
    );
    const broadcast = lesson(
      2,
      ['Content repurposing', 'Speechwriting'],
      'Turn a report into a webinar and opening remarks.',
    );
    const result = fixture([broadcast, configure]).run(
      'Create a writing helper with a writing guide to turn our speech into an op-ed; keep reference files for later work.',
    );
    expect(result.interpretation.tasks).toEqual([
      'Custom assistants',
      'Brand voice',
    ]);
    expect(result.interpretation.desiredOutputs).toEqual([
      'assistant',
      'document',
    ]);
    expect(ids(result)).toEqual([configure.youtubeId]);
  });

  it.each([
    {
      name: 'feasibility source checks',
      direct: ['RFP review', 'Grant drafting'],
      partial: ['Document drafting', 'Document Q&A', 'Document summary'],
      teaching: 'Check source facts while drafting.',
      prompt:
        'Check which facts we must supply for a bid under this commissioning pack and its eligibility rules.',
      control:
        'Assess eligibility and equipment needs for a bid under this commissioning pack.',
    },
    {
      name: 'survey narrative components',
      direct: ['Survey analysis', 'Translation'],
      partial: ['Survey analysis', 'Qualitative analysis'],
      teaching: 'Analyze feedback themes.',
      prompt:
        'Analyze this semicolon questionnaire into graphs and a short account of what people liked.',
      control: 'Analyze this semicolon questionnaire into graphs.',
    },
    {
      name: 'attendance follow-up tracking',
      direct: ['Attendance analysis'],
      partial: ['Case management', 'Spreadsheet generation'],
      teaching: 'Track milestones and next dates.',
      prompt:
        'Use poor attendance groups to contact participants and record follow-up dates.',
      control: 'Use poor attendance groups to contact participants.',
    },
    {
      name: 'source-grounded application review',
      direct: ['Cover letter writing'],
      partial: ['Document drafting', 'Document Q&A', 'Document summary'],
      teaching: 'Check source references in draft documents.',
      prompt:
        'Use my CV and job advert for a letter and catch unsupported claims.',
      control:
        'Use my CV and job advert for a letter, leaving placeholders for unknown facts.',
    },
    {
      name: 'iterative staff activities',
      direct: ['Retreat planning'],
      partial: ['Lesson planning', 'Custom assistants'],
      teaching: 'Refine a lesson-planning GPT activity.',
      prompt:
        'For a timed staff day activity with finance, help me work up and refine one exercise.',
      control:
        'For a timed staff day activity with finance, provide a printable facilitator sheet.',
    },
    {
      name: 'recording-to-document summary components',
      direct: ['Supervision documentation'],
      partial: ['Document summary'],
      teaching: 'Summarize a panel speaker.',
      prompt:
        'Turn a supervisor session audio recording into an editable Word note.',
      control:
        'We record supervision sessions and need an editable summary on a computer.',
    },
    {
      name: 'reference organization for writing helpers',
      direct: ['Brand voice', 'Custom assistants', 'Document drafting'],
      partial: ['Knowledge management', 'Process documentation'],
      teaching: 'Organize chats and reference files.',
      prompt: 'Build a writing helper with naming rules and reference files.',
      control: 'Build a writing helper with naming rules.',
    },
    {
      name: 'repeated writing workflows',
      direct: ['Brand voice', 'Custom assistants', 'Document drafting'],
      partial: ['Workflow automation', 'Custom assistants'],
      teaching: 'Invoke a saved repeated workflow.',
      prompt:
        'Build a writing helper with naming rules that we can invoke again.',
      control: 'Build a reusable writing helper with naming rules.',
    },
    {
      name: 'tracked review and factual source checks',
      direct: ['Editing proofreading', 'Document review'],
      partial: ['Document drafting', 'Document Q&A', 'Document summary'],
      teaching: 'Check draft claims against source references.',
      prompt:
        'Check grammar in this Word letter with tracked changes and comments.',
      control:
        'Check grammar in this Word letter with comments that we can accept or reject.',
    },
    {
      name: 'tracked review and writing conventions',
      direct: ['Editing proofreading', 'Document review'],
      partial: ['Brand voice', 'Custom assistants', 'Document drafting'],
      teaching: 'Set unwanted writing conventions.',
      prompt:
        'Check grammar in this Word letter with tracked changes and comments.',
      control:
        'Check grammar in this Word letter with comments that we can accept or reject.',
    },
    {
      name: 'numeric checks in scanned reports',
      direct: ['Survey analysis', 'Qualitative analysis', 'Report generation'],
      partial: ['Chart creation', 'Survey analysis'],
      teaching: 'Plot scores and check the raw data.',
      prompt:
        'Make a report from scanned feedback ratings and correct analysis errors.',
      control:
        'Make a report from scanned feedback ratings using the previous layout.',
    },
    {
      name: 'debugging generated forms',
      direct: ['Form generation', 'Evaluation design'],
      partial: ['Code debugging'],
      teaching: 'Debug code with its error message.',
      prompt:
        'Generate a Google Form from a rubric and debug the script error.',
      control: 'Generate a Google Form from a rubric.',
    },
    {
      name: 'explicit negotiation rehearsal',
      direct: ['Negotiation preparation'],
      partial: ['Role play'],
      teaching: 'Practice a manager conversation with feedback.',
      prompt:
        'Prepare a counterproposal for used equipment and practice the buyer conversation.',
      control:
        'Prepare a counterproposal for used equipment before the buyer conversation.',
    },
    {
      name: 'reference-backed saved routines',
      direct: ['Workflow automation', 'Custom assistants'],
      partial: ['Custom assistants', 'Knowledge management', 'Brand voice'],
      teaching: 'Configure an internal reference guidebook assistant.',
      prompt:
        'Package a monthly Claude routine to invoke using reference material.',
      control: 'Package a monthly Claude routine to invoke.',
    },
    {
      name: 'refining curriculum activities',
      direct: ['Custom assistants', 'Lesson planning'],
      partial: [
        'Lesson planning',
        'Custom assistants',
        'Educational materials',
      ],
      teaching: 'Configure lesson checkpoints and learning goals.',
      prompt:
        'Build a Playlab curriculum activity assistant and refine suggestions for an age group.',
      control: 'Build a Playlab curriculum activity assistant.',
    },
    {
      name: 'anonymized case source checks',
      direct: ['Case notes'],
      partial: ['Document drafting', 'Document Q&A', 'Document summary'],
      teaching: 'Verify a draft against its source.',
      prompt:
        'Turn anonymised visit bullets into a case entry and check every sentence against the source.',
      control:
        'Turn visit bullets into a case entry and check every sentence against the source.',
    },
    {
      name: 'counting distinct participants',
      direct: ['List comparison'],
      partial: ['Spreadsheet formulas'],
      teaching: 'Generate a formula from a plain-language requirement.',
      prompt:
        'Find new organizations across event files and count those who came only once.',
      control: 'Find new organizations across event files.',
    },
    {
      name: 'writing guides during branded presentations',
      direct: ['Presentation creation', 'Research'],
      partial: ['Brand voice', 'Custom assistants', 'Document drafting'],
      teaching: 'Configure writing guidelines.',
      prompt:
        'Use public history for an organization PowerPoint draft with our writing guide.',
      control: 'Use public history for an organization PowerPoint draft.',
    },
    {
      name: 'data quality in a reporting workflow',
      direct: ['Exploratory analysis', 'Report generation', 'Chart creation'],
      partial: ['Data cleaning'],
      teaching: 'Inspect missing and implausible values.',
      prompt:
        'Explore patterns in a dataset, check gaps, create charts and write an article.',
      control:
        'Explore patterns in a dataset, create charts and write an article.',
    },
    {
      name: 'grant drafting requires a drafting component',
      direct: ['RFP review', 'Grant drafting'],
      partial: ['Grant drafting'],
      teaching: 'Use funder guidance to draft an LOI.',
      prompt:
        'Assess eligibility under this commissioning pack for an application and write the required sections.',
      control: 'Assess eligibility under this commissioning pack for a bid.',
    },
    {
      name: 'spoken staff-simulation transfers',
      direct: ['Grantmaker communications'],
      partial: ['Role play', 'Staff training'],
      teaching: 'Run a spoken employer simulation.',
      prompt:
        'Practice a nonprofit funding conversation as a foundation with a back-and-forth spoken exchange.',
      control:
        'Practice a nonprofit funding conversation as a foundation, pausing the scene when stuck.',
    },
    {
      name: 'outreach design transfers require a relevant asset',
      direct: ['Design feedback'],
      partial: ['Design feedback', 'Outreach materials'],
      teaching: 'Refine flier spacing and sign-up wording.',
      prompt: 'Critique spacing in this screenshot of a poster.',
      control: 'Critique shapes and spacing in this screenshot of an icon.',
    },
    {
      name: 'handbook context and escalation',
      direct: ['Custom assistants', 'Knowledge management'],
      partial: ['Knowledge management', 'Process documentation'],
      teaching: 'Organize related reference files.',
      prompt:
        'Build an HR assistant to answer from our handbook and hand off exceptions to a person.',
      control:
        'Build an HR assistant to answer from approved files and test boundaries.',
    },
  ])(
    'AC-12.18 scopes $name',
    ({ direct, partial, teaching, prompt, control }) => {
      const main = lesson(
        1,
        direct,
        'Teach the primary activity, summarize themes, set naming rules and clarification questions.',
      );
      const component = lesson(2, partial, teaching);
      const { run } = fixture([component, main]);
      expect(ids(run(prompt))).toEqual([main.youtubeId, component.youtubeId]);
      expect(ids(run(control))).toEqual([main.youtubeId]);
    },
  );

  it('AC-12.17 prioritizes approved spreadsheet replacements over incidental record lookup', () => {
    const terms = lesson(
      1,
      ['Terminology updates'],
      'Apply replacement labels.',
    );
    const record = lesson(2, ['Document Q&A'], 'Query a notebook of records.');
    const { run } = fixture([record, terms]);
    const result = run(
      'Apply approved label replacements throughout this workbook, preserving an original record of agreed actions.',
    );
    expect(result.interpretation.tasks).toEqual(['Terminology updates']);
    expect(result.interpretation.sourceMaterials).toEqual(['spreadsheet']);
    expect(ids(result)).toEqual([terms.youtubeId]);
    const lookup = run('Find agreed actions in the original board record.');
    expect(lookup.interpretation.tasks).toEqual(['Document Q&A']);
    expect(ids(lookup)).toEqual([record.youtubeId]);
  });
  it('AC-12.17 prioritizes comparing versions and retains an explicitly requested claim-review component', () => {
    const compare = lesson(
      1,
      ['Document comparison'],
      'Compare policy versions.',
    );
    const review = lesson(
      2,
      ['Editing proofreading', 'Document review'],
      'Check wording and claims.',
    );
    const { run } = fixture([review, compare]);
    const result = run(
      'Compare the old and new policy document, then check claims in our letter.',
    );
    expect(result.interpretation.tasks).toEqual(['Document comparison']);
    expect(ids(result)).toEqual([compare.youtubeId, review.youtubeId]);
    expect(ids(run('Compare the old and new policy document.'))).toEqual([
      compare.youtubeId,
    ]);
    const proofreading = run(
      'Check claims in this policy document and letter.',
    );
    expect(proofreading.interpretation.tasks).toEqual([
      'Editing proofreading',
      'Document review',
    ]);
    expect(ids(proofreading)).toEqual([review.youtubeId]);
    const rejected = run(
      'Do not compare policy versions; check claims in this letter.',
    );
    expect(rejected.interpretation.tasks).toEqual([
      'Editing proofreading',
      'Document review',
    ]);
    expect(ids(rejected)).toEqual([review.youtubeId]);
  });
  it('AC-12.17 distinguishes a reusable writing helper from naming a program', () => {
    const helper = lesson(
      1,
      ['Brand voice', 'Custom assistants', 'Document drafting'],
      'Configure naming rules and clarification questions.',
    );
    const naming = lesson(
      2,
      ['Brand naming', 'Brainstorming'],
      'Find a program name.',
    );
    const reference = lesson(3, ['Prompting'], 'Supply a writing sample.');
    const { run } = fixture([naming, reference, helper]);
    const result = run(
      'Build a reusable writing helper with approved program names; ask a question when facts are missing. Keep examples as reference.',
    );
    expect(result.interpretation.tasks).toEqual([
      'Custom assistants',
      'Brand voice',
    ]);
    expect(ids(result)).toEqual([helper.youtubeId, reference.youtubeId]);
    expect(
      ids(
        run(
          'Build a reusable writing helper with approved program names; ask a question when facts are missing.',
        ),
      ),
    ).toEqual([helper.youtubeId]);
    const brainstorm = run(
      'Ask one question at a time to find a welcoming program name.',
    );
    expect(brainstorm.interpretation.tasks).toEqual([
      'Brand naming',
      'Brainstorming',
    ]);
    expect(ids(brainstorm)).toEqual([naming.youtubeId]);
  });
  it.each([
    {
      prompt:
        'Assess whether a bid fits this commissioning pack and its spending rules.',
      task: 'RFP review',
      description: 'Assess requirements and funder guidance.',
    },
    {
      prompt:
        'Rehearsal for a funding conversation with a foundation about our nonprofit.',
      task: 'Role play',
      description: 'Practice a funding conversation.',
    },
    {
      prompt: 'Use my CV and a job advert to prepare an application.',
      task: 'Cover letter writing',
      description: 'Draft a job application.',
    },
    {
      prompt: 'Explain this technical issue to our treasurer.',
      task: 'Plain language',
      description: 'Explain technical risks.',
    },
    {
      prompt: 'Use a supervisor session recording to prepare an editable note.',
      task: 'Supervision documentation',
      description: 'Create supervision documentation.',
    },
    {
      prompt: 'Edit the exposure of a dark portrait in Lightroom.',
      task: 'Photo editing',
      description: 'Adjust portrait exposure.',
    },
    {
      prompt:
        'Prepare a counterproposal for a used laptop based on its condition.',
      task: 'Negotiation preparation',
      description: 'Prepare a counteroffer.',
    },
    {
      prompt:
        'Research public statements by a campaign organiser for an interview briefing.',
      task: 'Research',
      description: 'Research a public interview guest.',
      extra: ['Interview preparation'],
    },
    {
      prompt:
        'Our site misses AI search results; challenge its answers about our service pages.',
      task: 'AI search visibility',
      description: 'Audit AI search visibility.',
    },
    {
      prompt: 'Turn these visit bullets into a case entry.',
      task: 'Case notes',
      description: 'Draft a case note.',
    },
    {
      prompt:
        'Build an HR assistant that can answer a question using citations.',
      task: 'Knowledge management',
      description: 'Configure a knowledge assistant.',
      extra: ['Custom assistants'],
    },
    {
      prompt:
        'Use this paper for a term of teaching with assignments and readings.',
      task: 'Curriculum design',
      description: 'Create a syllabus.',
      extra: ['Lesson planning'],
    },
  ])(
    'AC-12.17 recognizes source/action wording: $task',
    ({ prompt, task, description, extra = [] }) => {
      const direct = lesson(1, [task, ...extra], description);
      const unrelated = lesson(
        2,
        ['Music generation'],
        'Generate a soundtrack.',
      );
      const { run } = fixture([unrelated, direct]);
      const result = run(prompt);
      expect(result.interpretation.tasks).toContain(task);
      expect(ids(result)).toEqual([direct.youtubeId]);
    },
  );

  it('AC-12.16 admits saved-writing components for recurring example-based work', () => {
    const direct = lesson(
      1,
      ['Social media writing', 'Custom assistants', 'Brand voice'],
      'Configure a social writing assistant.',
    );
    const bank = lesson(
      2,
      ['Brand voice', 'Custom assistants'],
      'Use a language bank.',
    );
    const sample = lesson(3, ['Prompting'], 'Provide a writing sample.');
    const skill = lesson(
      4,
      ['Workflow automation', 'Custom assistants'],
      'Reuse a saved workflow.',
    );
    const { run } = fixture([skill, sample, bank, direct]);
    const recurring = run(
      'Every time we announce a partner on LinkedIn, keep examples in mind for reusable mission wording.',
    );
    expect(ids(recurring)[0]).toBe(direct.youtubeId);
    expect(ids(recurring)).toEqual(
      expect.arrayContaining([
        bank.youtubeId,
        sample.youtubeId,
        skill.youtubeId,
      ]),
    );
    const oneOff = run(
      'Announce a new partner on LinkedIn with mission wording and a previous example.',
    );
    expect(ids(oneOff)).toEqual([direct.youtubeId]);
  });
  it('AC-12.16 requires both duplicate and identifier cues for list-based cleanup components', () => {
    const clean = lesson(1, ['Data cleaning'], 'Clean spreadsheet values.');
    const compare = lesson(
      2,
      ['List comparison'],
      'Compare names across lists.',
    );
    const formula = lesson(
      3,
      ['List comparison', 'Spreadsheet formulas'],
      'List repeated names.',
    );
    const terms = lesson(
      4,
      ['Terminology updates'],
      'Revise approved category labels.',
    );
    const { run } = fixture([terms, formula, compare, clean]);
    expect(
      ids(
        run(
          'Check empty fields, repeated rows and two spellings of a program name in these dates and rows.',
        ),
      ),
    ).toEqual(
      expect.arrayContaining([
        clean.youtubeId,
        compare.youtubeId,
        formula.youtubeId,
        terms.youtubeId,
      ]),
    );
    expect(
      ids(run('Check duplicate rows and impossible ages in a date export.')),
    ).toEqual([clean.youtubeId]);
    expect(ids(run('Check missing names and dates in a row export.'))).toEqual([
      clean.youtubeId,
    ]);
  });
  it('AC-12.16 distinguishes row-count formulas from set comparison alone', () => {
    const lists = lesson(
      1,
      ['List comparison'],
      'Compare event participation.',
    );
    const formula = lesson(2, ['Spreadsheet formulas'], 'Generate a formula.');
    const total = lesson(
      3,
      ['Spreadsheet formulas', 'Data aggregation'],
      'Sum amounts.',
    );
    const { run } = fixture([total, formula, lists]);
    const counted = run(
      'Count different organizations across event spreadsheets; counting the rows is wrong.',
    );
    expect(ids(counted)).toEqual([lists.youtubeId, formula.youtubeId]);
    expect(
      ids(
        run('Compare partner lists across events to find new organizations.'),
      ),
    ).toEqual([lists.youtubeId]);
  });
  it('AC-12.16 makes reference-file organization a conditional FAQ component', () => {
    const faq = lesson(
      1,
      ['Custom assistants', 'Knowledge management'],
      'Configure an internal FAQ.',
    );
    const project = lesson(
      2,
      ['Knowledge management', 'Process documentation'],
      'Organize reference files.',
    );
    const { run } = fixture([project, faq]);
    expect(
      ids(
        run(
          'Build a helper to answer handbook questions from reference files.',
        ),
      ),
    ).toEqual([faq.youtubeId, project.youtubeId]);
    expect(
      ids(run('Build a helper to answer handbook questions from our files.')),
    ).toEqual([faq.youtubeId]);
    expect(ids(run('Build a helper to answer handbook questions.'))).toEqual([
      faq.youtubeId,
    ]);
  });
  it('AC-12.16 recovers supplied-fact drafting without adding unsolicited proofreading', () => {
    const letter = lesson(
      1,
      ['Reimbursement documentation'],
      'Draft an insurer letter.',
    );
    const draft = lesson(
      2,
      ['Document drafting', 'Document Q&A', 'Document summary'],
      'Draft using source context.',
    );
    const review = lesson(
      3,
      ['Editing proofreading'],
      'Review an existing draft.',
    );
    const grant = lesson(4, ['Grant drafting'], 'Draft funder responses.');
    const { run } = fixture([draft, letter, review, grant]);
    expect(
      ids(
        run(
          'Draft a letter to an insurer from treatment details and ask for missing facts.',
        ),
      ),
    ).toContain(draft.youtubeId);
    expect(
      ids(
        run(
          'Draft a foundation response about a future service launch from an overview.',
        ),
      ),
    ).not.toContain(review.youtubeId);
    expect(
      ids(
        run(
          'Draft a foundation response about a future service launch and check the draft.',
        ),
      ),
    ).toContain(review.youtubeId);
  });
  it('AC-12.16 includes document summarization for source-based visual and written records', () => {
    const flier = lesson(
      1,
      ['Outreach materials', 'Document summary'],
      'Create a recruitment flier.',
    );
    const summary = lesson(
      2,
      ['Document summary', 'Document Q&A', 'Document drafting'],
      'Summarize and draft from sources.',
    );
    const minutes = lesson(3, ['Meeting minutes'], 'Generate formal minutes.');
    const panel = lesson(4, ['Document summary'], 'Summarize a panel speaker.');
    const { run } = fixture([panel, minutes, summary, flier]);
    expect(
      ids(
        run(
          'Use a dense PDF with key conditions to create a visual recruitment flier.',
        ),
      ),
    ).toContain(summary.youtubeId);
    expect(
      ids(
        run(
          'Turn the text of our steering-group call into a Word record of decisions.',
        ),
      ),
    ).toEqual(
      expect.arrayContaining([
        minutes.youtubeId,
        summary.youtubeId,
        panel.youtubeId,
      ]),
    );
    expect(
      ids(
        run('Use a transcript for formal committee minutes and a Word file.'),
      ),
    ).not.toContain(summary.youtubeId);
  });
  it('AC-12.16 separates directory extraction from requested cleanup checks', () => {
    const structure = lesson(
      1,
      ['Data structuring'],
      'Structure pasted names.',
    );
    const clean = lesson(2, ['Data cleaning'], 'Clean spreadsheet rows.');
    const { run } = fixture([clean, structure]);
    expect(
      ids(
        run(
          'Put this emailed directory into columns and a downloadable table.',
        ),
      ),
    ).toEqual([structure.youtubeId]);
    expect(
      ids(run('Put this messy pasted directory into a table I can check.')),
    ).toContain(clean.youtubeId);
  });
  it('AC-12.16 selects teaching components for accessible-course work and preserves introduction-only helpers', () => {
    const intro = lesson(
      1,
      ['Custom assistants'],
      'Explain an accessible personalized agent.',
    );
    const activity = lesson(
      2,
      ['Lesson planning', 'Custom assistants'],
      'Use reference curriculum for an activity idea generator.',
    );
    const resource = lesson(
      3,
      ['Accessible content', 'Educational materials'],
      'Adapt learning resources.',
    );
    const workspace = lesson(
      4,
      ['Knowledge management'],
      'Curate supporting project documents.',
    );
    const { run } = fixture([workspace, resource, activity, intro]);
    const course = run(
      'Build an accessible course assistant for learners, with reference material and a real test beyond an introduction.',
    );
    expect(ids(course)).toEqual(
      expect.arrayContaining([
        intro.youtubeId,
        activity.youtubeId,
        resource.youtubeId,
      ]),
    );
    expect(ids(course)).not.toContain(workspace.youtubeId);
    const settings = run(
      'I want to understand the introduction and settings of an accessible agent.',
    );
    expect(ids(settings)).toContain(workspace.youtubeId);
    expect(ids(settings)).not.toContain(activity.youtubeId);
    expect(ids(settings)).not.toContain(resource.youtubeId);
  });
  it('AC-12.16 recovers tracking and handoff components without treating all capture as process design', () => {
    const track = lesson(
      1,
      ['Student interventions', 'App building'],
      'Track student interventions.',
    );
    const milestone = lesson(
      2,
      ['Case management'],
      'Track milestones and dates.',
    );
    const capture = lesson(
      3,
      ['Client intake', 'App building'],
      'Capture quick contacts.',
    );
    const process = lesson(
      4,
      ['Process documentation', 'Client intake'],
      'Design a reviewed handoff procedure.',
    );
    const { run } = fixture([process, capture, milestone, track]);
    expect(
      ids(
        run(
          'Build a student follow-up app and record responsible staff and dates.',
        ),
      ),
    ).toEqual(
      expect.arrayContaining([
        track.youtubeId,
        milestone.youtubeId,
        capture.youtubeId,
        process.youtubeId,
      ]),
    );
    expect(
      ids(
        run(
          'Capture phone contact details at reception for follow-up by the office.',
        ),
      ),
    ).toContain(process.youtubeId);
    expect(
      ids(run('Capture phone contact details at reception for follow-up.')),
    ).not.toContain(process.youtubeId);
  });
  it('AC-12.16 admits learner adaptation as a partial newsletter method', () => {
    const newsletter = lesson(
      1,
      ['Newsletter writing'],
      'Write a learner newsletter item.',
    );
    const resource = lesson(
      2,
      ['Accessible content', 'Educational materials'],
      'Adapt student and family resources.',
    );
    const { run } = fixture([resource, newsletter]);
    expect(
      ids(
        run(
          'Write an adult-learning newsletter item in everyday English for learners.',
        ),
      ),
    ).toEqual([newsletter.youtubeId, resource.youtubeId]);
  });

  it.each([
    {
      name: 'email chain',
      tasks: ['Email summary', 'Email drafting', 'Meeting scheduling'],
      prompt: 'Use this Outlook chain to draft an invitation and reply.',
      source: 'email',
      output: 'email',
    },
    {
      name: 'briefing paper',
      tasks: ['Presentation creation', 'Content repurposing'],
      prompt: 'Generate a slide deck from this briefing paper.',
      source: 'document',
      output: 'presentation',
    },
    {
      name: 'supplied refresher text',
      tasks: ['Audio generation'],
      prompt:
        'Make an audio explanation from this refresher text and let us hear a sample.',
      source: 'document',
      output: 'audio',
    },
    {
      name: 'handbook answer service',
      tasks: ['Custom assistants', 'Knowledge management'],
      prompt:
        'Build an answer service from the handbook so staff can ask questions.',
      source: 'document',
      output: 'assistant',
    },
    {
      name: 'empty fields',
      tasks: ['Data cleaning'],
      prompt: 'Check empty fields and odd dates in these rows.',
      source: 'spreadsheet',
      output: 'cleaned-data',
    },
    {
      name: 'written handover steps',
      tasks: ['Process documentation'],
      prompt: 'Write down the reception steps and handover checklist.',
      source: 'context',
      output: 'checklist',
    },
    {
      name: 'different organisations',
      tasks: ['List comparison'],
      prompt:
        'Count different organisations across event spreadsheets and find first-time participants.',
      source: 'spreadsheet',
      output: 'comparison',
    },
  ])(
    'AC-12.15 recognizes $name with a bounded source/action route',
    ({ tasks, prompt, source, output }) => {
      const supported = lesson(
        1,
        tasks,
        'A fictional instructional method in Gamma.',
      );
      const unrelated = lesson(2, ['Photo editing'], 'Adjust photo exposure.');
      const { run } = fixture([unrelated, supported]);
      const result = run(prompt);
      expect(ids(result)[0]).toBe(supported.youtubeId);
      expect(ids(result)).not.toContain(unrelated.youtubeId);
      expect(result.interpretation.sourceMaterials).toEqual([source]);
      expect(result.interpretation.desiredOutputs).toContain(output);
    },
  );
  it('AC-12.15 preserves rehearsal when rejecting the practice partner role assumption', () => {
    const peer = lesson(
      1,
      ['Difficult conversations', 'Role play'],
      'Practise a coworker conversation.',
    );
    const { run } = fixture([peer]);
    const result = run(
      "Practise raising an unfinished shift task with a teammate. I don't want the practice partner treating me like their boss.",
    );
    expect(ids(result)).toEqual([peer.youtubeId]);
    expect(result.interpretation.excludedTasks).not.toContain('Role play');
    expect(result.interpretation.desiredOutputs).toEqual(['role-play']);
  });
  it('AC-12.15 excludes an alternative rejected after its mention', () => {
    const cleaning = lesson(1, ['Data cleaning'], 'Clean spreadsheet rows.');
    const { run } = fixture([cleaning]);
    const result = run(
      "I need a native contact merge. Exporting a spreadsheet and cleaning duplicate rows won't solve it.",
    );
    expect(ids(result)).toEqual([]);
    expect(result.interpretation.tasks).not.toContain('Data cleaning');
  });
  it('AC-12.15 enforces native screens even for a platform absent from the dictionary', () => {
    const generic = lesson(
      1,
      ['Data cleaning'],
      'Clean duplicate spreadsheet rows.',
      ['Claude'],
    );
    const { run } = fixture([generic]);
    expect(
      ids(run('Clean duplicate rows using actual Salesforce screens.')),
    ).toEqual([]);
    expect(
      ids(
        run(
          "I don't need actual Salesforce screens. Clean duplicate spreadsheet rows.",
        ),
      ),
    ).toEqual([generic.youtubeId]);
    expect(ids(run('Clean duplicate rows exported from Salesforce.'))).toEqual([
      generic.youtubeId,
    ]);
  });
  it('AC-12.15 matches the complete native application name', () => {
    const native = lesson(
      1,
      ['Email automation'],
      'Save email attachments in the native application.',
      ['Microsoft Outlook'],
    );
    const other = lesson(2, ['Email automation'], 'Save email attachments.', [
      'Google Workspace Studio',
    ]);
    const { run } = fixture([other, native]);
    expect(
      ids(
        run('Save email attachments using actual Microsoft Outlook screens.'),
      ),
    ).toEqual([native.youtubeId]);
  });
  it('AC-12.15 requires offline teaching evidence across the retrieval path', () => {
    const cloud = lesson(
      1,
      ['Data cleaning'],
      'Clean duplicate spreadsheet rows.',
      ['Cloud Lab'],
    );
    const local = lesson(
      2,
      ['Data cleaning'],
      'Clean duplicate spreadsheet rows offline.',
      ['Local Lab'],
    );
    const { run } = fixture([cloud, local]);
    expect(ids(run('Clean duplicate spreadsheet rows offline only.'))).toEqual([
      local.youtubeId,
    ]);
  });
  it('AC-12.15 treats supervision recordings as input and notes as output under an offline requirement', () => {
    const local = lesson(
      1,
      ['Supervision documentation'],
      'Turn recordings into structured notes offline.',
      ['Local Notes'],
    );
    const cloud = lesson(
      2,
      ['Supervision documentation'],
      'Turn recordings into structured notes using a hosted service.',
      ['Hosted Notes'],
    );
    const { run } = fixture([cloud, local]);
    const result = run(
      'I need a video showing offline-only transcription of supervision recordings into structured notes. Hosted assistants are not options.',
    );
    expect(ids(result)).toEqual([local.youtubeId]);
    expect(result.interpretation.sourceMaterials).toEqual(['recording']);
    expect(result.interpretation.desiredOutputs).toEqual(['summary', 'notes']);
  });
  it('AC-12.15 requires bulk field-binding evidence alongside a native platform', () => {
    const single = lesson(
      1,
      ['Outreach materials', 'Document summary'],
      'Create a visual flier from a PDF.',
      ['Canva'],
    );
    const bulk = lesson(
      2,
      ['Outreach materials', 'Document summary'],
      'Create fliers with Bulk Create and CSV fields.',
      ['Canva'],
    );
    const { run } = fixture([single, bulk]);
    expect(
      ids(
        run(
          "Create a visual flier from a PDF using Canva's own Bulk Create controls and a CSV.",
        ),
      ),
    ).toEqual([bulk.youtubeId]);
  });
  it('AC-12.15 separates answer sheets and short durations from tool and material names', () => {
    const activity = lesson(
      1,
      ['Lesson planning', 'Brainstorming'],
      'Plan a numeracy activity.',
    );
    const intake = lesson(
      2,
      ['Client intake', 'App building'],
      'Capture contact details.',
    );
    const sheet = lesson(3, ['Spreadsheet formulas'], 'Generate formulas.', [
      'Google Sheets',
    ]);
    const { run } = fixture([activity, intake, sheet]);
    const result = run(
      'Plan a timed numeracy session with materials and an answer sheet.',
    );
    expect(ids(result)[0]).toBe(activity.youtubeId);
    expect(result.interpretation.tools).not.toContain('Google Sheets');
    const contact = run(
      'Capture contact details in an outreach session with only a minute for phone follow-up.',
    );
    expect(ids(contact)[0]).toBe(intake.youtubeId);
    expect(contact.interpretation.sourceMaterials).toEqual(['context']);
    expect(contact.interpretation.sourceMaterials).not.toContain('minutes');
  });
  it('AC-12.15 does not interpret an indefinite short duration as meeting minutes', () => {
    const minutes = lesson(1, ['Meeting minutes'], 'Prepare meeting minutes.');
    const { catalog, options } = fixture([minutes]);
    options.workflows = {
      artifacts: [
        {
          id: 'minutes',
          label: 'Meeting minutes',
          aliases: ['minutes'],
          tasks: ['Meeting minutes'],
        },
      ],
      workflows: [],
    };
    const result = recommendVideos(
      catalog,
      { prompt: 'We have a minute to talk.' },
      options,
    );
    expect(result.interpretation.sourceMaterials).not.toContain('minutes');
  });
  it('AC-12.15 recognizes Word output without excluding its application', () => {
    const minutes = lesson(
      1,
      ['Meeting minutes'],
      'Create structured minutes.',
      ['Microsoft Word'],
    );
    const { run } = fixture([minutes]);
    const result = run(
      'Use the text of our steering-group call for a Word record of decisions.',
    );
    expect(ids(result)).toEqual([minutes.youtubeId]);
    expect(result.interpretation.tools).toContain('Microsoft Word');
    expect(result.interpretation.sourceMaterials).toEqual(['transcript']);
    expect(result.interpretation.desiredOutputs).toEqual(['minutes']);
  });
  it('AC-12.15 retains the qualitative-analysis goal and prefers the named application', () => {
    const broad = lesson(
      1,
      ['Chart creation', 'Survey analysis', 'Qualitative analysis'],
      'Chart survey results and analyze themes.',
      ['ChatGPT'],
    );
    const named = lesson(
      2,
      ['Chart creation', 'Survey analysis'],
      'Chart scores and inspect qualitative comments.',
      ['Gemini'],
    );
    const { run } = fixture([broad, named]);
    const result = run(
      'Use Gemini for a pulse check chart and analyze written responses.',
    );
    expect(ids(result)).toEqual([named.youtubeId, broad.youtubeId]);
    expect(result.interpretation.desiredOutputs).toEqual(['chart', 'analysis']);
  });

  it('AC-12.14 prefers a document-to-slides method over a planning example', () => {
    const convert = lesson(
      1,
      ['Presentation creation', 'Content repurposing'],
      'Generate a deck in Gamma.',
    );
    const planning = lesson(
      2,
      ['Presentation creation', 'Strategic planning'],
      'Use Gamma for an operations board presentation.',
    );
    const { run } = fixture([planning, convert]);
    const result = run(
      'In operations, we need a presentation from a document for our board.',
    );
    expect(ids(result)).toEqual([convert.youtubeId, planning.youtubeId]);
    expect(result.interpretation.sourceMaterials).toEqual(['document']);
    expect(result.interpretation.desiredOutputs).toEqual(['presentation']);
    expect(ids(run('Repurpose this document into slides.'))[0]).toBe(
      convert.youtubeId,
    );
  });
  it('AC-12.14 recognizes a spreadsheet-to-report workflow with chart evidence', () => {
    const report = lesson(
      1,
      ['Exploratory analysis', 'Chart creation', 'Report generation'],
      'Analyze datasets, chart patterns and write an article.',
    );
    const chartOnly = lesson(2, ['Chart creation'], 'Draw a chart.');
    const { run } = fixture([chartOnly, report]);
    const result = run(
      'Explore patterns in this CSV, make charts and assemble a report.',
    );
    expect(ids(result)).toEqual([report.youtubeId]);
    expect(result.interpretation.sourceMaterials).toEqual(['spreadsheet']);
    expect(result.interpretation.desiredOutputs).toEqual([
      'analysis',
      'chart',
      'document',
    ]);
  });
  it('AC-12.14 keeps a comparison task ahead of a requested summary component', () => {
    const summary = lesson(
      1,
      ['Document summary', 'Document Q&A', 'Document drafting'],
      'Summarize with source references.',
    );
    const compare = lesson(
      2,
      ['Document comparison'],
      'Compare document versions.',
    );
    const { run } = fixture([summary, compare]);
    expect(ids(run('Summarize a document in Microsoft Word.'))).toEqual([
      summary.youtubeId,
    ]);
    const result = run(
      'Compare these policy documents and summarize the changes.',
    );
    expect(ids(result)[0]).toBe(compare.youtubeId);
    expect(result.interpretation.desiredOutputs).toEqual(['comparison']);
  });
  it('AC-12.14 distinguishes configuring an FAQ assistant from reading a source', () => {
    const faq = lesson(
      1,
      ['Custom assistants', 'Knowledge management'],
      'Configure an internal FAQ with reference knowledge.',
    );
    const answers = lesson(
      2,
      ['Document Q&A', 'Document summary'],
      'Answer questions with source references.',
    );
    const { run } = fixture([answers, faq]);
    const result = run(
      'Configure an FAQ assistant using documents and reference knowledge, then check its answers.',
    );
    expect(ids(result)).toEqual([faq.youtubeId]);
    expect(result.interpretation.desiredOutputs).toEqual(['assistant']);
  });
  it('AC-12.14 distinguishes web-source research from questions about a supplied document', () => {
    const research = lesson(
      1,
      ['Regulatory document review', 'Research'],
      'Research regulations using government sources.',
    );
    const sourceQA = lesson(
      2,
      ['Document Q&A', 'Document summary'],
      'Answer questions with source references.',
    );
    const { run } = fixture([sourceQA, research]);
    const result = run(
      'Use Perplexity to research regulations and inspect source documents behind an answer.',
    );
    expect(ids(result)).toEqual([research.youtubeId]);
    expect(result.interpretation.sourceMaterials).toEqual(['web']);
  });
  it('AC-12.14 keeps responsible-use discussion separate from a performance conversation', () => {
    const responsible = lesson(
      1,
      ['Responsible AI'],
      'Discuss responsible AI use.',
    );
    const roleplay = lesson(
      2,
      ['Difficult conversations', 'Role play'],
      'Practice a performance conversation.',
    );
    const { run } = fixture([roleplay, responsible]);
    expect(
      ids(run('I need help discussing responsible AI use and privacy.')),
    ).toEqual([responsible.youtubeId]);
    expect(
      ids(
        run(
          'Discuss a sensitive performance issue with a colleague and role-play responses when the scenario is wrong.',
        ),
      ),
    ).toContain(roleplay.youtubeId);
    expect(
      ids(
        run(
          'Discuss a sensitive performance issue with a colleague and role-play responses when the scenario is wrong.',
        ),
      ),
    ).not.toContain(responsible.youtubeId);
  });
  it('AC-12.14 recognizes curriculum activity setup without admitting language tutoring', () => {
    const activity = lesson(
      1,
      ['Lesson planning', 'Custom assistants'],
      'Generate activities from reference curriculum.',
    );
    const tutoring = lesson(
      2,
      ['Custom assistants', 'Lesson planning', 'Language learning'],
      'Generate activities for language learning.',
    );
    const { run } = fixture([tutoring, activity]);
    const result = run(
      'Configure a curriculum assistant for icebreaker activities.',
    );
    expect(ids(result)).toEqual([activity.youtubeId]);
    expect(result.interpretation.sourceMaterials).toEqual(['curriculum']);
    expect(result.interpretation.desiredOutputs).toEqual([
      'assistant',
      'lesson',
    ]);
  });
  it('AC-12.14 recognizes student tracking apps with task evidence', () => {
    const tracking = lesson(
      1,
      ['Student interventions', 'App building'],
      'Track student interventions in an app.',
    );
    const generic = lesson(2, ['App building'], 'Create an app.');
    const { run } = fixture([generic, tracking]);
    expect(
      ids(
        run(
          'We need an app for tracking student interventions and follow-up records.',
        ),
      ),
    ).toEqual([tracking.youtubeId]);
  });
  it('AC-12.14 requires a longitudinal or multi-source cue for cross-document grantee transfers', () => {
    const direct = lesson(
      1,
      ['Grant due diligence'],
      'Compare grantee annual reports.',
    );
    const lookup = lesson(
      2,
      ['Document Q&A'],
      'Ask questions across a collection of source documents.',
    );
    const { run } = fixture([lookup, direct]);
    expect(
      ids(
        run(
          'Compare annual reports from our grantee and prepare review questions.',
        ),
      ),
    ).toEqual([direct.youtubeId]);
    expect(
      ids(
        run(
          'Compare several partners using annual reports and how programs developed over time.',
        ),
      ),
    ).toContain(lookup.youtubeId);
  });
  it('AC-12.14 requires a writing-method cue for reusable donor-copy transfers', () => {
    const webinar = lesson(1, ['Webinar planning'], 'Plan a donor webinar.');
    const writing = lesson(
      2,
      ['Content repurposing', 'Custom assistants'],
      'Reuse writing instructions.',
    );
    const { run } = fixture([writing, webinar]);
    expect(
      ids(
        run('Use a report to plan a donor webinar and draft invitation posts.'),
      ),
    ).toEqual([webinar.youtubeId]);
    expect(
      ids(
        run(
          'Use a report for a donor online event, with opening remarks in our voice and invitation posts.',
        ),
      ),
    ).toContain(writing.youtubeId);
  });

  it('AC-12.13 recognizes financial source wording without an accounting task label', () => {
    const finance = lesson(
      1,
      ['Financial analysis'],
      'Review public financial filings.',
    );
    const reports = lesson(
      2,
      ['Grant due diligence'],
      'Review organizational reports.',
    );
    const { run } = fixture([reports, finance]);
    const result = run(
      'Spot financial warning signs in these public IRS filings and auditor PDFs.',
    );
    expect(ids(result)).toEqual([finance.youtubeId, reports.youtubeId]);
    expect(result.interpretation.sourceMaterials).toEqual(['document']);
  });
  it('AC-12.13 recognizes distinct-record counts without admitting conditional totals', () => {
    const distinct = lesson(
      1,
      ['List comparison', 'Spreadsheet formulas'],
      'Count unique identifiers.',
    );
    const totals = lesson(
      2,
      ['Data aggregation', 'Spreadsheet formulas'],
      'Total hours by name.',
    );
    const { run } = fixture([totals, distinct]);
    expect(ids(run('Count distinct client IDs in spreadsheet rows.'))).toEqual([
      distinct.youtubeId,
    ]);
  });
  it('AC-12.13 treats word-for-word as text and preserves formal-minutes methods', () => {
    const minutes = lesson(1, ['Meeting minutes'], 'Draft formal minutes.', [
      'Microsoft Word',
    ]);
    const summary = lesson(
      2,
      ['Document summary'],
      'Summarize a panel speaker.',
    );
    const { run } = fixture([summary, minutes]);
    const result = run(
      'Use a transcript of our planning call for minutes with decisions, not a word-for-word transcript.',
    );
    expect(result.interpretation.excludedTools).not.toContain('Microsoft Word');
    expect(ids(result)).toEqual([minutes.youtubeId]);
    expect(
      ids(
        run(
          'Use a committee transcript for minutes with actions and a detailed summary in a Word file.',
        ),
      ),
    ).toContain(summary.youtubeId);
  });
  it('AC-12.13 keeps a rejected lecture separate from the requested setup topic', () => {
    const writing = lesson(
      1,
      ['Brand voice', 'Custom assistants'],
      'Configure a reusable writing assistant.',
    );
    const slides = lesson(
      2,
      ['Presentation creation'],
      'Create presentation slides.',
    );
    const { run } = fixture([slides, writing]);
    const result = run(
      'Watch someone doing it, not a slide lecture, about setting up a reusable writing helper.',
    );
    expect(ids(result)).toEqual([writing.youtubeId]);
    expect(result.interpretation.desiredOutputs).toEqual(['assistant']);
  });
  it('AC-12.13 keeps an unread guide as source material for requested audio', () => {
    const audio = lesson(
      1,
      ['Audio generation'],
      'Generate audio from a guide.',
    );
    const { run } = fixture([audio]);
    const result = run(
      "People won't read the guide. I want an audio version they can listen to.",
    );
    expect(ids(result)).toEqual([audio.youtubeId]);
    expect(result.interpretation.sourceMaterials).toEqual(['document']);
    expect(result.interpretation.desiredOutputs).toEqual(['audio']);
  });
  it('AC-12.13 separates career-level alignment from a document-review subtask', () => {
    const career = lesson(
      1,
      ['Career frameworks'],
      'Align job descriptions and levels.',
    );
    const edit = lesson(
      2,
      ['Editing proofreading'],
      'Review the wording of a document.',
    );
    const { run } = fixture([edit, career]);
    expect(
      ids(
        run(
          'Make job descriptions consistent across levels and fill in a progression grid.',
        ),
      ),
    ).toEqual([career.youtubeId]);
    expect(
      ids(
        run(
          'Review job descriptions against our competency framework and progression levels.',
        ),
      ),
    ).toContain(edit.youtubeId);
  });
  it('AC-12.13 keeps generic drafting out of correspondence without a requested component', () => {
    const letter = lesson(
      1,
      ['Client correspondence'],
      'Draft a landlord response.',
    );
    const draft = lesson(
      2,
      ['Document drafting', 'Document Q&A', 'Document summary'],
      'Draft a grounded document.',
    );
    const { run } = fixture([draft, letter]);
    expect(
      ids(run('Draft a tenant response to a landlord after asking questions.')),
    ).toEqual([letter.youtubeId]);
    expect(
      ids(
        run(
          'Draft a calm tenant response to a landlord after asking questions.',
        ),
      ),
    ).toContain(draft.youtubeId);
  });
  it('AC-12.8 retains grounded cross-document questioning as a grantee-review component', () => {
    const review = lesson(
      1,
      ['Grant due diligence'],
      'Compare annual grantee reports.',
    );
    const questions = lesson(
      2,
      ['Document Q&A'],
      'Ask questions across a collection of source documents.',
    );
    const { run } = fixture([questions, review]);
    const result = run(
      'Compare grantee annual reports and prepare questions about how programs evolved.',
    );
    expect(ids(result)).toEqual([review.youtubeId, questions.youtubeId]);
    expect(result.recommendations[1].reason).toContain(
      'transferable component',
    );
  });
  it('AC-12.8 retains reusable writing as a report-to-donor-event component', () => {
    const webinar = lesson(
      1,
      ['Webinar planning'],
      'Outline a donor webinar from a report.',
    );
    const writing = lesson(
      2,
      ['Content repurposing', 'Custom assistants'],
      'Reuse source material with a writing assistant.',
    );
    const { run } = fixture([writing, webinar]);
    const result = run(
      'Turn a research report into a donor briefing event and social posts.',
    );
    expect(ids(result)).toEqual([webinar.youtubeId, writing.youtubeId]);
    expect(result.recommendations[1].reason).toContain(
      'transferable component',
    );
  });
  it('AC-12.8 retains project context as a lower-ranked helper component and gates standalone lookups', () => {
    const assistant = lesson(
      1,
      ['Custom assistants', 'Knowledge management'],
      'Configure a policy assistant with boundaries.',
    );
    const context = lesson(
      2,
      ['Knowledge management', 'Process documentation'],
      'Organize policy reference files in a project.',
    );
    const lookup = lesson(
      3,
      ['Document Q&A'],
      'Retrieve one answer with a citation and its cited source.',
    );
    const { run } = fixture([lookup, context, assistant]);
    const helper =
      'An internal helper should answer questions from our policy manual and refer exceptions to a person.';
    const result = run(helper);
    expect(ids(result)).toEqual([assistant.youtubeId, context.youtubeId]);
    expect(result.recommendations[1].reason).toContain(
      'transferable component',
    );
    expect(
      ids(
        run(
          'An internal helper should answer policy questions and refer exceptions.',
        ),
      ),
    ).not.toContain(context.youtubeId);
    expect(
      ids(run(`${helper} Provide a source reference for each answer.`)),
    ).toContain(lookup.youtubeId);
    expect(
      ids(run('Build a help desk for questions from our handbook.')),
    ).toContain(lookup.youtubeId);
  });
  it('AC-12.8 retains grounded drafting as a client-correspondence component', () => {
    const letter = lesson(
      1,
      ['Client correspondence'],
      'Draft a landlord response after gathering facts.',
    );
    const drafting = lesson(
      2,
      ['Document drafting', 'Document Q&A', 'Document summary'],
      'Draft from an organizational overview in a document editor.',
    );
    const { run } = fixture([drafting, letter]);
    const result = run(
      'A tenant needs a calm response to a landlord notice. Ask questions before writing.',
    );
    expect(ids(result)).toEqual([letter.youtubeId, drafting.youtubeId]);
    expect(result.recommendations[1].reason).toContain(
      'transferable component',
    );
  });
  it('AC-12.7 recognizes funding fit without treating an application as software', () => {
    const grant = lesson(
      1,
      ['RFP review', 'Grant drafting'],
      'Check program eligibility and plan a funding application.',
    );
    const app = lesson(2, ['App building'], 'Build a software application.');
    const { run } = fixture([app, grant]);
    const result = run(
      'Compare our program with this funding call and its eligibility rules before writing an application.',
    );
    expect(ids(result)).toEqual([grant.youtubeId]);
    expect(result.interpretation.sourceMaterials).toEqual(['document']);
    expect(result.interpretation.desiredOutputs).not.toContain('app');
  });
  it('AC-12.7 recognizes add-up wording and keeps repair instruction eligible', () => {
    const sum = lesson(
      1,
      ['Data aggregation', 'Spreadsheet formulas'],
      'Add volunteer time with conditional sums.',
    );
    const repair = lesson(
      2,
      ['Spreadsheet formulas'],
      'Explain a timesheet formula error.',
    );
    const { run } = fixture([repair, sum]);
    expect(
      ids(
        run("Give me a formula that adds up one volunteer's hours in a sheet."),
      )[0],
    ).toBe(sum.youtubeId);
    expect(ids(run('Explain the error in our timesheet formula.'))).toContain(
      sum.youtubeId,
    );
  });
  it('AC-12.8 distinguishes duplicate-name formulas from conditional totals', () => {
    const unique = lesson(
      1,
      ['Spreadsheet formulas', 'List comparison'],
      'List repeated and unique names.',
    );
    const sum = lesson(
      2,
      ['Spreadsheet formulas', 'Data aggregation'],
      'Sum time by name.',
    );
    const { run } = fixture([sum, unique]);
    expect(
      ids(
        run(
          'A formula in our sheet should list names that occur once and repeated names.',
        ),
      ),
    ).toEqual([unique.youtubeId]);
  });
  it('AC-12.7 does not reject Word when the user lacks time to read a report', () => {
    const document = lesson(
      1,
      ['Document Q&A', 'Document summary'],
      'Answer questions with source references against the text.',
      ['Microsoft Word'],
    );
    const { run } = fixture([document]);
    const result = run(
      "I don't have time to read the report in Word. Answer my question with a source I can verify.",
    );
    expect(ids(result)).toEqual([document.youtubeId]);
    expect(result.interpretation.tools).toContain('Microsoft Word');
    expect(result.interpretation.excludedTools).not.toContain('Microsoft Word');
  });
  it('AC-12.7 interprets an audio version as a transformation, not comparison', () => {
    const audio = lesson(
      1,
      ['Audio generation'],
      'Generate a podcast overview from training material.',
    );
    const comparison = lesson(
      2,
      ['Document comparison'],
      'Compare versions of a document.',
    );
    const { run } = fixture([comparison, audio]);
    const result = run(
      'Turn our training document into an audio version and check a sample.',
    );
    expect(ids(result)).toEqual([audio.youtubeId]);
    expect(result.interpretation.sourceMaterials).toEqual(['document']);
    expect(result.interpretation.desiredOutputs).toEqual(['audio']);
  });
  it('AC-12.7 keeps handbook and forms as help-desk sources and does not infer Google Forms', () => {
    const faq = lesson(
      1,
      ['Custom assistants', 'Knowledge management'],
      'Curate a handbook for an internal FAQ.',
    );
    const form = lesson(2, ['Form generation'], 'Generate a form.', [
      'Google Forms',
    ]);
    const { run } = fixture([form, faq]);
    const result = run(
      'An AI help desk should answer questions from our handbook and forms.',
    );
    expect(ids(result)).toEqual([faq.youtubeId]);
    expect(result.interpretation.sourceMaterials).toEqual(['document']);
    expect(result.interpretation.desiredOutputs).toEqual(['assistant']);
    expect(result.interpretation.tools).not.toContain('Google Forms');
  });
  it('AC-12.7 keeps an already recorded video as a source when requesting captions', () => {
    const video = lesson(1, ['Video creation'], 'Create a training video.');
    const { catalog, options } = fixture([video]);
    const result = recommendVideos(
      catalog,
      { prompt: 'We need captions for a video we already recorded.' },
      {
        ...options,
        workflows: {
          artifacts: [
            { id: 'video', label: 'Video', aliases: ['video'], tasks: [] },
          ],
          workflows: [],
        },
      },
    );
    expect(result.interpretation.sourceMaterials).toContain('video');
    expect(result.interpretation.desiredOutputs).not.toContain('video');
    expect(result.recommendations).toEqual([]);
  });
  it('AC-12.7 prefers the named Studio product over its shorter tool name', () => {
    const studio = lesson(
      1,
      ['Custom assistants', 'Lesson planning'],
      'Explain instructions for a course assistant.',
      ['Microsoft Copilot Studio'],
    );
    const copilot = lesson(2, ['Document drafting'], 'Draft a document.', [
      'Microsoft Copilot',
    ]);
    const { run } = fixture([copilot, studio]);
    const result = run(
      'Understand how to structure a course assistant in Copilot Studio.',
    );
    expect(result.interpretation.tools).toEqual(['Microsoft Copilot Studio']);
    expect(result.interpretation.sourceMaterials).toEqual([]);
    expect(ids(result)).toEqual([studio.youtubeId]);
    expect(
      run(
        'Understand how to structure a course assistant using Copilot and Copilot Studio.',
      ).interpretation.tools,
    ).toEqual(['Microsoft Copilot', 'Microsoft Copilot Studio']);
  });
  it('AC-12.8 requires a requested component before admitting a cross-task transfer', () => {
    const cleanup = lesson(
      1,
      ['Data cleaning'],
      'Clean duplicate rows and invalid dates.',
    );
    const terminology = lesson(
      2,
      ['Terminology updates'],
      'Replace approved terms and export an audit.',
    );
    const { run } = fixture([terminology, cleanup]);
    expect(
      ids(run('Clean duplicate rows and impossible dates in an export.')),
    ).toEqual([cleanup.youtubeId]);
    expect(
      ids(
        run(
          'Clean duplicate rows and standardize category values in an export.',
        ),
      ),
    ).toContain(terminology.youtubeId);
  });
  it('AC-12.8 ranks direct rubric instruction before a preferred format for another form task', () => {
    const rubric = lesson(
      1,
      ['Form generation', 'Evaluation design'],
      'Turn a rubric into evaluation questions.',
    );
    const other = lesson(
      2,
      ['Form generation'],
      'Generate an accommodation form.',
    );
    const procedure = lesson(
      3,
      ['Process documentation', 'Client intake'],
      'Write an intake checklist.',
    );
    const { catalog, options } = fixture([procedure, other, rubric]);
    const result = recommendVideos(
      catalog,
      {
        prompt:
          'A walkthrough should show questions from a rubric in a Google Form.',
      },
      {
        ...options,
        learningFormats: {
          formats: [
            { id: 'demo', label: 'Demonstration', aliases: ['demo'] },
            {
              id: 'walkthrough',
              label: 'Walkthrough',
              aliases: ['walkthrough'],
            },
          ],
          videos: [
            { youtubeId: rubric.youtubeId, primary: 'demo', secondary: [] },
            {
              youtubeId: other.youtubeId,
              primary: 'walkthrough',
              secondary: [],
            },
          ],
        },
      },
    );
    expect(result.interpretation.learningFormats).toEqual(['walkthrough']);
    expect(ids(result)).toEqual([rubric.youtubeId, other.youtubeId]);
  });
  it('AC-12.10 rejects keyword-only results when no requested task is recognized', () => {
    const row = lesson(
      1,
      ['Peer learning'],
      'Share monthly community updates and hold reviews.',
    );
    const { run } = fixture([row]);
    expect(
      run('Hold a review of our monthly community updates.').recommendations,
    ).toEqual([]);
  });
  it('AC-12.10 applies source/output compatibility to a canonical task without an operation profile', () => {
    const recording = lesson(
      1,
      ['Archive indexing'],
      'Index a recorded interview.',
    );
    const document = lesson(2, ['Archive indexing'], 'Index written material.');
    const { catalog, options } = fixture([document, recording]);
    const config = {
      ...options,
      workflows: {
        artifacts: ['recording', 'document', 'indexing'].map((id) => ({
          id,
          label: id,
          aliases: [id],
          tasks: [],
        })),
        workflows: [
          {
            youtubeId: recording.youtubeId,
            task: 'Archive indexing',
            source: 'recording',
            output: 'indexing',
          },
          {
            youtubeId: document.youtubeId,
            task: 'Archive indexing',
            source: 'document',
            output: 'indexing',
          },
        ],
      },
    };
    const result = recommendVideos(
      catalog,
      { prompt: 'I have a recording and need Archive indexing.' },
      config,
    );
    expect(result.interpretation.sourceMaterials).toContain('recording');
    expect(ids(result)).toEqual([recording.youtubeId]);
  });
  it('AC-12.10 rejects mention-only evidence even on the generic canonical-task route', () => {
    const row = lesson(
      1,
      ['Archive review'],
      'An introduction that mentions archive review.',
    );
    const { catalog, options } = fixture([row]);
    expect(
      recommendVideos(
        catalog,
        { prompt: 'I need Archive review.' },
        {
          ...options,
          instructions: [
            {
              youtubeId: row.youtubeId,
              task: 'Archive review',
              form: 'mentioned',
            },
          ],
        },
      ).recommendations,
    ).toEqual([]);
  });
  it('AC-12.10 rejects duplicate instruction evidence before candidate ranking', () => {
    const row = lesson(1, ['Spreadsheet formulas'], 'Explain formula errors.');
    const { catalog, options } = fixture([row]);
    const entry = {
      youtubeId: row.youtubeId,
      task: 'Spreadsheet formulas',
      form: 'demonstrated' as const,
    };
    expect(() =>
      recommendVideos(
        catalog,
        { prompt: 'Explain this formula error.' },
        { ...options, instructions: [entry, entry] },
      ),
    ).toThrow('Invalid or duplicate task instruction evidence.');
  });
  it('AC-12.10 checks specialized capability evidence even when a strong operation profile matches', () => {
    const generic = lesson(
      1,
      ['Volunteer onboarding', 'Video creation'],
      'Animate a welcome from volunteer shift instructions.',
    );
    const specialized = lesson(
      2,
      ['Volunteer onboarding', 'Video creation'],
      'Show voice cloning and lip sync for a welcome animation.',
    );
    const { run } = fixture([generic, specialized]);
    expect(
      ids(
        run(
          'Turn volunteer shift instructions into a welcome animation with voice cloning and lip-sync.',
        ),
      ),
    ).toEqual([specialized.youtubeId]);
  });
  it('AC-12.7 distinguishes feedback on a funding conversation from survey responses', () => {
    const role = lesson(
      1,
      ['Role play', 'Grantmaker communications'],
      'Practice a grant conversation and request feedback.',
    );
    const survey = lesson(
      2,
      ['Survey analysis'],
      'Analyze feedback on a funding program.',
    );
    const { run } = fixture([survey, role]);
    expect(
      ids(
        run(
          'As a program officer, I want to practise a funding conversation with a nonprofit and receive feedback.',
        ),
      ),
    ).toEqual([role.youtubeId]);
  });
  it('AC-12.7 keeps branding as a finishing preference for a volunteer animation', () => {
    const animation = lesson(
      1,
      ['Volunteer onboarding', 'Video creation'],
      'Turn shift instructions into an animated welcome.',
    );
    const voice = lesson(
      2,
      ['Brand voice', 'Custom assistants'],
      'Write branded communications using an assistant.',
    );
    const { run } = fixture([voice, animation]);
    expect(
      ids(
        run(
          'Use these volunteer shift instructions for an animated welcome, with branding added at the end.',
        ),
      ),
    ).toEqual([animation.youtubeId]);
  });
  it('AC-12.7 does not extend an incidental negative clause into the tool used for review', () => {
    const review = lesson(
      1,
      ['Editing proofreading', 'Document review'],
      'Review draft claims and grammar.',
      ['Microsoft Word'],
    );
    const { run } = fixture([review]);
    const result = run(
      'Review the grammar in this draft letter and flag claims we cannot support, with edits and comments in Word.',
    );
    expect(result.interpretation.excludedTools).not.toContain('Microsoft Word');
    expect(result.interpretation.tools).toContain('Microsoft Word');
    expect(ids(result)).toEqual([review.youtubeId]);
  });
  it('AC-12.10 enforces a rules-out tool constraint before ranking eligible operations', () => {
    const macro = lesson(
      1,
      ['Budget consolidation', 'Spreadsheet automation'],
      'Combine budget files through a folder macro.',
      ['VBA'],
    );
    const { run } = fixture([macro]);
    const result = run(
      'Combine budget files from a folder into a master workbook. Our policy rules out VBA and macros.',
    );
    expect(result.interpretation.excludedTools).toContain('VBA');
    expect(result.recommendations).toEqual([]);
  });
  it('AC-12.8 scopes default evidence to the caller catalog rather than requiring all library identities', () => {
    const sum = lesson(
      1,
      ['Data aggregation', 'Spreadsheet formulas'],
      'Sum expenses by employee using conditional criteria.',
    );
    const { catalog } = fixture([sum]);
    expect(
      ids(
        recommendVideos(catalog, {
          prompt: 'Find the amount owed to each employee from their claims.',
        }),
      ),
    ).toEqual([sum.youtubeId]);
  });
  it('AC-12.7 recognizes conditional totals without requiring the name SUMIF', () => {
    const sum = lesson(
      1,
      ['Data aggregation', 'Spreadsheet formulas'],
      'Sum expenses by employee using conditional criteria.',
    );
    const formula = lesson(
      2,
      ['Spreadsheet formulas'],
      'Explain and repair a spreadsheet formula.',
    );
    const chart = lesson(3, ['Chart creation'], 'Chart an expense report.');
    const { run } = fixture([chart, formula, sum]);
    const result = run(
      'I need the amount owed to each employee from their expense claims.',
    );
    expect(ids(result)).toEqual([sum.youtubeId, formula.youtubeId]);
    expect(result.interpretation.desiredOutputs).toEqual(['formula']);
  });
  it('AC-12.7 distinguishes photographed feedback inputs from graphic design outputs', () => {
    const analysis = lesson(
      1,
      ['Survey analysis'],
      'Summarize scanned feedback forms and their numeric responses.',
    );
    const design = lesson(
      2,
      ['Design feedback'],
      'Critique a photo and report layout.',
    );
    const { run } = fixture([design, analysis]);
    const result = run(
      'I have photos of evaluation forms. Please make a report combining the feedback.',
    );
    expect(ids(result)).toEqual([analysis.youtubeId]);
    expect(result.interpretation.sourceMaterials).toEqual(['form']);
    expect(result.interpretation.desiredOutputs).not.toContain('image');
  });
  it('AC-12.8 requires chart instruction rather than the broad survey topic', () => {
    const charts = lesson(
      1,
      ['Survey analysis', 'Chart creation'],
      'Create a mean score chart by question.',
    );
    const themes = lesson(
      2,
      ['Survey analysis'],
      'Summarize themes in survey comments.',
    );
    const { run } = fixture([themes, charts]);
    expect(
      ids(run('Graph the average survey score for each question.')),
    ).toEqual([charts.youtubeId]);
  });
  it('AC-12.8 checks review compatibility before allowing same-output drafting examples', () => {
    const review = lesson(
      1,
      ['Editing proofreading', 'Document review'],
      'Review grammar with tracked edits and comments.',
    );
    const drafting = lesson(
      2,
      ['Document drafting'],
      'Draft a letter from notes.',
    );
    const { run } = fixture([drafting, review]);
    const result = run(
      'Review this draft letter for grammar and unsupported claims with comments I can accept or reject.',
    );
    expect(ids(result)).toEqual([review.youtubeId]);
    expect(result.interpretation.desiredOutputs).toEqual(['edited-document']);
  });
  it('AC-12.7 does not classify time available for a lesson as meeting-minutes output', () => {
    const teaching = lesson(
      1,
      ['Custom assistants', 'Lesson planning'],
      'A curriculum activity helper with reusable instructions.',
    );
    const minutes = lesson(2, ['Meeting minutes'], 'Generate meeting minutes.');
    const { run } = fixture([minutes, teaching]);
    const result = run(
      'Tutors need a reusable helper for an opening activity using our curriculum and the minutes available.',
    );
    expect(ids(result)).toContain(teaching.youtubeId);
    expect(result.interpretation.desiredOutputs).not.toContain('minutes');
    expect(result.interpretation.sourceMaterials).toEqual(['curriculum']);
  });
  it('AC-12.7 separates watching a presentation about agent design from producing slides or an agent', () => {
    const explanation = lesson(
      1,
      ['Custom assistants', 'Lesson planning'],
      'Explain accessible course agent design and model selection.',
    );
    const slides = lesson(
      2,
      ['Presentation creation'],
      'Generate an accessible course slide deck.',
    );
    const { run } = fixture([slides, explanation]);
    const result = run(
      'I want a presentation explaining an accessible course agent, not help creating slides.',
    );
    expect(ids(result)).toEqual([explanation.youtubeId]);
    expect(result.interpretation.desiredOutputs).toEqual([]);
    expect(result.interpretation.tasks).not.toContain('Presentation creation');
  });
  it('AC-12.7 distinguishes a vocabulary word from the Microsoft Word tool', () => {
    const vocabulary = lesson(
      1,
      ['Custom assistants', 'Lesson planning'],
      'A vocabulary helper creates example sentences.',
    );
    const word = lesson(2, ['Document drafting'], 'Draft a document in Word.', [
      'Microsoft Word',
    ]);
    const { run } = fixture([word, vocabulary]);
    const result = run(
      'A teaching helper should take a word and grade and return example sentences.',
    );
    expect(ids(result)).toContain(vocabulary.youtubeId);
    expect(result.interpretation.tools).not.toContain('Microsoft Word');
  });
  it('AC-12.8 requires the requested language instead of falling back to unrelated role plays', () => {
    const spanish = lesson(
      1,
      ['Language learning', 'Role play'],
      'Spanish conversation practice with corrections.',
    );
    const staff = lesson(
      2,
      ['Role play', 'Staff training'],
      'An employer pitch role play.',
    );
    const { run } = fixture([staff, spanish]);
    expect(
      ids(run('Practice a Spanish conversation and correct my mistakes.')),
    ).toEqual([spanish.youtubeId]);
    expect(
      ids(run('Practice a French conversation and correct my mistakes.')),
    ).toEqual([]);
  });
  it('AC-12.8 abstains when the required native application has no compatible lesson', () => {
    const photo = lesson(
      1,
      ['Photo editing'],
      'Make a dark photo brighter in Lightroom.',
      ['Adobe Lightroom'],
    );
    const app = lesson(2, ['App building'], 'Build an app for images.');
    const { run } = fixture([app, photo]);
    const result = run(
      'Use only the built-in Photos app to make a dark photo brighter. I need the actual controls.',
    );
    expect(result.recommendations).toEqual([]);
    expect(result.warnings).toHaveLength(1);
  });
  it('AC-12.7 keeps an exclusion list scoped across commas', () => {
    const photo = lesson(1, ['Photo editing'], 'Make a dark photo brighter.', [
      'Canva',
    ]);
    const { run } = fixture([photo]);
    const result = run(
      "Make a dark photo brighter. I can't install Lightroom, Canva or another editor.",
    );
    expect(result.interpretation.excludedTools).toContain('Canva');
    expect(result.recommendations).toEqual([]);
  });
  it('AC-12.8 accepts narrated conceptual instruction while rejecting mention-only evidence', () => {
    const conceptual = lesson(
      1,
      ['Custom assistants', 'Lesson planning'],
      'Explain a course agent and the model design.',
    );
    const { catalog, options } = fixture([conceptual]);
    const prompt = 'Explain the design of an agent for a personalized course.';
    const explained = {
      ...options,
      instructions: [
        {
          youtubeId: conceptual.youtubeId,
          task: 'Custom assistants',
          form: 'explained' as const,
        },
      ],
    };
    expect(ids(recommendVideos(catalog, { prompt }, explained))).toEqual([
      conceptual.youtubeId,
    ]);
    const mentioned = {
      ...options,
      instructions: [
        {
          youtubeId: conceptual.youtubeId,
          task: 'Custom assistants',
          form: 'mentioned' as const,
        },
      ],
    };
    expect(ids(recommendVideos(catalog, { prompt }, mentioned))).toEqual([]);
  });
  it('AC-12.9 preserves recommendations, reasons and input values when catalog and workflow order change', () => {
    const a = lesson(
      1,
      ['Spreadsheet formulas'],
      'Explain spreadsheet formula errors.',
    );
    const b = lesson(
      2,
      ['Spreadsheet formulas'],
      'Repair an existing spreadsheet calculation.',
    );
    const { catalog, options } = fixture([a, b]);
    const workflows = {
      artifacts: ['context', 'spreadsheet', 'formula'].map((id) => ({
        id,
        label: id,
        aliases: [id],
        tasks: [],
      })),
      workflows: [
        {
          youtubeId: a.youtubeId,
          task: 'Spreadsheet formulas',
          source: 'context',
          output: 'formula',
        },
        {
          youtubeId: a.youtubeId,
          task: 'Spreadsheet formulas',
          source: 'spreadsheet',
          output: 'formula',
        },
      ],
    };
    const config = { ...options, workflows };
    const request = { prompt: 'Explain and fix this formula error.' };
    const snapshot = JSON.stringify({ catalog, config, request });
    const result = recommendVideos(catalog, request, config);
    const reordered = recommendVideos(
      { ...catalog, items: [...catalog.items].reverse() },
      request,
      {
        ...config,
        workflows: {
          ...workflows,
          workflows: [...workflows.workflows].reverse(),
        },
        instructions: [...options.instructions!].reverse(),
      },
    );
    expect(reordered).toEqual(result);
    expect(JSON.stringify({ catalog, config, request })).toBe(snapshot);
  });
  it('AC-12.8 caps results at eight and supports zero-result limits', () => {
    const rows = Array.from({ length: 12 }, (_, i) =>
      lesson(
        i,
        ['Spreadsheet formulas'],
        'Explain a spreadsheet formula error.',
      ),
    );
    const { run } = fixture(rows);
    expect(
      run('Explain this formula error.', 100).recommendations,
    ).toHaveLength(8);
    expect(run('Explain this formula error.', 0).recommendations).toHaveLength(
      0,
    );
  });
  it('AC-12.8 excludes retired records and every copy of a duplicate ID', () => {
    const active = lesson(
      1,
      ['Spreadsheet formulas'],
      'Explain spreadsheet formula errors.',
    );
    const duplicate = lesson(
      2,
      ['Spreadsheet formulas'],
      'Explain formula errors.',
    );
    const retired = {
      ...lesson(3, ['Spreadsheet formulas'], 'Explain formula errors.'),
      status: 'retired' as const,
    };
    const { catalog, options } = fixture([active, duplicate]);
    const result = recommendVideos(
      { ...catalog, items: [...catalog.items, duplicate, retired] },
      { prompt: 'Explain this formula error.' },
      options,
    );
    expect(ids(result)).toEqual([active.youtubeId]);
  });
  it('AC-12.7 rejects blank and over-length inputs', () => {
    const { run } = fixture([
      lesson(1, ['Spreadsheet formulas'], 'Explain formula errors.'),
    ]);
    expect(run(' ').recommendations).toEqual([]);
    expect(() => run('Explain formula errors. '.repeat(30))).toThrow(
      RangeError,
    );
  });
});
