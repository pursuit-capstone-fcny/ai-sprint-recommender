import { describe, expect, it } from 'vitest';
import { haikuTaskScope } from './haiku-task-scope';
import { catalog } from './test-helpers';

const items = [
  ['audio creation'],
  ['song creation'],
  ['flier design'],
  ['presentation creation'],
  ['graphic design'],
  ['document organization'],
  ['staff AI adoption'],
  ['market research', 'negotiation preparation'],
  ['job application drafting', 'interview practice'],
].map((tasks, i) => ({
  ...catalog.items[0],
  youtubeId: `scope${String(i).padStart(6, '0')}`,
  tasks,
}));
const kept = (goal: string) =>
  haikuTaskScope(items, goal).map((item) => items.indexOf(item));

describe('test-only task scope', () => {
  it('excludes unrelated media from an explicit presentation while retaining supporting methods', () => {
    expect(kept('Make a presentation from our project notes')).toEqual([
      3, 4, 5, 8,
    ]);
  });
  it('allows explicitly requested audio, songs and handouts, including mixed outputs', () => {
    expect(kept('Create a podcast and a slide deck')).toContain(0);
    expect(kept('Write a song')).toContain(1);
    expect(kept('Design a flyer')).toContain(2);
  });
  it('keeps blank browsing and ambiguous work free of output filtering', () => {
    expect(kept('')).toHaveLength(items.length);
    expect(kept('Help with our outreach')).toEqual([0, 1, 2, 3, 4, 5, 8]);
  });
  it('does not invent an AI-adoption or purchasing task from a generic conversation goal', () => {
    expect(
      kept('Prepare for a sensitive discussion with a volunteer'),
    ).not.toContain(6);
    expect(
      kept('Prepare for a sensitive discussion with a volunteer'),
    ).not.toContain(7);
    expect(kept('Help coworkers learn AI')).toContain(6);
    expect(kept('Prepare to negotiate a service contract')).toContain(7);
  });
  it('distinguishes grant or program records from job-seeking work', () => {
    expect(kept('Organize attendance records for follow-up')).not.toContain(8);
    expect(kept('Organize my job application records')).toContain(8);
    expect(kept('Prepare a grant application')).not.toContain(2);
  });
  it('keeps a mixed-output tutorial when one demonstrated output matches', () => {
    const mixed = {
      ...items[0],
      tasks: ['audio creation', 'presentation creation'],
    };
    expect(haikuTaskScope([mixed], 'Make a slide presentation')).toEqual([
      mixed,
    ]);
  });
  it('never mutates catalog metadata', () => {
    const before = structuredClone(items);
    haikuTaskScope(items, 'Make a report');
    expect(items).toEqual(before);
  });
});
