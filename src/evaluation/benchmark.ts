import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { PublicCatalogSchema } from '../contracts/publicCatalog';
import { RecommendationRequestSchema } from '../contracts/recommendation';

const label = z.strictObject({
  youtubeId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
  reason: z.string().trim().min(1),
});
export const BenchmarkSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    id: z.string().regex(/^[a-z0-9-]+$/),
    approval: z.discriminatedUnion('status', [
      z.strictObject({ status: z.literal('draft') }),
      z.strictObject({
        status: z.literal('approved'),
        approvedBy: z.string().trim().min(1),
        approvedAt: z.iso.date(),
        evidence: z.string().trim().min(1),
      }),
    ]),
    catalog: PublicCatalogSchema,
    profiles: z
      .array(
        z.strictObject({
          id: z.string().regex(/^[a-z0-9-]+$/),
          input: RecommendationRequestSchema.omit({ catalogVersion: true }),
          ideal: z.array(label).min(1),
          good: z.array(label),
        }),
      )
      .length(10),
  })
  .superRefine((benchmark, ctx) => {
    const invalid = () =>
      ctx.addIssue({
        code: 'custom',
        message: 'Invalid benchmark reference or labels',
      });
    const ids = new Set(benchmark.catalog.items.map((item) => item.youtubeId));
    if (new Set(benchmark.profiles.map((profile) => profile.id)).size !== 10)
      invalid();
    for (const profile of benchmark.profiles) {
      const labels = [...profile.ideal, ...profile.good].map(
        (pick) => pick.youtubeId,
      );
      if (
        labels.length < 2 ||
        new Set(labels).size !== labels.length ||
        labels.some((id) => !ids.has(id))
      )
        invalid();
      if (
        profile.input.functionArea !== null &&
        !benchmark.catalog.functionAreas.includes(profile.input.functionArea)
      )
        invalid();
      if (
        profile.input.tools.some(
          (tool) => !benchmark.catalog.tools.includes(tool),
        )
      )
        invalid();
    }
  });

export type Benchmark = z.infer<typeof BenchmarkSchema>;
export type BenchmarkProfile = Benchmark['profiles'][number];

export function parseBenchmark(value: unknown): Benchmark {
  const benchmark = BenchmarkSchema.parse(value);
  // The public parser strips unknown fields. Evaluation fixtures must not hide them.
  if (!isDeepStrictEqual(value, benchmark))
    throw new Error('Benchmark contains noncanonical or private fields.');
  const { catalogVersion, ...data } = benchmark.catalog;
  if (
    catalogVersion !==
    `sha256:${createHash('sha256').update(JSON.stringify(data)).digest('hex')}`
  ) {
    throw new Error('Frozen catalog content does not match its version.');
  }
  return benchmark;
}

export function benchmarkFingerprint(benchmark: Benchmark): string {
  return createHash('sha256').update(JSON.stringify(benchmark)).digest('hex');
}
