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
  defaultFormColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a valid hex code (e.g. #1A2B3C)').optional().or(z.literal('')),
  patientPortalDashboardFormat: z.enum(['fuse', 'md-integrations']).optional(),
  visitTypeFees: z.object({
    synchronous: z.number().min(0, 'Synchronous fee must be non-negative'),
    asynchronous: z.number().min(0, 'Asynchronous fee must be non-negative'),
  }).optional(),
});
