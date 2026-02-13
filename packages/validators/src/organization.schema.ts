import { z } from 'zod';

export const organizationUpdateSchema = z.object({
  businessName: z.string().min(1).max(200).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid zip code format').optional().or(z.literal('')),
  website: z.string().optional(),
  isCustomDomain: z.boolean().optional(),
  customDomain: z.string().optional(),
  defaultFormColor: z.string()
    .refine((val) => {
      if (!val) return true; // Allow empty string
      // Allow hex codes (e.g., #FF751F)
      const isHexColor = /^#[0-9a-fA-F]{6}$/.test(val);
      // Allow linear gradients (e.g., linear-gradient(90deg, #FF751F 0%, #B11FFF 100%))
      const isGradient = /^linear-gradient\(/.test(val);
      return isHexColor || isGradient;
    }, {
      message: 'Color must be a valid hex code (e.g., #1A2B3C) or linear gradient (e.g., linear-gradient(90deg, #FF751F 0%, #B11FFF 100%))'
    })
    .optional()
    .or(z.literal('')),
  patientPortalDashboardFormat: z.enum(['fuse', 'md-integrations', 'beluga']).optional(),
});
