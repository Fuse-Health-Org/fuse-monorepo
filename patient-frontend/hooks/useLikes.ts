import { useState, useEffect, useCallback } from 'react';
import { toggleLike, getLikeStatus, getBatchLikes, migrateLikes } from '../lib/likes';

interface UseLikeResult {
  liked: boolean;
  likeCount: number;
  isLoading: boolean;
  error: string | null;
  toggle: () => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Hook for managing a single product's like status
 */
export function useLike(tenantProductId: string | null): UseLikeResult {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!tenantProductId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const response = await getLikeStatus(tenantProductId);
      
      if (response.success) {
        setLiked(response.userLiked);
        setLikeCount(response.likeCount);
      } else {
        setError(response.error || 'Failed to get like status');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get like status');
    } finally {
      setIsLoading(false);
    }
  }, [tenantProductId]);

  const toggle = useCallback(async () => {
    if (!tenantProductId) return;

    try {
      setError(null);
      // Optimistically update UI
      setLiked((prev) => !prev);
      setLikeCount((prev) => (liked ? prev - 1 : prev + 1));

      const response = await toggleLike(tenantProductId);
      
      if (response.success) {
        setLiked(response.liked);
        setLikeCount(response.likeCount);
      } else {
        // Revert on error
        setLiked((prev) => !prev);
        setLikeCount((prev) => (liked ? prev + 1 : prev - 1));
        setError(response.error || 'Failed to toggle like');
      }
    } catch (err) {
      // Revert on error
      setLiked((prev) => !prev);
      setLikeCount((prev) => (liked ? prev + 1 : prev - 1));
      setError(err instanceof Error ? err.message : 'Failed to toggle like');
    }
  }, [tenantProductId, liked]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    liked,
    likeCount,
    isLoading,
    error,
    toggle,
    refresh,
  };
}

interface UseBatchLikesResult {
  likeCounts: Record<string, number>;
  userLikes: Record<string, boolean>;
  isLoading: boolean;
  error: string | null;
  toggle: (tenantProductId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Hook for managing likes for multiple products at once
 * Useful for product listing pages
 */
export function useBatchLikes(tenantProductIds: string[]): UseBatchLikesResult {
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [userLikes, setUserLikes] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (tenantProductIds.length === 0) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const response = await getBatchLikes(tenantProductIds);
      
      if (response.success) {
        // Ensure we always set valid objects, even if API returns undefined
        setLikeCounts(response.likeCounts || {});
        setUserLikes(response.userLikes || {});
      } else {
        setError(response.error || 'Failed to get likes');
        // Reset to empty objects on error
        setLikeCounts({});
        setUserLikes({});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get likes');
      // Reset to empty objects on error
      setLikeCounts({});
      setUserLikes({});
    } finally {
      setIsLoading(false);
    }
  }, [tenantProductIds.join(',')]);

  const toggle = useCallback(async (tenantProductId: string) => {
    try {
      setError(null);
      const currentlyLiked = userLikes[tenantProductId] || false;
      
      // Optimistically update UI
      setUserLikes((prev) => ({
        ...prev,
        [tenantProductId]: !currentlyLiked,
      }));
      setLikeCounts((prev) => ({
        ...prev,
        [tenantProductId]: (prev[tenantProductId] || 0) + (currentlyLiked ? -1 : 1),
      }));

      const response = await toggleLike(tenantProductId);
      
      if (response.success) {
        setUserLikes((prev) => ({
          ...prev,
          [tenantProductId]: response.liked,
        }));
        setLikeCounts((prev) => ({
          ...prev,
          [tenantProductId]: response.likeCount,
        }));
      } else {
        // Revert on error
        setUserLikes((prev) => ({
          ...prev,
          [tenantProductId]: currentlyLiked,
        }));
        setLikeCounts((prev) => ({
          ...prev,
          [tenantProductId]: (prev[tenantProductId] || 0) + (currentlyLiked ? 1 : -1),
        }));
        setError(response.error || 'Failed to toggle like');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle like');
    }
  }, [userLikes]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    likeCounts,
    userLikes,
    isLoading,
    error,
    toggle,
    refresh,
  };
}

/**
 * Hook to migrate anonymous likes after user logs in
 */
export function useMigrateLikes() {
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<{
    migratedCount: number;
    skippedCount: number;
  } | null>(null);

  const migrate = useCallback(async () => {
    try {
      setIsMigrating(true);
      const response = await migrateLikes();
      
      if (response.success) {
        setMigrationResult({
          migratedCount: response.migratedCount,
          skippedCount: response.skippedCount,
        });
      }
      
      return response;
    } finally {
      setIsMigrating(false);
    }
  }, []);

  return {
    migrate,
    isMigrating,
    migrationResult,
  };
}

