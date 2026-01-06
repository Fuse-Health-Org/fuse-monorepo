import { apiCall } from './api';

const ANONYMOUS_ID_KEY = 'fuse_anonymous_likes_id';

/**
 * Get or create an anonymous ID for users who aren't logged in.
 * This ID is stored in localStorage so users can manage their likes
 * even without an account.
 */
export function getOrCreateAnonymousId(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  let anonymousId = localStorage.getItem(ANONYMOUS_ID_KEY);
  
  if (!anonymousId) {
    // Generate a UUID v4
    anonymousId = crypto.randomUUID();
    localStorage.setItem(ANONYMOUS_ID_KEY, anonymousId);
  }
  
  return anonymousId;
}

/**
 * Get the anonymous ID if it exists (doesn't create one)
 */
export function getAnonymousId(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return localStorage.getItem(ANONYMOUS_ID_KEY);
}

/**
 * Clear the anonymous ID (useful when user logs in and likes are migrated)
 */
export function clearAnonymousId(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(ANONYMOUS_ID_KEY);
  }
}

interface LikeToggleResponse {
  success: boolean;
  liked: boolean;
  likeCount: number;
  error?: string;
}

interface LikeStatusResponse {
  success: boolean;
  likeCount: number;
  userLiked: boolean;
  error?: string;
}

interface BatchLikesResponse {
  success: boolean;
  likeCounts: Record<string, number>;
  userLikes: Record<string, boolean>;
  error?: string;
}

interface MigrateLikesResponse {
  success: boolean;
  migratedCount: number;
  skippedCount: number;
  error?: string;
}

/**
 * Get the affiliate ID from localStorage if user came from affiliate link
 */
function getAffiliateId(): string | null {
  if (typeof window === 'undefined') {
    console.log('💗 [GET AFFILIATE ID] Window is undefined (SSR)');
    return null;
  }
  
  const affiliateId = localStorage.getItem('affiliateId');
  console.log('💗 [GET AFFILIATE ID] Reading from localStorage:', {
    affiliateId: affiliateId || 'null',
    localStorageKeys: Object.keys(localStorage),
    hasAffiliateId: !!affiliateId,
  });
  
  return affiliateId;
}

/**
 * Toggle like for a product
 */
export async function toggleLike(tenantProductId: string): Promise<LikeToggleResponse> {
  try {
    const anonymousId = getOrCreateAnonymousId();
    const affiliateId = getAffiliateId();
    const sourceType = affiliateId ? 'affiliate' : 'brand';
    
    console.log('💗 [LIKE TOGGLE] Starting like toggle:', {
      tenantProductId,
      anonymousId: anonymousId.substring(0, 8) + '...',
      affiliateId: affiliateId || 'null (direct brand)',
      sourceType,
      timestamp: new Date().toISOString(),
    });
    
    const requestBody = { 
      tenantProductId, 
      anonymousId,
      sourceType,
      affiliateId: affiliateId || null,
    };
    
    console.log('💗 [LIKE TOGGLE] Request body:', requestBody);
    
    const response = await apiCall('/likes/toggle', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
    
    console.log('💗 [LIKE TOGGLE] Response:', response);
    
    // Handle nested data structure if present
    const data = response?.data || response;
    
    const result = {
      success: data?.success || false,
      liked: data?.liked || false,
      likeCount: data?.likeCount || 0,
      error: data?.error,
    };
    
    console.log('💗 [LIKE TOGGLE] Final result:', result);
    
    return result;
  } catch (error) {
    console.error('❌ [LIKE TOGGLE] Error toggling like:', error);
    return {
      success: false,
      liked: false,
      likeCount: 0,
      error: error instanceof Error ? error.message : 'Failed to toggle like',
    };
  }
}

/**
 * Get like status for a product
 */
export async function getLikeStatus(tenantProductId: string): Promise<LikeStatusResponse> {
  try {
    const anonymousId = getAnonymousId();
    const affiliateId = getAffiliateId();
    const sourceType = affiliateId ? 'affiliate' : 'brand';
    
    const params = new URLSearchParams();
    if (anonymousId) params.append('anonymousId', anonymousId);
    params.append('sourceType', sourceType);
    params.append('affiliateId', affiliateId || 'null');
    const queryString = params.toString();
    
    const response = await apiCall(`/likes/${tenantProductId}?${queryString}`);
    
    // Handle nested data structure if present
    const data = response?.data || response;
    
    return {
      success: data?.success || false,
      likeCount: data?.likeCount || 0,
      userLiked: data?.userLiked || false,
      error: data?.error,
    };
  } catch (error) {
    console.error('Error getting like status:', error);
    return {
      success: false,
      likeCount: 0,
      userLiked: false,
      error: error instanceof Error ? error.message : 'Failed to get like status',
    };
  }
}

/**
 * Get likes for multiple products at once
 */
export async function getBatchLikes(tenantProductIds: string[]): Promise<BatchLikesResponse> {
  try {
    const anonymousId = getAnonymousId();
    const affiliateId = getAffiliateId();
    const sourceType = affiliateId ? 'affiliate' : 'brand';
    
    const response = await apiCall('/likes/batch', {
      method: 'POST',
      body: JSON.stringify({ 
        tenantProductIds, 
        anonymousId,
        sourceType,
        affiliateId: affiliateId || null,
      }),
    });
    
    // Handle nested data structure if present
    const data = response?.data || response;
    
    return {
      success: data?.success || false,
      likeCounts: data?.likeCounts || {},
      userLikes: data?.userLikes || {},
      error: data?.error,
    };
  } catch (error) {
    console.error('Error getting batch likes:', error);
    return {
      success: false,
      likeCounts: {},
      userLikes: {},
      error: error instanceof Error ? error.message : 'Failed to get batch likes',
    };
  }
}

/**
 * Migrate anonymous likes to user account after login
 * Should be called after user logs in
 */
export async function migrateLikes(): Promise<MigrateLikesResponse> {
  try {
    const anonymousId = getAnonymousId();
    
    if (!anonymousId) {
      return {
        success: true,
        migratedCount: 0,
        skippedCount: 0,
      };
    }
    
    const response = await apiCall('/likes/migrate', {
      method: 'POST',
      body: JSON.stringify({ anonymousId }),
    });
    
    // Handle nested data structure if present
    const data = response?.data || response;
    
    if (data?.success) {
      // Clear the anonymous ID after successful migration
      clearAnonymousId();
    }
    
    return {
      success: data?.success || false,
      migratedCount: data?.migratedCount || 0,
      skippedCount: data?.skippedCount || 0,
      error: data?.error,
    };
  } catch (error) {
    console.error('Error migrating likes:', error);
    return {
      success: false,
      migratedCount: 0,
      skippedCount: 0,
      error: error instanceof Error ? error.message : 'Failed to migrate likes',
    };
  }
}

