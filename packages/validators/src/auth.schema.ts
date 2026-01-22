import { z } from 'zod';
import { emailSchema, passwordSchema } from './common.schema';

/**
 * Authentication validation schemas
 */

export const RoleEnum = z.enum(['patient', 'provider', 'doctor', 'brand', 'admin', 'affiliate']);

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const signUpSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  email: emailSchema,
  password: passwordSchema,
  role: RoleEnum.optional(),
  dateOfBirth: z.string().optional(),
  dob: z.string().optional(), // Alias for dateOfBirth
  gender: z.string().optional(),
  phoneNumber: z.string().optional(),
  clinicName: z.string().optional(),
  clinicId: z.string().optional(),
  website: z.string().optional(),
  businessType: z.string().optional(),
  npiNumber: z.string().optional(),
  patientPortalDashboardFormat: z.enum(['fuse', 'md-integrations']).optional(),
  invitationSlug: z.string().optional(),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const updateProfileSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phoneNumber: z.string().optional(),
  dob: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  selectedPlanCategory: z.string().optional(),
  selectedPlanType: z.string().optional(),
  selectedPlanName: z.string().optional(),
  selectedPlanPrice: z.number().optional(),
  selectedDownpaymentType: z.string().optional(),
  selectedDownpaymentName: z.string().optional(),
  selectedDownpaymentPrice: z.number().optional(),
  planSelectionTimestamp: z.string().optional(),
});

/**
 * Type exports
 */

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
