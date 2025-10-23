/**
 * Main entry point for the Logging Service Worker
 * Combines Tail Worker capabilities with a full-featured logging service
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env, TraceItem } from './types';
import { tailHandler } from './handlers/tail';
import { httpRoutes } from './handlers/http';
import { analysisRoutes } from './handlers/analysis';
import { chatRoutes } from './handlers/chat';
import { websocketHandler } from './handlers/websocket';
import { cleanupCron, globalAnalysisCron } from './cron';
import { handleAnalysisQueue } from './queues/analysis-queue';
import { AnalysisQueueMessage } from './types-extended';

// Export Durable Object
export { AnalysisAgent } from './durable-objects/AnalysisAgent';

// Initialize Hono app
const app = new Hono<{ Bindings: Env }>();

// CORS middleware for external services
app.use(
    '*',
    cors({
        origin: '*', // Configure appropriately for production
        allowMethods: ['GET', 'POST', 'PUT', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
    })
);

// Health check endpoint
app.get('/health', async (c) => {
    try {
        // Check D1 connection
        const dbCheck = await c.env.DB.prepare('SELECT 1 as status').first();

        return c.json({
            status: 'healthy',
            service: 'logsService',
            db: dbCheck ? 'connected' : 'disconnected',
            timestamp: Date.now(),
            version: '1.0.0',
        });
    } catch (error: any) {
        return c.json(
            {
                status: 'unhealthy',
                error: error.message,
                timestamp: Date.now(),
            },
            500
        );
    }
});

// API routes
app.route('/api/v1/logs', httpRoutes);
app.route('/api/v1/analysis', analysisRoutes);
app.route('/api/v1/chat', chatRoutes);

// Root endpoint
app.get('/', (c) => {
    return c.json({
        service: 'Cloudflare Logging Service',
        version: '2.0.0',
        endpoints: {
            health: '/health',
            dashboard: '/',
            ingest: '/api/v1/logs/ingest',
            batch_ingest: '/api/v1/logs/ingest/batch',
            search: '/api/v1/logs/search',
            services: '/api/v1/logs/services',
            analyze: '/api/v1/analysis/analyze',
            analysis_status: '/api/v1/analysis/status/:session_id',
            websocket: 'ws://<host>/?token=<api_key>',
        },
        documentation: 'See README.md, AGENTS.md, and OpenAPI spec',
    });
});

// 404 handler
app.notFound((c) => {
    return c.json(
        {
            error: 'Not found',
            path: c.req.path,
        },
        404
    );
});

// Error handler
app.onError((err, c) => {
    console.error('Application error:', err);
    return c.json(
        {
            error: 'Internal server error',
            message: err.message,
        },
        500
    );
});

// Export Worker handlers
export default {
    /**
     * HTTP/WebSocket handler
     */
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        // Check for WebSocket upgrade
        const upgradeHeader = request.headers.get('Upgrade');
        if (upgradeHeader === 'websocket') {
            return websocketHandler(request, env, ctx);
        }

        // Handle HTTP requests
        return app.fetch(request, env, ctx);
    },

    /**
     * Tail handler for consuming logs from other Workers
     */
    async tail(events: TraceItem[], env: Env, ctx: ExecutionContext): Promise<void> {
        return tailHandler(events, env, ctx);
    },

    /**
     * Scheduled handler for cron jobs
     */
    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
        console.log('Cron triggered:', event.cron);

        try {
            switch (event.cron) {
                case '0 2 * * *': // Daily cleanup at 2 AM
                    console.log('Running cleanup cron...');
                    ctx.waitUntil(cleanupCron(env));
                    break;

                case '0 3 * * *': // Daily global analysis at 3 AM
                    console.log('Running global analysis cron...');
                    ctx.waitUntil(globalAnalysisCron(env));
                    break;

                default:
                    console.warn('Unknown cron schedule:', event.cron);
            }
        } catch (error) {
            console.error('Cron job error:', error);
            // Don't throw - let the cron job complete even if it fails
        }
    },

    /**
     * Queue handler for background analysis jobs
     */
    async queue(batch: MessageBatch<AnalysisQueueMessage>, env: Env, ctx: ExecutionContext): Promise<void> {
        return handleAnalysisQueue(batch, env, ctx);
    },
};
