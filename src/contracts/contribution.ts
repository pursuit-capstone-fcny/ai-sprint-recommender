import { z } from 'zod';

const text = z.string().trim().min(1).max(500);
export const ContributionPolicySchema = z.strictObject({
  version: z.string().regex(/^[a-zA-Z0-9._-]{1,80}$/),
  topicPrompt: text,
  demoInvitation: text,
  purpose: text,
  access: text,
  owner: z.string().trim().min(1).max(200),
  retentionDays: z.number().int().min(1).max(365),
  demoOffers: z.boolean(),
});
export type ContributionPolicy = z.infer<typeof ContributionPolicySchema>;
const common = {
  schemaVersion: z.literal(1),
  type: z.literal('contribution'),
  requestId: z.uuid().transform((value) => value.toLowerCase()),
  time: z.iso.datetime(),
  policyVersion: ContributionPolicySchema.shape.version,
  topic: z.string().trim().min(1).max(1000),
};
export const ContributionSchema = z.discriminatedUnion('kind', [
  z.strictObject({ ...common, kind: z.literal('topic') }),
  z.strictObject({
    ...common,
    kind: z.literal('demo'),
    email: z.email().max(254),
    consent: z.literal(true),
  }),
]);
export type Contribution = z.infer<typeof ContributionSchema>;
export const ContributionConfigSchema = z.strictObject({
  endpoint: z
    .string()
    .regex(/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/),
  policy: ContributionPolicySchema,
});
export type ContributionConfig = z.infer<typeof ContributionConfigSchema>;
