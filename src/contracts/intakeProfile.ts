import { z } from 'zod';

export const IntakeProfileSchema = z.object({
  functionArea: z.string().nullable(),
  goalWords: z.array(z.string()),
  tools: z.array(z.string()),
});

export type IntakeProfile = z.infer<typeof IntakeProfileSchema>;
