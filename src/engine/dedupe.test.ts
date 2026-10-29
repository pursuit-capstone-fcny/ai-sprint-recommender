import { describe, expect, it } from 'vitest';
import type { CatalogItem } from '../contracts/catalogItem';
import { applyDedupe } from './dedupe';

function picks(tasks: string[][]) {
  return tasks.map((task, index) => ({
    item: {
      youtubeId: `fictional0${index}`,
      title: `[Fixture] Distinct tutorial ${index}`,
      description: 'Fictional public catalog item.',
      functionAreas: [],
      tasks: task,
      tools: [],
      status: 'active',
      addedAt: null,
      isStartHere: false,
    } satisfies CatalogItem,
  }));
}

describe('task diversity without discarding distinct videos', () => {
  it('keeps two same-task videos alongside a different primary task', () => {
    const ranked = picks([['attendance'], ['attendance'], ['scheduling']]);
    expect(applyDedupe(ranked, 3)).toEqual(ranked);
  });

  it('demotes the third same-task video and retains every item in stable order', () => {
    const ranked = picks([
      ['attendance'],
      ['attendance'],
      ['attendance'],
      ['scheduling'],
      ['outreach'],
    ]);
    const snapshot = structuredClone(ranked);
    expect(applyDedupe(ranked, 3)).toEqual([
      ranked[0],
      ranked[1],
      ranked[3],
      ranked[2],
      ranked[4],
    ]);
    expect(ranked).toEqual(snapshot);
  });

  it('does not mistake blank or secondary tags for another primary task', () => {
    const ranked = picks([
      ['attendance'],
      [' ATTENDANCE ', 'scheduling'],
      ['  '],
      [],
      ['scheduling'],
    ]);
    expect(applyDedupe(ranked, 3)).toEqual([
      ranked[0],
      ranked[1],
      ranked[4],
      ranked[2],
      ranked[3],
    ]);
  });

  it('preserves an untagged pick when the window has room for two primary tasks', () => {
    const ranked = picks([[], [], ['attendance'], ['scheduling']]);
    expect(applyDedupe(ranked, 3)).toEqual([
      ranked[0],
      ranked[2],
      ranked[3],
      ranked[1],
    ]);
  });

  it('leaves an already diverse ranking and a single-task catalog unchanged', () => {
    for (const tasks of [
      [['attendance'], ['scheduling'], ['outreach'], ['attendance']],
      [['attendance'], ['attendance'], ['attendance']],
      [[], [], []],
    ]) {
      const ranked = picks(tasks);
      expect(applyDedupe(ranked, 3)).toEqual(ranked);
    }
  });

  it('handles empty, zero, one and two-slot windows', () => {
    expect(applyDedupe([], 3)).toEqual([]);
    const ranked = picks([['attendance'], ['attendance'], ['scheduling']]);
    expect(applyDedupe(ranked, 0)).toEqual(ranked);
    expect(applyDedupe(ranked, 1)).toEqual(ranked);
    expect(applyDedupe(ranked, 2)).toEqual([ranked[0], ranked[2], ranked[1]]);
  });
});
