import { z } from 'zod';

/**
 * Message validation schemas
 */

export const messageCreateSchema = z.object({
  text: z.string().min(1, 'Message text is required'),
  reference_message_id: z.string().uuid().optional(),
  files: z.array(z.object({
    id: z.string(),
  })).optional(),
  channel: z.enum(['patient', 'support']).optional(),
});

/**
 * Type exports
 */

export type MessageCreateInput = z.infer<typeof messageCreateSchema>;
