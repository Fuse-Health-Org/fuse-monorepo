import { rateLimit } from 'express-rate-limit';

/**
 * Rate Limiter Configurations for FUSE Health Platform
 * 
 * Different rate limits for different endpoint types to prevent:
 * - Brute force attacks on authentication
 * - API abuse and scraping
 * - DDoS at application level
 * - Excessive resource consumption
 * 
 * In development, limits are more lenient to allow for testing and hot-reloading
 */

const isDevelopment = process.env.NODE_ENV === 'development';

// Custom key generator that handles X-Forwarded-For in development
// In production, this should be combined with proper trust proxy settings
const keyGenerator = (req: any) => {
  // In development, use IP without X-Forwarded-For validation
  if (isDevelopment) {
    return req.ip || req.connection?.remoteAddress || 'unknown';
  }
  // In production, use default behavior (requires trust proxy to be configured)
  return req.ip;
};

// CRITICAL: Authentication endpoints (login, signup, password reset, MFA)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: isDevelopment ? 50 : 5, // 50 in dev, 5 in production
  message: {
    success: false,
    message: 'Too many authentication attempts from this IP, please try again after 15 minutes.',
  },
  standardHeaders: 'draft-8', // Return rate limit info in `RateLimit` header
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  skipSuccessfulRequests: true, // Don't count successful auth attempts
  keyGenerator,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many authentication attempts from this IP, please try again after 15 minutes.',
    });
  },
});

// MODERATE: Public endpoints (products, treatments, clinics)
export const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: isDevelopment ? 10000 : 100, // 10000 in dev, 100 in production
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many requests from this IP, please try again later.',
    });
  },
});

// FLEXIBLE: Authenticated API endpoints
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 1500, // 150 requests per window
  message: {
    success: false,
    message: 'Rate limit exceeded, please slow down.',
  },
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Rate limit exceeded, please slow down.',
    });
  },
});

// RESTRICTIVE: Write operations (POST, PUT, DELETE)
export const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 30, // 30 operations per window
  message: {
    success: false,
    message: 'Too many write operations, please try again later.',
  },
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many write operations, please try again later.',
    });
  },
});

// LENIENT: Webhooks from external services (Stripe, Pharmacy, MD Integrations)
export const webhookLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 1000, // 1000 requests per window (external services may send bursts)
  message: {
    success: false,
    message: 'Webhook rate limit exceeded.',
  },
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Webhook rate limit exceeded.',
    });
  },
});
