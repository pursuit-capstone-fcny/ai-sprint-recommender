import { z } from 'zod';
import { UsageEventSchema } from './usageEvent';

export const USAGE_BUFFER_PATH = '/api/usage';
export const UsageBatchSchema = z
  .strictObject({
    events: z.array(UsageEventSchema).min(1).max(20),
  })
  .refine(({ events }) =>
    events.every(
      (event) =>
        event.sessionId === events[0].sessionId &&
        event.catalogVersion === events[0].catalogVersion &&
        event.type !== 'feedback',
    ),
  );
