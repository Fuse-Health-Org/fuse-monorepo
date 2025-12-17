// HIPAA-compliant authentication utilities using JWT tokens
// No PHI should be stored in localStorage or exposed in logs

import { authApi } from "./api";

export interface User {
  id: string;
  email: string;
  role: "patient" | "doctor" | "admin" | "brand" | "affiliate";
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  dob?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  clinicId?: string;
  website?: string;
  createdAt?: string;
  lastLoginAt?: string;
  gender?: string;
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

    if (process.env.NODE_ENV === "development") {
      console.log('🔍 checkAuth result:', result);
    }

    if (!result.success) {
      if (process.env.NODE_ENV === "development") {
        console.log('❌ checkAuth failed:', result.error);
      }
      return null;
    }

    // Handle potential double nesting from apiCall wrapper
    const userData = (result.data as any)?.user || result.data;

    if (process.env.NODE_ENV === "development") {
      console.log('✅ User data retrieved:', { 
        id: userData?.id, 
        email: userData?.email, 
        role: userData?.role,
        affiliate: userData?.userRoles?.affiliate 
      });
    }

    return userData as User;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error('❌ checkAuth error:', error);
    }
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

