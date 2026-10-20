import { z } from 'zod';

export const CatalogItemSchema = z.object({
  youtubeId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
  title: z.string(),
  description: z.string(),
  functionAreas: z.array(z.string()),
  tasks: z.array(z.string()),
  tools: z.array(z.string()),
  addedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(['active', 'retired']),
  isStartHere: z.boolean(),
  durationSeconds: z.number().positive().optional(),
});

export type CatalogItem = z.infer<typeof CatalogItemSchema>;
