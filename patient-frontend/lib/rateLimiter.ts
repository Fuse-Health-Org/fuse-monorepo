import { LRUCache } from 'lru-cache';
import { NextApiRequest, NextApiResponse } from 'next';

/**
 * Rate Limiter for Next.js API Routes using LRU Cache
 * Based on Vercel's official example
 * 
 * Uses in-memory LRU cache to track request counts per IP address.
 * Works in both traditional Node.js deployments and serverless/edge environments.
 */

interface RateLimitOptions {
  uniqueTokenPerInterval?: number;
  interval?: number;
  limit?: number;
}

export function rateLimit(options?: RateLimitOptions) {
  const tokenCache = new LRUCache({
    max: options?.uniqueTokenPerInterval || 500,
    ttl: options?.interval || 60000, // 60 seconds
  });

  return {
    check: (limit: number, token: string) =>
      new Promise<void>((resolve, reject) => {
        const tokenCount = (tokenCache.get(token) as number[]) || [0];
        if (tokenCount[0] === 0) {
          tokenCache.set(token, tokenCount);
        }
        tokenCount[0] += 1;

        const currentUsage = tokenCount[0];
        const isRateLimited = currentUsage >= limit;

        return isRateLimited ? reject() : resolve();
      }),
  };
}

/**
 * Get client IP address from request
 */
export function getIP(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded
    ? (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',')[0]
    : req.socket.remoteAddress || 'unknown';
  return ip;
}

/**
 * Apply rate limiting middleware to Next.js API route
 * 
 * @example
 * export default async function handler(req: NextApiRequest, res: NextApiResponse) {
 *   try {
 *     await applyRateLimit(req, res);
 *     // Your API logic here
 *   } catch {
 *     return res.status(429).json({ success: false, message: 'Rate limit exceeded' });
 *   }
 * }
 */
export async function applyRateLimit(
  req: NextApiRequest,
  res: NextApiResponse,
  options?: { limit?: number; interval?: number }
) {
  const limiter = rateLimit({
    interval: options?.interval || 60 * 1000, // 60 seconds
    uniqueTokenPerInterval: 500,
  });

  const ip = getIP(req);
  const limit = options?.limit || 10;

  try {
    await limiter.check(limit, ip);
  } catch {
    res.status(429).json({
      success: false,
      message: 'Rate limit exceeded. Please try again later.',
    });
    throw new Error('Rate limit exceeded');
  }
}

/**
 * Preset rate limiters for different endpoint types
 */
export const rateLimitPresets = {
  // For authentication endpoints (login, signup, etc.)
  auth: { limit: 5, interval: 15 * 60 * 1000 }, // 5 requests per 15 minutes
  
  // For public endpoints
  public: { limit: 100, interval: 15 * 60 * 1000 }, // 100 requests per 15 minutes
  
  // For general API endpoints
  api: { limit: 30, interval: 60 * 1000 }, // 30 requests per minute
  
  // For write operations
  write: { limit: 10, interval: 60 * 1000 }, // 10 requests per minute
};
