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
