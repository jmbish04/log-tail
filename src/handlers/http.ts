/**
 * HTTP API routes for log ingestion and querying
 */

import { Hono } from 'hono';
import { Env, IngestRequest, BatchIngestRequest, LogSearchParams } from '../types';
import { ingestLog, batchIngestLogs, normalizeLogLevel } from '../lib/ingester';
import { searchLogs, getRecentLogs, getLogStats, getServiceNames, getLogById } from '../lib/search';
import { getServiceConfig, updateServiceConfig, getAllServiceConfigs, getServiceConfigOrDefault } from '../lib/config';
import { getLogFromR2 } from '../lib/storage';
import { authenticateRequest } from '../middleware/auth';
import { apiRateLimit, batchIngestRateLimit } from '../middleware/rate-limit';

export const httpRoutes = new Hono<{ Bindings: Env }>();

/**
 * POST /ingest - Ingest a single log entry
 */
httpRoutes.post('/ingest', authenticateRequest, apiRateLimit, async (c) => {
    try {
        const body = await c.req.json<IngestRequest>();
        const { service_name, level, message, metadata, timestamp } = body;

        // Validate required fields
        if (!service_name || !level || !message) {
            return c.json(
                {
                    error: 'Missing required fields',
                    required: ['service_name', 'level', 'message'],
                },
                400
            );
        }

        const logEntry = {
            service_name,
            level: normalizeLogLevel(level),
            message,
            timestamp: timestamp || Date.now(),
            metadata: metadata || {},
            source_type: 'http' as const,
        };

        const id = await ingestLog(logEntry, c.env, c.executionCtx);

        return c.json({
            success: true,
            id,
        });
    } catch (error: any) {
        console.error('Ingestion error:', error);
        return c.json(
            {
                error: error.message || 'Internal server error',
            },
            500
        );
    }
});

/**
 * POST /ingest/batch - Ingest multiple log entries
 */
httpRoutes.post('/ingest/batch', authenticateRequest, batchIngestRateLimit, async (c) => {
    try {
        const body = await c.req.json<BatchIngestRequest>();
        const { logs } = body;

        if (!Array.isArray(logs)) {
            return c.json({ error: 'logs must be an array' }, 400);
        }

        if (logs.length === 0) {
            return c.json({ error: 'logs array cannot be empty' }, 400);
        }

        if (logs.length > 1000) {
            return c.json({ error: 'Maximum 1000 logs per batch' }, 400);
        }

        // Transform and validate logs
        const logEntries = logs.map((log) => ({
            service_name: log.service_name,
            level: normalizeLogLevel(log.level),
            message: log.message,
            timestamp: log.timestamp || Date.now(),
            metadata: log.metadata || {},
            source_type: 'http' as const,
        }));

        const result = await batchIngestLogs(logEntries, c.env, c.executionCtx);

        return c.json({
            success: true,
            ingested: result.successful,
            failed: result.failed,
            errors: result.errors.length > 0 ? result.errors : undefined,
        });
    } catch (error: any) {
        console.error('Batch ingestion error:', error);
        return c.json(
            {
                error: error.message || 'Internal server error',
            },
            500
        );
    }
});

/**
 * GET /search - Search logs
 */
httpRoutes.get('/search', authenticateRequest, async (c) => {
    try {
        const service = c.req.query('service');
        const level = c.req.query('level');
        const startTime = c.req.query('start_time');
        const endTime = c.req.query('end_time');
        const limit = parseInt(c.req.query('limit') || '100');
        const offset = parseInt(c.req.query('offset') || '0');

        const params: LogSearchParams = {
            service_name: service,
            level: level as any,
            start_time: startTime ? parseInt(startTime) : undefined,
            end_time: endTime ? parseInt(endTime) : undefined,
            limit: Math.min(limit, 1000), // Cap at 1000
            offset,
        };

        const logs = await searchLogs(c.env.DB, params);

        return c.json({
            logs,
            count: logs.length,
            has_more: logs.length === params.limit,
        });
    } catch (error: any) {
        console.error('Search error:', error);
        return c.json(
            {
                error: error.message || 'Internal server error',
            },
            500
        );
    }
});

/**
 * GET /logs/:id - Get a specific log by ID
 */
httpRoutes.get('/logs/:id', authenticateRequest, async (c) => {
    try {
        const id = c.req.param('id');
        const log = await getLogById(c.env.DB, id);

        if (!log) {
            return c.json({ error: 'Log not found' }, 404);
        }

        return c.json({ log });
    } catch (error: any) {
        console.error('Get log error:', error);
        return c.json(
            {
                error: error.message || 'Internal server error',
            },
            500
        );
    }
});

/**
 * GET /logs/:id/full - Get full log from R2
 */
httpRoutes.get('/logs/:id/full', authenticateRequest, async (c) => {
    try {
        const id = c.req.param('id');
        const logMetadata = await getLogById(c.env.DB, id);

        if (!logMetadata) {
            return c.json({ error: 'Log not found' }, 404);
        }

        if (!logMetadata.r2_key) {
            // Return metadata if R2 key not available
            return c.json({ log: logMetadata });
        }

        const fullLog = await getLogFromR2(c.env.LOGS_ARCHIVE, logMetadata.r2_key);

        if (!fullLog) {
            // Fallback to metadata if R2 retrieval fails
            return c.json({ log: logMetadata });
        }

        return c.json({ log: fullLog });
    } catch (error: any) {
        console.error('Get full log error:', error);
        return c.json(
            {
                error: error.message || 'Internal server error',
            },
            500
        );
    }
});

/**
 * GET /services - Get list of all services
 */
httpRoutes.get('/services', authenticateRequest, async (c) => {
    try {
        const services = await getServiceNames(c.env.DB);
        return c.json({ services });
    } catch (error: any) {
        console.error('Get services error:', error);
        return c.json(
            {
                error: error.message || 'Internal server error',
            },
            500
        );
    }
});

/**
 * GET /stats/:service - Get statistics for a service
 */
httpRoutes.get('/stats/:service', authenticateRequest, async (c) => {
    try {
        const service = c.req.param('service');
        const startTime = c.req.query('start_time');
        const endTime = c.req.query('end_time');

        const stats = await getLogStats(
            c.env.DB,
            service,
            startTime ? parseInt(startTime) : undefined,
            endTime ? parseInt(endTime) : undefined
        );

        return c.json({ service, stats });
    } catch (error: any) {
        console.error('Get stats error:', error);
        return c.json(
            {
                error: error.message || 'Internal server error',
            },
            500
        );
    }
});

/**
 * GET /config/:service - Get service configuration
 */
httpRoutes.get('/config/:service', authenticateRequest, async (c) => {
    try {
        const service = c.req.param('service');
        const config = await getServiceConfigOrDefault(c.env.DB, service);

        return c.json({ config });
    } catch (error: any) {
        console.error('Get config error:', error);
        return c.json(
            {
                error: error.message || 'Internal server error',
            },
            500
        );
    }
});

/**
 * PUT /config/:service - Update service configuration
 */
httpRoutes.put('/config/:service', authenticateRequest, async (c) => {
    try {
        const service = c.req.param('service');
        const body = await c.req.json();

        await updateServiceConfig(c.env.DB, service, body);

        return c.json({ success: true });
    } catch (error: any) {
        console.error('Update config error:', error);
        return c.json(
            {
                error: error.message || 'Internal server error',
            },
            500
        );
    }
});

/**
 * GET /configs - Get all service configurations
 */
httpRoutes.get('/configs', authenticateRequest, async (c) => {
    try {
        const configs = await getAllServiceConfigs(c.env.DB);
        return c.json({ configs });
    } catch (error: any) {
        console.error('Get configs error:', error);
        return c.json(
            {
                error: error.message || 'Internal server error',
            },
            500
        );
    }
});

/**
 * GET /recent/:service - Get recent logs for a service
 */
httpRoutes.get('/recent/:service', authenticateRequest, async (c) => {
    try {
        const service = c.req.param('service');
        const limit = parseInt(c.req.query('limit') || '100');

        const logs = await getRecentLogs(c.env.DB, service, Math.min(limit, 1000));

        return c.json({ logs, count: logs.length });
    } catch (error: any) {
        console.error('Get recent logs error:', error);
        return c.json(
            {
                error: error.message || 'Internal server error',
            },
            500
        );
    }
});
