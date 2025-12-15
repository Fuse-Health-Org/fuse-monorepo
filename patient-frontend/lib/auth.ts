// HIPAA-compliant authentication utilities using JWT tokens
// No PHI should be stored in localStorage or exposed in logs

import { authApi } from "./api";

export interface User {
  id: string;
  email: string;
  role: "patient" | "doctor" | "admin" | "brand" | "affiliate" | "brand"; // @deprecated - use roles array instead
  roles?: Array<"patient" | "doctor" | "admin" | "brand" | "superAdmin">; // New role system
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  dob?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  clinicId?: string;
  affiliateOwnerId?: string;
  createdAt?: string;
  lastLoginAt?: string;
  gender?: string;
  // Impersonation fields (set when superAdmin is viewing as another user)
  impersonating?: boolean;
  impersonatedBy?: string;
}

/**
 * Get the primary role to display from a user's roles array
 * For patient-frontend, only PATIENT or BRAND roles are valid
 * Priority: patient (default) > brand
 */
export function getPrimaryRole(user: User | null): "patient" | "brand" | null {
  if (!user) return null;
  
  // Use new roles array if available
  if (user.roles && user.roles.length > 0) {
    // Priority order: patient first (default), then brand
    if (user.roles.includes("patient")) return "patient";
    if (user.roles.includes("brand")) return "brand";
    // User has roles but neither patient nor brand - not allowed in patient-frontend
    return null;
  }
  
  // Fallback to deprecated role field
  if (user.role === "patient" || user.role === "brand") {
    return user.role;
  }
  
  return null;
}

/**
 * Check if user has valid access to patient-frontend
 * Only patient or brand roles are allowed
 */
export function hasPatientFrontendAccess(user: User | null): boolean {
  if (!user) return false;
  return hasAnyRole(user, ["patient", "brand"]);
}

/**
 * Check if user has a specific role
 */
export function hasRole(user: User | null, role: "patient" | "doctor" | "admin" | "brand" | "superAdmin"): boolean {
  if (!user) return false;
  
  // Use new roles array if available
  if (user.roles && user.roles.length > 0) {
    return user.roles.includes(role);
  }
  
  // Fallback to deprecated role field
  return user.role === role;
}

/**
 * Check if user has any of the specified roles
 */
export function hasAnyRole(user: User | null, roles: Array<"patient" | "doctor" | "admin" | "brand" | "superAdmin">): boolean {
  if (!user) return false;
  
  // Use new roles array if available
  if (user.roles && user.roles.length > 0) {
    return roles.some(role => user.roles!.includes(role));
  }
  
  // Fallback to deprecated role field
  return roles.includes(user.role as any);
  userRoles?: {
    patient?: boolean;
    doctor?: boolean;
    admin?: boolean;
    brand?: boolean;
    affiliate?: boolean;
    superAdmin?: boolean;
  };
}

// Check if user is authenticated by calling the backend
export async function checkAuth(): Promise<User | null> {
  try {
    const result = await authApi.getUser();

    if (!result.success) {
      return null;
    }

    // Handle potential double nesting from apiCall wrapper
    const userData = (result.data as any)?.user || result.data;

    return userData as User;
  } catch {
    // Do not log details to avoid PHI exposure
    return null;
  }
}

// Sign out user
export async function signOut(): Promise<boolean> {
  try {
    const result = await authApi.signOut();
    return result.success;
  } catch {
    return false;
  }
}

// Role-based access control helper
export function hasPermission(
  user: User | null,
  requiredRole: Array<"patient" | "doctor" | "admin" | "brand" | "superAdmin">
): boolean {
  if (!user) return false;
  return hasAnyRole(user, requiredRole);
}

// Check if user can access another user's data (RBAC)
export function canAccessUserData(
  currentUser: User | null,
  targetUserId: string
): boolean {
  if (!currentUser) return false;

  // Admins and doctors can access any patient data
  if (hasAnyRole(currentUser, ["admin", "doctor", "superAdmin"])) {
    return true;
  }

  // Patients can only access their own data
  if (hasRole(currentUser, "patient")) {
    return currentUser.id === targetUserId;
  }

  return false;
}
