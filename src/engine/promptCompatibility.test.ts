import { describe, expect, it } from 'vitest';
import { parsePublicCatalog } from '../contracts/publicCatalog';
import { recommendFromPrompt } from './prompt';
import type { WorkflowConfig } from './workflow';

const catalog = parsePublicCatalog({
  schemaVersion: 1,
  catalogVersion: `sha256:${'e'.repeat(64)}`,
  tasks: [
    'Photo editing',
    'Image generation',
    'Spreadsheet formulas',
    'Data capture',
    'Qualitative analysis',
    'Survey analysis',
  ],
  tools: [],
  functionAreas: [],
  synonyms: [],
  adjacentTools: [],
  items: [
    { youtubeId: 'compatPhoto', tasks: ['Photo editing'] },
    { youtubeId: 'compatImage', tasks: ['Image generation'] },
    { youtubeId: 'compatForm1', tasks: ['Spreadsheet formulas'] },
    { youtubeId: 'compatSheet', tasks: ['Data capture'] },
    { youtubeId: 'compatQual1', tasks: ['Qualitative analysis'] },
    { youtubeId: 'compatSurv1', tasks: ['Survey analysis'] },
  ].map((row) => ({
    ...row,
    title: 'Fictional lesson',
    description: 'Fictional content.',
    tools: [],
    functionAreas: [],
    status: 'active',
    startHere: false,
    addedAt: null,
    lengthSeconds: 100,
  })),
});
const workflows: WorkflowConfig = {
  artifacts: [
    { id: 'context', label: 'Brief', aliases: ['brief'], tasks: [] },
    {
      id: 'image',
      label: 'Image',
      aliases: ['image'],
      tasks: ['Photo editing', 'Image generation'],
    },
    {
      id: 'spreadsheet',
      label: 'Spreadsheet',
      aliases: ['spreadsheet'],
      tasks: ['Spreadsheet formulas', 'Data capture'],
    },
    {
      id: 'analysis',
      label: 'Analysis',
      aliases: ['analysis'],
      tasks: ['Qualitative analysis', 'Survey analysis'],
    },
  ],
  workflows: catalog.items.map((item) => ({
    youtubeId: item.youtubeId,
    task: item.tasks[0],
    source: 'context',
    output: ['compatPhoto', 'compatImage'].includes(item.youtubeId)
      ? 'image'
      : ['compatForm1', 'compatSheet'].includes(item.youtubeId)
        ? 'spreadsheet'
        : 'analysis',
  })),
};

describe('task compatibility and restrained discovery', () => {
  it.each([
    ['Photo editing', 'compatPhoto', 'compatImage'],
    ['Spreadsheet formulas', 'compatForm1', 'compatSheet'],
  ])(
    'AC-PM.33: %s cannot match another task through a shared artifact',
    (prompt, expected, rejected) => {
      const result = recommendFromPrompt(
        catalog,
        { prompt, limit: 8 },
        { workflows },
      );
      expect(result.recommendations.map((row) => row.item.youtubeId)).toEqual([
        expected,
      ]);
      expect(
        result.recommendations.some((row) => row.item.youtubeId === rejected),
      ).toBe(false);
    },
  );
  it('AC-PM.33: survey analysis is a labeled related component, not an exact qualitative-task match', () => {
    const result = recommendFromPrompt(
      catalog,
      { prompt: 'Qualitative analysis', limit: 8 },
      { workflows },
    );
    expect(result.recommendations.map((row) => row.item.youtubeId)).toEqual([
      'compatQual1',
      'compatSurv1',
    ]);
    expect(result.recommendations[1].matchType).toBe('fallback');
    expect(result.recommendations[1].evidence.matchedTasks).toEqual([]);
    expect(result.recommendations[1].reason).toContain(
      'Related task (Survey analysis)',
    );
  });
  it('AC-PM.33: a specific unknown request is not filled by unrelated task or Start-here tags', () => {
    const source = {
      ...catalog,
      items: catalog.items.map((row) => ({ ...row, startHere: true })),
    };
    const result = recommendFromPrompt(source, {
      prompt: 'Configure a telescope autoguider.',
      limit: 8,
    });
    expect(result.recommendations).toEqual([]);
    expect(result.warnings).not.toHaveLength(0);
  });
  it('AC-PM.33: at most three adequately supported lexical discoveries are returned', () => {
    const source = {
      ...catalog,
      items: Array.from({ length: 20 }, (_, index) => ({
        ...catalog.items[0],
        youtubeId: `fallback${String(index).padStart(3, '0')}`,
        tasks: [],
        title: index < 5 ? 'Archive cleanup' : 'Unrelated training',
      })),
    };
    const result = recommendFromPrompt(source, {
      prompt: 'Archive cleanup',
      limit: 8,
    });
    expect(result.recommendations).toHaveLength(3);
    expect(
      result.recommendations.every(
        (row) =>
          row.item.title === 'Archive cleanup' &&
          row.evidence.kind === 'keyword',
      ),
    ).toBe(true);
    expect(result).toEqual(
      recommendFromPrompt(
        { ...source, items: [...source.items].reverse() },
        { prompt: 'Archive cleanup', limit: 8 },
      ),
    );
  });
});
