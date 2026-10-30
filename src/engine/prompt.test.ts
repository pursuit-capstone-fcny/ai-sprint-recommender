import { describe, expect, it } from 'vitest';
import {
  parsePublicCatalog,
  type PublicCatalog,
  type PublicCatalogItem,
} from '../contracts/publicCatalog';
import { recommendFromPrompt, type TaskInstruction } from './prompt';

function item(
  youtubeId: string,
  overrides: Partial<PublicCatalogItem> = {},
): PublicCatalogItem {
  return {
    youtubeId,
    title: 'Example lesson',
    description: 'A fictional instructional example.',
    tasks: [],
    tools: [],
    functionAreas: [],
    addedAt: null,
    lengthSeconds: 240,
    status: 'active',
    startHere: false,
    ...overrides,
  };
}

const rows = [
  item('promptDeck1', {
    title: 'Create a slide presentation',
    description:
      'Turn an existing document into an outline and a board presentation.',
    tasks: ['Presentation creation'],
    tools: ['Gamma'],
    functionAreas: ['Communications'],
  }),
  item('promptDeck2', {
    title: 'A board document presentation deck',
    description: 'Walk through a prepared deck.',
    tasks: ['Presentation creation'],
    tools: ['Claude'],
    functionAreas: ['Operations'],
  }),
  item('promptPlan1', {
    title: 'Board document planning',
    description: 'Work on a document for our board with AI.',
    tasks: ['Strategic planning'],
    tools: ['Gamma'],
    functionAreas: ['Operations'],
  }),
];

function catalog(overrides: Partial<PublicCatalog> = {}): PublicCatalog {
  return parsePublicCatalog({
    schemaVersion: 1,
    catalogVersion: `sha256:${'a'.repeat(64)}`,
    items: rows,
    tasks: ['Presentation creation', 'Strategic planning'],
    tools: ['Gamma', 'Claude', 'ChatGPT'],
    functionAreas: ['Communications', 'Operations'],
    synonyms: [
      {
        alias: 'presentation',
        category: 'task',
        target: 'Presentation creation',
      },
      { alias: 'slides', category: 'task', target: 'Presentation creation' },
      { alias: 'deck', category: 'task', target: 'Presentation creation' },
    ],
    adjacentTools: [
      { source: 'ChatGPT', related: 'Claude', task: 'Presentation creation' },
    ],
    ...overrides,
  });
}

const instructions: TaskInstruction[] = [
  {
    youtubeId: 'promptDeck1',
    task: 'Presentation creation',
    form: 'demonstrated',
  },
  {
    youtubeId: 'promptDeck2',
    task: 'Presentation creation',
    form: 'walkthrough',
  },
];

describe('prompt matcher draft', () => {
  it('AC-PM.32: word-for-word language does not exclude the Word product', () => {
    const source = catalog({
      tools: ['Gamma', 'Claude', 'ChatGPT', 'Microsoft Word'],
      synonyms: [{ alias: 'word', category: 'tool', target: 'Microsoft Word' }],
    });
    const result = recommendFromPrompt(source, {
      prompt: 'Make minutes, not a word-for-word transcript.',
    });
    expect(result.interpretation.tools).toEqual([]);
    expect(result.interpretation.excludedTools).toEqual([]);
  });
  it('AC-PM.1: ranks the demonstrated task above a prepared deck and board-context overlap', () => {
    const result = recommendFromPrompt(
      catalog(),
      {
        prompt: 'I have a long document and need a presentation for our board.',
        functionArea: 'Operations',
      },
      { instructions },
    );
    expect(result.interpretation.tasks).toEqual(['Presentation creation']);
    expect(result.recommendations.map((match) => match.item.youtubeId)).toEqual(
      ['promptDeck1', 'promptDeck2'],
    );
    expect(
      result.recommendations.every((row) =>
        row.evidence.matchedTasks.includes('Presentation creation'),
      ),
    ).toBe(true);
    expect(result.recommendations[0].evidence.instructions).toEqual([
      { task: 'Presentation creation', form: 'demonstrated' },
    ]);
  });

  it.each([
    'make a deck',
    'I want to learn how to make a deck',
    'slides',
    'presentation',
  ])(
    'AC-PM.2: resolves maintained aliases and ignores filler in %s',
    (prompt) => {
      const result = recommendFromPrompt(
        catalog(),
        { prompt },
        { instructions },
      );
      expect(result.interpretation.tasks).toEqual(['Presentation creation']);
      expect(
        result.recommendations.map((match) => match.item.youtubeId),
      ).toEqual(['promptDeck1', 'promptDeck2']);
    },
  );

  it('AC-PM.2: a new catalog alias works without modifying matcher vocabulary', () => {
    const original = catalog();
    expect(
      recommendFromPrompt(original, { prompt: 'pitch pack' }).interpretation
        .tasks,
    ).toEqual([]);
    const updated = catalog({
      synonyms: [
        ...original.synonyms,
        {
          alias: 'pitch pack',
          category: 'task',
          target: 'Presentation creation',
        },
      ],
    });
    expect(
      recommendFromPrompt(updated, { prompt: 'pitch pack' }).interpretation
        .tasks,
    ).toEqual(['Presentation creation']);
  });

  it('AC-PM.2: matches phrases across punctuation without matching substrings', () => {
    const source = catalog({
      synonyms: [
        {
          alias: 'slide deck',
          category: 'task',
          target: 'Presentation creation',
        },
      ],
    });
    expect(
      recommendFromPrompt(source, { prompt: 'slide/deck' }).interpretation
        .tasks,
    ).toEqual(['Presentation creation']);
    expect(
      recommendFromPrompt(source, { prompt: 'slide decking' }).interpretation
        .tasks,
    ).toEqual([]);
  });

  it('AC-PM.2: a longer tool name wins over its known prefix', () => {
    const source = catalog({
      tools: ['Gamma', 'Claude', 'Claude Design', 'ChatGPT'],
    });
    expect(
      recommendFromPrompt(source, { prompt: 'Claude Design' }).interpretation
        .tools,
    ).toEqual(['Claude Design']);
  });

  it('AC-PM.3: task coverage precedes tool, department and instruction bonuses', () => {
    const combined = item('promptBoth1', {
      tasks: ['Presentation creation', 'Strategic planning'],
    });
    const source = catalog({ items: [...rows, combined] });
    const result = recommendFromPrompt(
      source,
      {
        prompt: 'Presentation creation and strategic planning in Gamma',
        functionArea: 'Operations',
      },
      { instructions },
    );
    expect(result.recommendations[0].item.youtubeId).toBe('promptBoth1');
    expect(result.recommendations[0].evidence.taskCoverage).toBe(1);
  });

  it('AC-PM.3: repetition and several aliases for one concept do not inflate coverage or scores', () => {
    const source = catalog();
    const single = recommendFromPrompt(source, {
      prompt: 'board presentation',
    });
    const repeated = recommendFromPrompt(source, {
      prompt: 'board board presentation slides deck deck',
    });
    expect(repeated).toEqual(single);
  });

  it('AC-PM.3: does not demote direct-task alternatives to promote unrelated task diversity', () => {
    const result = recommendFromPrompt(
      catalog(),
      { prompt: 'presentation for our board', limit: 2 },
      { instructions },
    );
    expect(
      result.recommendations.every((match) => match.evidence.kind === 'task'),
    ).toBe(true);
    expect(result.recommendations).toHaveLength(2);
  });

  it('AC-PM.3: an explicitly mentioned-only task is not a direct match', () => {
    const result = recommendFromPrompt(
      catalog(),
      { prompt: 'deck' },
      {
        instructions: [
          {
            youtubeId: 'promptDeck1',
            task: 'Presentation creation',
            form: 'mentioned',
          },
        ],
      },
    );
    expect(result.recommendations.map((match) => match.item.youtubeId)).toEqual(
      ['promptDeck2'],
    );
  });

  it('AC-PM.4: extracts tools from the prompt but task relevance still outranks tool-only matches', () => {
    const result = recommendFromPrompt(catalog(), {
      prompt: 'presentation in Gamma',
    });
    expect(result.interpretation.tools).toEqual(['Gamma']);
    expect(result.recommendations.map((match) => match.item.youtubeId)).toEqual(
      ['promptDeck1', 'promptDeck2'],
    );
    expect(result.recommendations[0].reason).toContain('catalog tools: Gamma');
  });

  it('AC-PM.4: uses directional, task-scoped adjacency only', () => {
    const source = catalog();
    const result = recommendFromPrompt(source, {
      prompt: 'presentation in ChatGPT',
    });
    expect(result.recommendations[0].item.youtubeId).toBe('promptDeck2');
    expect(result.recommendations[0].evidence.relatedTools).toEqual(['Claude']);
    const noTask = recommendFromPrompt(source, { prompt: 'ChatGPT' });
    expect(noTask.recommendations).toEqual([]);
    const reverse = recommendFromPrompt(source, {
      prompt: 'presentation in Claude',
    });
    expect(
      reverse.recommendations.find(
        (match) => match.item.youtubeId === 'promptDeck1',
      )?.evidence.relatedTools,
    ).toEqual([]);
  });

  it('AC-PM.4: reports that flat tool tags cannot verify an only-tool restriction', () => {
    const result = recommendFromPrompt(catalog(), {
      prompt: 'presentation using only Gamma',
    });
    expect(result.recommendations).toEqual([]);
    expect(result.warnings).toHaveLength(1);
  });

  it('AC-PM.4: not only is neither a strict-tool requirement nor an exclusion', () => {
    const result = recommendFromPrompt(catalog(), {
      prompt: 'presentation with not only Gamma',
    });
    expect(result.warnings).toEqual([]);
    expect(result.interpretation.excludedTools).toEqual([]);
    expect(result.recommendations).not.toHaveLength(0);
  });

  it('AC-PM.5: applies direct tool exclusions before every result group', () => {
    const source = catalog({
      items: [
        ...rows,
        item('promptIntro', { tools: ['Claude'], startHere: true }),
      ],
    });
    const result = recommendFromPrompt(source, {
      prompt: 'presentation without Claude',
    });
    expect(result.interpretation.excludedTools).toEqual(['Claude']);
    expect(result.recommendations.map((match) => match.item.youtubeId)).toEqual(
      ['promptDeck1'],
    );
    expect(
      recommendFromPrompt(source, { prompt: 'asdf without Claude' })
        .recommendations,
    ).toEqual([]);
  });

  it('AC-PM.5: excludes a negated task without promoting its words as lexical evidence', () => {
    const result = recommendFromPrompt(catalog(), {
      prompt: 'not presentation; strategic planning',
    });
    expect(result.interpretation.tasks).toEqual(['Strategic planning']);
    expect(result.interpretation.excludedTasks).toEqual([
      'Presentation creation',
    ]);
    expect(result.recommendations.map((match) => match.item.youtubeId)).toEqual(
      ['promptPlan1'],
    );
  });

  it('AC-PM.5: lack of tool experience is not an exclusion', () => {
    const result = recommendFromPrompt(catalog(), {
      prompt: 'I have no Gamma experience; help with a presentation',
    });
    expect(result.interpretation.excludedTools).toEqual([]);
    expect(result.interpretation.tools).toEqual(['Gamma']);
  });

  it('AC-PM.6: orders lexical matches by weighted unique keywords and labels them separately', () => {
    const source = catalog({
      items: [
        item('promptDesc1', { description: 'A lesson about archive cleanup.' }),
        item('promptTitle', { title: 'Archive cleanup' }),
      ],
    });
    const result = recommendFromPrompt(source, { prompt: 'archive' });
    expect(result.recommendations.map((match) => match.item.youtubeId)).toEqual(
      ['promptTitle'],
    );
    expect(
      result.recommendations.every((match) => match.matchType === 'fallback'),
    ).toBe(true);
    expect(result.recommendations[0].reason).toBe('Keyword match: archive.');
  });

  it('AC-PM.6: filler or nonsense returns only approved Start-here items, or nothing', () => {
    const intro = item('promptIntro', { startHere: true });
    for (const prompt of ['', 'I want to learn how to']) {
      expect(
        recommendFromPrompt(catalog(), { prompt }).recommendations,
      ).toEqual([]);
      expect(
        recommendFromPrompt(catalog({ items: [...rows, intro] }), { prompt })
          .recommendations[0].evidence.kind,
      ).toBe('start-here');
    }
    expect(
      recommendFromPrompt(catalog({ items: [...rows, intro] }), {
        prompt: 'asdf',
      }).recommendations,
    ).toEqual([]);
  });

  it('AC-PM.7: excludes retired items and every copy of duplicate IDs', () => {
    // Deliberately bypass the catalog validator to verify defensive eligibility.
    const source = {
      ...catalog(),
      items: [rows[0], rows[0], { ...rows[1], status: 'retired' as const }],
    };
    expect(
      recommendFromPrompt(source, { prompt: 'presentation' }).recommendations,
    ).toEqual([]);
  });

  it('AC-PM.7: missing task coverage gives an honest warning', () => {
    const result = recommendFromPrompt(catalog({ items: [rows[2]] }), {
      prompt: 'presentation board',
    });
    expect(result.recommendations).toEqual([]);
    expect(result.warnings).toHaveLength(1);
  });

  it('AC-PM.8: does not mutate inputs and ignores item, dictionary and evidence ordering', () => {
    const source = catalog();
    const snapshot = JSON.stringify(source);
    const first = recommendFromPrompt(
      source,
      { prompt: 'presentation board' },
      { instructions },
    );
    const reordered = {
      ...source,
      items: [...source.items].reverse(),
      tasks: [...source.tasks].reverse(),
      synonyms: [...source.synonyms].reverse(),
    };
    expect(
      recommendFromPrompt(
        reordered,
        { prompt: 'presentation board' },
        { instructions: [...instructions].reverse() },
      ),
    ).toEqual(first);
    expect(JSON.stringify(source)).toBe(snapshot);
  });

  it('AC-PM.8: fully tied videos use known dates then ordinal IDs', () => {
    const source = catalog({
      items: [
        item('promptTie02'),
        item('promptTie01'),
        item('promptNewer', { addedAt: '2026-01-01' }),
      ].map((row) => ({ ...row, tasks: ['Presentation creation'] })),
    });
    expect(
      recommendFromPrompt(source, { prompt: 'deck' }).recommendations.map(
        (match) => match.item.youtubeId,
      ),
    ).toEqual(['promptNewer', 'promptTie01', 'promptTie02']);
  });

  it('AC-PM.8: rejects invalid evidence and invalid request bounds', () => {
    expect(() =>
      recommendFromPrompt(
        catalog(),
        { prompt: 'deck' },
        { instructions: [...instructions, instructions[0]] },
      ),
    ).toThrow('Invalid or duplicate');
    expect(() =>
      recommendFromPrompt(catalog(), { prompt: 'x'.repeat(501) }),
    ).toThrow(RangeError);
    expect(() =>
      recommendFromPrompt(catalog(), { prompt: 'deck', limit: -1 }),
    ).toThrow(RangeError);
    expect(
      recommendFromPrompt(catalog(), { prompt: 'deck', limit: 0 })
        .recommendations,
    ).toEqual([]);
  });
});
