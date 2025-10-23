/**
 * On-demand analysis API endpoints
 * Handles requests for AI-powered log analysis
 */

import { Hono } from 'hono';
import { AppBindings } from '../types';
import { AnalysisRequest, AnalysisQueueMessage } from '../types-extended';
import { authenticateRequest } from '../middleware/auth';
import { parseISO, isValid, getTime } from 'date-fns';

export const analysisRoutes = new Hono<AppBindings>();

/**
 * POST /analyze - Trigger on-demand log analysis
 *
 * Request body must include:
 * - service_name: string
 * - start_time: ISO 8601 datetime string in UTC (e.g., "2024-01-15T00:00:00.000Z")
 * - end_time: ISO 8601 datetime string in UTC (e.g., "2024-01-15T23:59:59.999Z")
 * - search_term: string (optional)
 *
 * IMPORTANT: All timestamps MUST be in UTC timezone (ending with 'Z').
 * The 'Z' suffix explicitly indicates UTC timezone and prevents ambiguity.
 */
analysisRoutes.post('/analyze', authenticateRequest, async (c) => {
    try {
        const body = await c.req.json<AnalysisRequest>();

        // Validate required fields
        if (!body.service_name || !body.start_time || !body.end_time) {
            return c.json(
                {
                    error: 'Missing required fields',
                    required: ['service_name', 'start_time', 'end_time'],
                    example: {
                        service_name: 'my-service',
                        start_time: '2024-01-15T00:00:00.000Z',
                        end_time: '2024-01-15T23:59:59.999Z',
                        search_term: 'optional search term',
                    },
                },
                400
            );
        }

        // Parse and validate timestamps
        const timestampValidation = validateUTCTimestamps(
            body.start_time,
            body.end_time
        );

        if (!timestampValidation.valid) {
            return c.json(
                {
                    error: timestampValidation.error,
                    provided: {
                        start_time: body.start_time,
                        end_time: body.end_time,
                    },
                    requirements: {
                        format: 'ISO 8601',
                        timezone: 'UTC (must end with Z)',
                        example: '2024-01-15T00:00:00.000Z',
                    },
                },
                400
            );
        }

        const start_time = timestampValidation.start_time!;
        const end_time = timestampValidation.end_time!;

        // Validate time range
        if (end_time <= start_time) {
            return c.json(
                {
                    error: 'end_time must be after start_time',
                    start_time: new Date(start_time).toISOString(),
                    end_time: new Date(end_time).toISOString(),
                },
                400
            );
        }

        // Check if time range is reasonable (not more than 7 days)
        const maxRange = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
        if (end_time - start_time > maxRange) {
            return c.json(
                {
                    error: 'Time range too large. Maximum allowed is 7 days.',
                    requested_range_days: (end_time - start_time) / (24 * 60 * 60 * 1000),
                    max_allowed_days: 7,
                },
                400
            );
        }

        // Generate session ID
        const session_id = crypto.randomUUID();

        // Create queue message
        const queueMessage: AnalysisQueueMessage = {
            id: session_id,
            queue_type: 'on_demand',
            service_name: body.service_name,
            start_time,
            end_time,
            search_term: body.search_term,
            created_at: Date.now(),
        };

        // Add to queue
        await c.env.ANALYSIS_QUEUE.send(queueMessage);

        // Track in database
        await c.env.DB.prepare(`
            INSERT INTO analysis_queue (
                id, queue_type, service_name, start_time, end_time,
                search_term, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
            .bind(
                session_id,
                'on_demand',
                body.service_name,
                start_time,
                end_time,
                body.search_term || null,
                'queued',
                Date.now()
            )
            .run();

        return c.json({
            success: true,
            session_id,
            message: 'Analysis queued successfully',
            status_url: `/api/v1/analysis/status/${session_id}`,
            estimated_completion: 'Within 2-5 minutes',
        });
    } catch (error: any) {
        console.error('Analysis request error:', error);
        return c.json(
            {
                error: error.message || 'Internal server error',
            },
            500
        );
    }
});

/**
 * GET /status/:session_id - Get analysis status
 */
analysisRoutes.get('/status/:session_id', authenticateRequest, async (c) => {
    try {
        const session_id = c.req.param('session_id');

        // Get session from database
        const session = await c.env.DB.prepare(
            'SELECT * FROM analysis_sessions WHERE id = ?'
        )
            .bind(session_id)
            .first<any>();

        if (!session) {
            return c.json({ error: 'Analysis session not found' }, 404);
        }

        // Parse JSON fields
        const response = {
            id: session.id,
            service_name: session.service_name,
            start_time: new Date(session.start_time).toISOString(),
            end_time: new Date(session.end_time).toISOString(),
            search_term: session.search_term,
            status: session.status,
            error_count: session.error_count,
            warning_count: session.warning_count,
            info_count: session.info_count,
            summary: session.summary,
            patterns: session.patterns_json ? JSON.parse(session.patterns_json) : null,
            recommendations: session.recommendations_json
                ? JSON.parse(session.recommendations_json)
                : null,
            created_at: new Date(session.created_at).toISOString(),
            completed_at: session.completed_at
                ? new Date(session.completed_at).toISOString()
                : null,
        };

        return c.json(response);
    } catch (error: any) {
        console.error('Status retrieval error:', error);
        return c.json(
            {
                error: error.message || 'Internal server error',
            },
            500
        );
    }
});

/**
 * GET /sessions - List recent analysis sessions
 */
analysisRoutes.get('/sessions', authenticateRequest, async (c) => {
    try {
        const service = c.req.query('service');
        const limit = parseInt(c.req.query('limit') || '20');

        let query = 'SELECT * FROM analysis_sessions WHERE 1=1';
        const bindings: any[] = [];

        if (service) {
            query += ' AND service_name = ?';
            bindings.push(service);
        }

        query += ' ORDER BY created_at DESC LIMIT ?';
        bindings.push(Math.min(limit, 100));

        const results = await c.env.DB.prepare(query).bind(...bindings).all<any>();

        const sessions = results.results.map((s) => ({
            id: s.id,
            service_name: s.service_name,
            status: s.status,
            error_count: s.error_count,
            created_at: new Date(s.created_at).toISOString(),
            completed_at: s.completed_at
                ? new Date(s.completed_at).toISOString()
                : null,
        }));

        return c.json({ sessions });
    } catch (error: any) {
        console.error('Sessions list error:', error);
        return c.json(
            {
                error: error.message || 'Internal server error',
            },
            500
        );
    }
});

/**
 * Validate UTC timestamps
 */
function validateUTCTimestamps(
    startTime: string,
    endTime: string
): {
    valid: boolean;
    start_time?: number;
    end_time?: number;
    error?: string;
} {
    // Check if strings end with 'Z' (UTC indicator)
    if (!startTime.endsWith('Z')) {
        return {
            valid: false,
            error: 'start_time must be in UTC (end with Z). Example: 2024-01-15T00:00:00.000Z',
        };
    }

    if (!endTime.endsWith('Z')) {
        return {
            valid: false,
            error: 'end_time must be in UTC (end with Z). Example: 2024-01-15T23:59:59.999Z',
        };
    }

    // Parse timestamps
    const startDate = parseISO(startTime);
    const endDate = parseISO(endTime);

    // Validate parsing
    if (!isValid(startDate)) {
        return {
            valid: false,
            error: 'start_time is not a valid ISO 8601 datetime. Example: 2024-01-15T00:00:00.000Z',
        };
    }

    if (!isValid(endDate)) {
        return {
            valid: false,
            error: 'end_time is not a valid ISO 8601 datetime. Example: 2024-01-15T23:59:59.999Z',
        };
    }

    // Convert to Unix timestamps (milliseconds)
    const start_time = getTime(startDate);
    const end_time = getTime(endDate);

    return {
        valid: true,
        start_time,
        end_time,
    };
}
