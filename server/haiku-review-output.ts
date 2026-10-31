import { z } from 'zod';
import { MAX_RECOMMENDATIONS } from '../src/contracts/recommendation';

// These are temporary model judgments, never benchmark labels. A score can
// remove a draft pick or admit an alternative; it cannot invent an ID.
export function reviewedIds(value: unknown, ids: string[], priority: number[]) {
  const keys = ids.map((_, i) => `candidate${i}`);
  const schema = z.strictObject(
    Object.fromEntries(
      keys.map((key) => [
        key,
        z.union([z.literal(0), z.literal(1), z.literal(2)]),
      ]),
    ),
  );
  const parsed = schema.safeParse(value);
  if (
    !parsed.success ||
    priority.length !== ids.length ||
    new Set(priority).size !== ids.length ||
    priority.some(
      (index) => !Number.isInteger(index) || index < 0 || index >= ids.length,
    )
  )
    return null;
  return ids
    .map((id, index) => ({ id, index, score: parsed.data[keys[index]] }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || priority[a.index] - priority[b.index])
    .slice(0, MAX_RECOMMENDATIONS)
    .map((item) => item.id);
}
