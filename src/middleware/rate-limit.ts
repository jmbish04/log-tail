/**
 * Rate limiting middleware
 * Uses a simple in-memory sliding window approach
 * For production, consider using Cloudflare Rate Limiting or Durable Objects
 */

import { Context, Next } from 'hono';
import { Env } from '../types';

interface RateLimitEntry {
    count: number;
    resetTime: number;
}

// In-memory rate limit store (simple implementation)
// Note: This is per-instance. For distributed rate limiting, use Durable Objects
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Rate limit configuration
 */
interface RateLimitConfig {
    windowMs: number;  // Time window in milliseconds
    maxRequests: number;  // Maximum requests per window
    keyGenerator?: (c: Context) => string;  // Function to generate rate limit key
}

const defaultConfig: RateLimitConfig = {
    windowMs: 60 * 1000,  // 1 minute
    maxRequests: 100,  // 100 requests per minute
};

/**
 * Create rate limiting middleware
 */
export function rateLimit(config: Partial<RateLimitConfig> = {}) {
    const finalConfig = { ...defaultConfig, ...config };

    return async (c: Context<{ Bindings: Env }>, next: Next) => {
        // Generate key for this request (by default, use IP address)
        const key = finalConfig.keyGenerator
            ? finalConfig.keyGenerator(c)
            : getClientIP(c);

        const now = Date.now();
        let entry = rateLimitStore.get(key);

        // Clean up expired entries periodically
        if (Math.random() < 0.01) {  // 1% chance
            cleanupExpiredEntries(now);
        }

        if (!entry || now > entry.resetTime) {
            // Create new entry
            entry = {
                count: 1,
                resetTime: now + finalConfig.windowMs,
            };
            rateLimitStore.set(key, entry);
        } else {
            // Increment existing entry
            entry.count++;

            if (entry.count > finalConfig.maxRequests) {
                const retryAfter = Math.ceil((entry.resetTime - now) / 1000);

                return c.json(
                    {
                        error: 'Rate limit exceeded',
                        retry_after: retryAfter,
                    },
                    429,
                    {
                        'Retry-After': retryAfter.toString(),
                        'X-RateLimit-Limit': finalConfig.maxRequests.toString(),
                        'X-RateLimit-Remaining': '0',
                        'X-RateLimit-Reset': entry.resetTime.toString(),
                    }
                );
            }
        }

        // Add rate limit headers
        const remaining = Math.max(0, finalConfig.maxRequests - entry.count);
        c.header('X-RateLimit-Limit', finalConfig.maxRequests.toString());
        c.header('X-RateLimit-Remaining', remaining.toString());
        c.header('X-RateLimit-Reset', entry.resetTime.toString());

        await next();
    };
}

/**
 * Get client IP address from request
 */
function getClientIP(c: Context): string {
    // Try CF-Connecting-IP header (Cloudflare)
    const cfIP = c.req.header('CF-Connecting-IP');
    if (cfIP) return cfIP;

    // Try X-Forwarded-For
    const forwardedFor = c.req.header('X-Forwarded-For');
    if (forwardedFor) {
        return forwardedFor.split(',')[0].trim();
    }

    // Try X-Real-IP
    const realIP = c.req.header('X-Real-IP');
    if (realIP) return realIP;

    // Fallback
    return 'unknown';
}

/**
 * Clean up expired rate limit entries
 */
function cleanupExpiredEntries(now: number) {
    for (const [key, entry] of rateLimitStore.entries()) {
        if (now > entry.resetTime) {
            rateLimitStore.delete(key);
        }
    }
}

/**
 * Service-specific rate limiter
 * Limits requests per service
 */
export function serviceRateLimit(config: Partial<RateLimitConfig> = {}) {
    return rateLimit({
        ...config,
        keyGenerator: (c: Context) => {
            const serviceName = c.req.query('service') || c.req.param('service') || 'default';
            return `service:${serviceName}`;
        },
    });
}

/**
 * Batch ingest rate limiter
 * More lenient for batch operations
 */
export const batchIngestRateLimit = rateLimit({
    windowMs: 60 * 1000,  // 1 minute
    maxRequests: 20,  // 20 batch requests per minute
});

/**
 * Standard API rate limiter
 */
export const apiRateLimit = rateLimit({
    windowMs: 60 * 1000,  // 1 minute
    maxRequests: 100,  // 100 requests per minute
});
