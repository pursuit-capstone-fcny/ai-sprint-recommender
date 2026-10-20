import { z } from 'zod';
import {
  PublicCatalogItemSchema,
  type PublicCatalogItem,
} from './publicCatalog';

// Preserve the engine/card names while sharing the public field validation.
export const CatalogItemSchema = PublicCatalogItemSchema.omit({
  startHere: true,
  lengthSeconds: true,
}).extend({
  isStartHere: z.boolean(),
  durationSeconds: z.number().int().positive().optional(),
});

export type CatalogItem = z.infer<typeof CatalogItemSchema>;

export function toCatalogItem(item: PublicCatalogItem): CatalogItem {
  const { startHere, lengthSeconds, ...fields } = item;
  return {
    ...fields,
    isStartHere: startHere,
    ...(lengthSeconds === null ? {} : { durationSeconds: lengthSeconds }),
  };
}
