/**
 * Authentication middleware for HTTP API
 */

import { Context, Next } from 'hono';
import { AppBindings } from '../types';

/**
 * Middleware to authenticate API requests using Bearer token
 */
export async function authenticateRequest(c: Context<AppBindings>, next: Next) {
    const authHeader = c.req.header('Authorization');

    if (!authHeader) {
        return c.json({ error: 'Missing Authorization header' }, 401);
    }

    // Check for Bearer token
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return c.json({ error: 'Invalid Authorization header format. Use: Bearer <token>' }, 401);
    }

    const token = parts[1];
    const expectedToken = c.env.LOG_SERVICE_API_KEY;

    if (!expectedToken) {
        console.error('LOG_SERVICE_API_KEY not configured');
        return c.json({ error: 'Server configuration error' }, 500);
    }

    // Constant-time comparison to prevent timing attacks
    if (!constantTimeCompare(token, expectedToken)) {
        return c.json({ error: 'Invalid API key' }, 403);
    }

    // Authentication successful, continue to next handler
    await next();
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
        return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
}

/**
 * Optional authentication - validates token if present but doesn't require it
 */
export async function optionalAuthentication(c: Context<AppBindings>, next: Next) {
    const authHeader = c.req.header('Authorization');

    if (authHeader) {
        const parts = authHeader.split(' ');
        if (parts.length === 2 && parts[0] === 'Bearer') {
            const token = parts[1];
            const expectedToken = c.env.LOG_SERVICE_API_KEY;

            if (expectedToken && constantTimeCompare(token, expectedToken)) {
                // Set a flag to indicate authenticated request
                c.set('authenticated', true);
            }
        }
    }

    await next();
}
