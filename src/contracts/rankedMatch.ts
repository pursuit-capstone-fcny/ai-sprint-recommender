import { z } from 'zod';
import { CatalogItemSchema } from './catalogItem';

export const RankedMatchSchema = z.object({
  item: CatalogItemSchema,
  reason: z.string().min(1),
});

export type RankedMatch = z.infer<typeof RankedMatchSchema>;
