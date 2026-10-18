import type { CatalogItem } from '../contracts/catalogItem';

function taskKeyFor(video: CatalogItem): string {
  const primaryTask = video.tasks[0];
  return primaryTask !== undefined
    ? primaryTask.trim().toLowerCase()
    : `__unique__:${video.youtubeId}`;
}

// AC-11.5: within the top N, keep at most one video per task across tools.
// Demotes duplicates to just after the window (not dropped), and promotes
// the next distinct-task video up to fill the vacated slot.
export function applyDedupe<T extends { item: CatalogItem }>(
  sorted: T[],
  topN: number,
): T[] {
  const windowItems: T[] = [];
  const demoted: T[] = [];
  const seenTasks = new Set<string>();
  let index = 0;

  while (index < sorted.length && windowItems.length < topN) {
    const entry = sorted[index];
    const key = taskKeyFor(entry.item);
    if (seenTasks.has(key)) {
      demoted.push(entry);
    } else {
      seenTasks.add(key);
      windowItems.push(entry);
    }
    index += 1;
  }

  const remainder = sorted.slice(index);
  return [...windowItems, ...demoted, ...remainder];
}
