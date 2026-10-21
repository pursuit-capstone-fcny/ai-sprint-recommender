import { z } from 'zod';

const text = z.string().trim().min(1);
const tag = text.refine((value) => !value.includes(','));
const tags = z.array(tag);

export const PublicCatalogItemSchema = z.object({
  youtubeId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
  title: text,
  description: text,
  functionAreas: tags,
  tasks: tags,
  tools: tags,
  addedAt: z.iso.date().nullable(),
  lengthSeconds: z.number().int().positive().nullable(),
  status: z.enum(['active', 'retired']),
  startHere: z.boolean(),
});

export const categoryKeys = {
  functionArea: 'functionAreas',
  tool: 'tools',
  task: 'tasks',
} as const;

export const TagCategorySchema = z.enum(['functionArea', 'tool', 'task']);
export type TagCategory = z.infer<typeof TagCategorySchema>;
export const SynonymSchema = z.object({
  alias: text,
  category: TagCategorySchema,
  target: tag,
});
export const AdjacentToolSchema = z.object({
  source: tag,
  related: tag,
  task: tag,
});
export const PublicCatalogDataSchema = z.object({
  schemaVersion: z.literal(1),
  items: z.array(PublicCatalogItemSchema),
  functionAreas: tags,
  tools: tags,
  tasks: tags,
  synonyms: z.array(SynonymSchema),
  adjacentTools: z.array(AdjacentToolSchema),
});

export function normalizeTerm(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export const PublicCatalogSchema = PublicCatalogDataSchema.extend({
  catalogVersion: z.string().regex(/^sha256:[a-f0-9]{64}$/),
}).superRefine((catalog, ctx) => {
  const invalid = (path: (string | number)[]) =>
    ctx.addIssue({
      code: 'custom',
      path,
      message: 'Invalid catalog reference',
    });
  for (const key of Object.values(categoryKeys)) {
    const values = catalog[key].map(normalizeTerm);
    if (
      values.some((value) => !value) ||
      new Set(values).size !== values.length
    ) {
      invalid([key]);
    }
  }
  const ids = new Set<string>();
  catalog.items.forEach((item, index) => {
    if (item.status !== 'active' || ids.has(item.youtubeId)) {
      invalid(['items', index, 'youtubeId']);
    }
    ids.add(item.youtubeId);
    for (const key of Object.values(categoryKeys)) {
      if (
        item[key].some((value) => !catalog[key].includes(value)) ||
        new Set(item[key]).size !== item[key].length
      ) {
        invalid(['items', index, key]);
      }
    }
  });
  const aliases = new Set<string>();
  catalog.synonyms.forEach((synonym, index) => {
    const key = `${synonym.category}:${normalizeTerm(synonym.alias)}`;
    const dictionary = catalog[categoryKeys[synonym.category]];
    const canonical = dictionary.find(
      (value) => normalizeTerm(value) === normalizeTerm(synonym.alias),
    );
    if (
      !normalizeTerm(synonym.alias) ||
      !dictionary.includes(synonym.target) ||
      aliases.has(key) ||
      (canonical !== undefined && canonical !== synonym.target)
    ) {
      invalid(['synonyms', index]);
    }
    aliases.add(key);
  });
  const adjacent = new Set<string>();
  catalog.adjacentTools.forEach((mapping, index) => {
    const key = JSON.stringify(mapping);
    if (
      !catalog.tools.includes(mapping.source) ||
      !catalog.tools.includes(mapping.related) ||
      !catalog.tasks.includes(mapping.task) ||
      mapping.source === mapping.related ||
      adjacent.has(key)
    ) {
      invalid(['adjacentTools', index]);
    }
    adjacent.add(key);
  });
});

export type PublicCatalogItem = z.infer<typeof PublicCatalogItemSchema>;
export type PublicCatalogData = z.infer<typeof PublicCatalogDataSchema>;
export type PublicCatalog = z.infer<typeof PublicCatalogSchema>;

// Shared entry point for server validation and browser integration.
export function parsePublicCatalog(value: unknown): PublicCatalog {
  return PublicCatalogSchema.parse(value);
}
