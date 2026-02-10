import { z } from 'zod';
import { questionnaireAnswersSchema, shippingInfoSchema } from './common.schema';

/**
 * Order validation schemas
 */

export const createPaymentIntentSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().length(3).optional().default('usd'),
  treatmentId: z.string().uuid('Invalid treatment ID').optional(),
  programId: z.string().uuid('Invalid program ID').optional(),
  selectedProducts: z.record(z.string(), z.number().int().positive('Quantity must be positive')),
  selectedPlan: z.string().optional().default('monthly'),
  shippingInfo: shippingInfoSchema,
  questionnaireAnswers: questionnaireAnswersSchema.optional(),
  affiliateId: z.string().uuid('Invalid affiliate ID').optional(),
}).refine(
  (data) => data.treatmentId || data.programId,
  { message: 'Either treatmentId or programId must be provided' }
);

export const createProductSubscriptionSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  shippingInfo: shippingInfoSchema,
  questionnaireAnswers: questionnaireAnswersSchema.optional(),
  useOnBehalfOf: z.boolean().optional(),
});

/**
 * Type exports
 */

export type CreatePaymentIntentInput = z.infer<typeof createPaymentIntentSchema>;
export type CreateProductSubscriptionInput = z.infer<typeof createProductSubscriptionSchema>;
