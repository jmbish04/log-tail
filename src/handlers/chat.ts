/**
 * AI Chat endpoint for conversational log analysis
 */

import { Hono } from 'hono';
import { Env } from '../types';
import { ChatRequest, ChatMessage } from '../types-extended';
import { authenticateRequest } from '../middleware/auth';
import { searchLogs } from '../lib/search';

export const chatRoutes = new Hono<{ Bindings: Env }>();

/**
 * POST /chat - Send message to AI assistant
 */
chatRoutes.post('/chat', authenticateRequest, async (c) => {
    try {
        const body = await c.req.json<ChatRequest>();

        if (!body.session_id || !body.service_name || !body.message) {
            return c.json(
                {
                    error: 'Missing required fields',
                    required: ['session_id', 'service_name', 'message'],
                },
                400
            );
        }

        // Store user message
        const userMessageId = crypto.randomUUID();
        await storeChatMessage(c.env.DB, {
            id: userMessageId,
            session_id: body.session_id,
            service_name: body.service_name,
            role: 'user',
            message: body.message,
            context: body.context,
            created_at: Date.now(),
        });

        // Get relevant logs for context
        const logs = await getRelevantLogs(c.env.DB, body);

        // Build AI prompt with context
        const prompt = buildChatPrompt(body, logs);

        // Get AI response
        const aiResponse = await c.env.AI.run('@cf/meta/llama-3-8b-instruct', {
            prompt,
            max_tokens: 500,
        });

        const responseMessage = aiResponse?.response || 'I apologize, but I could not process your request.';

        // Store assistant message
        const assistantMessageId = crypto.randomUUID();
        await storeChatMessage(c.env.DB, {
            id: assistantMessageId,
            session_id: body.session_id,
            service_name: body.service_name,
            role: 'assistant',
            message: responseMessage,
            created_at: Date.now(),
        });

        return c.json({
            message: responseMessage,
            suggestions: generateSuggestions(body.message),
            related_logs: logs.slice(0, 5).map((l) => l.id),
        });
    } catch (error: any) {
        console.error('Chat error:', error);
        return c.json(
            {
                error: error.message || 'Internal server error',
            },
            500
        );
    }
});

/**
 * GET /chat/history/:session_id - Get chat history
 */
chatRoutes.get('/history/:session_id', authenticateRequest, async (c) => {
    try {
        const session_id = c.req.param('session_id');
        const limit = parseInt(c.req.query('limit') || '50');

        const messages = await c.env.DB.prepare(
            `SELECT * FROM chat_history
             WHERE session_id = ?
             ORDER BY created_at ASC
             LIMIT ?`
        )
            .bind(session_id, Math.min(limit, 100))
            .all<any>();

        return c.json({
            session_id,
            messages: messages.results.map((m) => ({
                id: m.id,
                role: m.role,
                message: m.message,
                context: m.context_json ? JSON.parse(m.context_json) : null,
                created_at: new Date(m.created_at).toISOString(),
            })),
        });
    } catch (error: any) {
        console.error('Chat history error:', error);
        return c.json(
            {
                error: error.message || 'Internal server error',
            },
            500
        );
    }
});

/**
 * Store chat message in database
 */
async function storeChatMessage(db: D1Database, message: ChatMessage): Promise<void> {
    await db
        .prepare(
            `INSERT INTO chat_history (
                id, session_id, service_name, role, message,
                context_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
            message.id,
            message.session_id,
            message.service_name,
            message.role,
            message.message,
            message.context ? JSON.stringify(message.context) : null,
            message.created_at
        )
        .run();
}

/**
 * Get relevant logs for context
 */
async function getRelevantLogs(
    db: D1Database,
    request: ChatRequest
): Promise<any[]> {
    // If specific time range provided, use it
    if (request.context?.time_range) {
        return await searchLogs(db, {
            service_name: request.service_name,
            start_time: request.context.time_range.start,
            end_time: request.context.time_range.end,
            limit: 20,
        });
    }

    // Otherwise, get recent errors
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    return await searchLogs(db, {
        service_name: request.service_name,
        level: 'ERROR',
        start_time: oneHourAgo,
        limit: 20,
    });
}

/**
 * Build chat prompt with context
 */
function buildChatPrompt(request: ChatRequest, logs: any[]): string {
    const recentErrors = logs
        .filter((l) => l.level === 'ERROR')
        .slice(0, 10)
        .map((l) => `- ${l.message}`)
        .join('\n');

    return `You are a helpful AI assistant specialized in analyzing application logs and helping developers debug issues.

Service: ${request.service_name}
User Question: ${request.message}

Recent Error Logs:
${recentErrors || 'No recent errors'}

Provide a helpful, technical response that:
1. Directly addresses the user's question
2. References specific log patterns if relevant
3. Suggests concrete debugging steps
4. Keeps the response concise (2-3 paragraphs max)

Response:`;
}

/**
 * Generate follow-up suggestions
 */
function generateSuggestions(userMessage: string): string[] {
    const message = userMessage.toLowerCase();

    if (message.includes('error') || message.includes('fail')) {
        return [
            'Show me the error pattern distribution',
            'When did these errors start occurring?',
            'What are the common metadata fields in these errors?',
        ];
    }

    if (message.includes('timeout')) {
        return [
            'Show me timeout trends over the last 24 hours',
            'Which services are affected by timeouts?',
            'What is the average response time?',
        ];
    }

    return [
        'Show me recent errors',
        'What are the top error patterns?',
        'Analyze the last 24 hours',
    ];
}
