/**
 * Log summarization agent
 * Provides AI-powered summaries of log activity
 */

import { Env } from '../types';
import { buildLogSummarizationPrompt } from './prompts';

/**
 * Summarize logs for a service
 */
export async function summarizeLogs(
    env: Env,
    serviceName: string,
    startTime?: number,
    endTime?: number
): Promise<string> {
    try {
        // Get recent logs for the service
        const logs = await getLogsForSummarization(
            env.DB,
            serviceName,
            startTime,
            endTime
        );

        if (logs.length === 0) {
            return 'No logs found for the specified time period.';
        }

        // Build prompt
        const prompt = buildLogSummarizationPrompt(serviceName, logs);

        // Run AI summarization
        const response = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
            prompt,
            max_tokens: 300,
        });

        if (!response || !response.response) {
            return 'Failed to generate summary.';
        }

        return response.response;
    } catch (error) {
        console.error('Summarization error:', error);
        throw error;
    }
}

/**
 * Get logs for summarization
 */
async function getLogsForSummarization(
    db: D1Database,
    serviceName: string,
    startTime?: number,
    endTime?: number,
    limit: number = 100
): Promise<Array<{ level: string; message: string; timestamp: number }>> {
    let query = `
        SELECT level, message, timestamp
        FROM logs
        WHERE service_name = ?
    `;
    const bindings: any[] = [serviceName];

    if (startTime) {
        query += ' AND timestamp >= ?';
        bindings.push(startTime);
    }

    if (endTime) {
        query += ' AND timestamp <= ?';
        bindings.push(endTime);
    }

    query += ' ORDER BY timestamp DESC LIMIT ?';
    bindings.push(limit);

    const results = await db.prepare(query).bind(...bindings).all<any>();

    return results.results.map((row) => ({
        level: row.level,
        message: row.message,
        timestamp: row.timestamp,
    }));
}

/**
 * Generate daily summary for a service
 */
export async function generateDailySummary(
    env: Env,
    serviceName: string
): Promise<{
    summary: string;
    stats: {
        total_logs: number;
        errors: number;
        warnings: number;
    };
}> {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    // Get statistics
    const stats = await getDailyStats(env.DB, serviceName, oneDayAgo);

    // Generate AI summary
    const summary = await summarizeLogs(env, serviceName, oneDayAgo);

    return {
        summary,
        stats,
    };
}

/**
 * Get daily statistics for a service
 */
async function getDailyStats(
    db: D1Database,
    serviceName: string,
    since: number
): Promise<{
    total_logs: number;
    errors: number;
    warnings: number;
}> {
    const results = await db
        .prepare(
            `
        SELECT
            COUNT(*) as total_logs,
            SUM(CASE WHEN level = 'ERROR' THEN 1 ELSE 0 END) as errors,
            SUM(CASE WHEN level = 'WARN' THEN 1 ELSE 0 END) as warnings
        FROM logs
        WHERE service_name = ? AND timestamp >= ?
    `
        )
        .bind(serviceName, since)
        .first<any>();

    return {
        total_logs: results?.total_logs || 0,
        errors: results?.errors || 0,
        warnings: results?.warnings || 0,
    };
}
