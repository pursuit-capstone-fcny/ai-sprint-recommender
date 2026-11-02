import type { CatalogItem } from '../contracts/catalogItem';

function taskKeyFor(video: CatalogItem): string {
  return video.tasks[0]?.trim().toLowerCase() ?? '';
}

// A task tag is a category, not a video identity. Preserve relevance order,
// reserving only the slots needed for two real primary tasks when available.
// In three cards this permits two same-task options. Demoted items remain
// available after the window; blank and secondary tags do not add diversity.
export function applyAiDedupe<T extends { item: CatalogItem }>(
  sorted: T[],
  topN: number,
): T[] {
  const windowItems: T[] = [];
  const demoted: T[] = [];
  const seenTasks = new Set<string>();
  const requiredTasks = Math.min(
    2,
    topN,
    new Set(sorted.map(({ item }) => taskKeyFor(item)).filter(Boolean)).size,
  );
  let index = 0;

  while (index < sorted.length && windowItems.length < topN) {
    const entry = sorted[index];
    const key = taskKeyFor(entry.item);
    const addsTask = key !== '' && !seenTasks.has(key);
    const slotsLeft = topN - windowItems.length;
    const tasksNeeded = requiredTasks - seenTasks.size;
    if (!addsTask && slotsLeft <= tasksNeeded) {
      demoted.push(entry);
    } else {
      if (key) seenTasks.add(key);
      windowItems.push(entry);
    }
    index += 1;
  }

  const remainder = sorted.slice(index);
  return [...windowItems, ...demoted, ...remainder];
}
