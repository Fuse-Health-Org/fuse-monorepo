import { apiCall } from './api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ContactInfo {
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
}

/**
 * Track patient contact information immediately as it's entered
 * This enables abandoned cart detection even before account creation
 */
export async function trackContactInfo(
  sessionId: string,
  contactInfo: ContactInfo,
  productId: string,
  formId: string
): Promise<boolean> {
  try {
    console.log('[Contact Tracking] Updating contact info:', {
      sessionId,
      hasFirstName: !!contactInfo.firstName,
      hasLastName: !!contactInfo.lastName,
      hasEmail: !!contactInfo.email,
      hasPhone: !!contactInfo.phoneNumber,
    });

    const response = await fetch(`${API_URL}/analytics/track-contact`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId,
        contactInfo,
        productId,
        formId,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      console.warn('[Contact Tracking] Failed to track contact info:', response.status);
      return false;
    }

    const result = await response.json();
    return result.success;
  } catch (error) {
    console.error('[Contact Tracking] Error tracking contact info:', error);
    return false;
  }
}

/**
 * Check if we have complete contact information
 */
export function hasCompleteContactInfo(contactInfo: ContactInfo): boolean {
  return !!(
    contactInfo.firstName &&
    contactInfo.lastName &&
    contactInfo.email &&
    contactInfo.email.includes('@')
  );
}

/**
 * Debounced contact info tracking to avoid too many API calls
 */
let trackingTimeout: NodeJS.Timeout | null = null;

export function trackContactInfoDebounced(
  sessionId: string,
  contactInfo: ContactInfo,
  productId: string,
  formId: string,
  delayMs: number = 1000
): void {
  // Clear any pending tracking call
  if (trackingTimeout) {
    clearTimeout(trackingTimeout);
  }

  // Only track if we have at least email or both names
  const shouldTrack =
    (contactInfo.email && contactInfo.email.includes('@')) ||
    (contactInfo.firstName && contactInfo.lastName);

  if (!shouldTrack) {
    return;
  }

  // Schedule new tracking call
  trackingTimeout = setTimeout(() => {
    trackContactInfo(sessionId, contactInfo, productId, formId);
    trackingTimeout = null;
  }, delayMs);
}
