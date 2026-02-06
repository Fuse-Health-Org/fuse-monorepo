import { z } from 'zod';
import { paginationSchema, uuidSchema } from './common.schema';

/**
 * Product validation schemas
 */

export const productCreateSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(200),
  description: z.string().min(1, 'Product description is required'),
  price: z.number().positive('Price must be positive'),
  activeIngredients: z.array(z.string()).min(1, 'At least one active ingredient is required'),
  placeholderSig: z.string().min(1, 'Placeholder Sig is required'),
  imageUrl: z.string().url('Invalid image URL').optional(),
  pharmacyProvider: z.string().optional(),
  pharmacyWholesaleCost: z.number().positive('Pharmacy wholesale cost must be positive').optional(),
  pharmacyProductId: z.string().optional(),
  medicationSize: z.string().optional(),
  category: z.string().nullable().optional(),
  categories: z.array(z.string()).optional(),
  requiredDoctorQuestions: z.array(z.any()).optional(),
  suggestedRetailPrice: z.number().positive('Suggested retail price must be positive').optional(),
  isActive: z.boolean().optional().default(true),
});

export const productUpdateSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1, 'Product name is required').max(200).optional(),
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens').optional(),
  description: z.string().min(1, 'Product description is required').optional(),
  price: z.number().positive('Price must be positive').optional(),
  activeIngredients: z.array(z.string()).min(1, 'At least one active ingredient is required').optional(),
  placeholderSig: z.string().min(1, 'Placeholder Sig is required').optional(),
  imageUrl: z.string().url('Invalid image URL').optional(),
  pharmacyProvider: z.string().optional(),
  pharmacyWholesaleCost: z.number().positive('Pharmacy wholesale cost must be positive').optional(),
  pharmacyProductId: z.string().optional(),
  medicationSize: z.string().optional(),
  category: z.string().optional(),
  categories: z.array(z.string()).optional(),
  requiredDoctorQuestions: z.array(z.any()).optional(),
  suggestedRetailPrice: z.number().positive('Suggested retail price must be positive').optional(),
  isActive: z.boolean().optional(),
  // MD Integrations fields
  mdCaseId: z.string().optional().nullable(),
  mdOfferingId: z.string().optional().nullable(),
  mdOfferingName: z.string().optional().nullable(),
  // Beluga Integration field
  belugaProductId: z.string().optional().nullable(),
});

export const productGetSchema = z.object({
  id: uuidSchema
});

export const listProductsSchema = paginationSchema.extend({
  category: z.string().optional(),
  categories: z.union([z.array(z.string()), z.string()]).optional(),
  isActive: z.boolean().optional(),
  pharmacyProvider: z.string().optional(),
  isAutoImported: z.boolean().optional(),
  hasMdiOffering: z.boolean().optional(),
});
/**
 * Type exports
 */

export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
export type ProductGetInput = z.infer<typeof productGetSchema>;
export type ListProductsInput = z.infer<typeof listProductsSchema>;
