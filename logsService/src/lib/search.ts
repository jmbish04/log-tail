/**
 * Log search and query functionality
 */

import { LogEntry, LogSearchParams } from '../types';

/**
 * Search logs with various filters
 */
export async function searchLogs(
    db: D1Database,
    params: LogSearchParams
): Promise<LogEntry[]> {
    let query = 'SELECT * FROM logs WHERE 1=1';
    const bindings: any[] = [];

    // Add filters
    if (params.service_name) {
        query += ' AND service_name = ?';
        bindings.push(params.service_name);
    }

    if (params.level) {
        query += ' AND level = ?';
        bindings.push(params.level);
    }

    if (params.start_time) {
        query += ' AND timestamp >= ?';
        bindings.push(params.start_time);
    }

    if (params.end_time) {
        query += ' AND timestamp <= ?';
        bindings.push(params.end_time);
    }

    // Order by timestamp descending (most recent first)
    query += ' ORDER BY timestamp DESC';

    // Add limit and offset
    if (params.limit) {
        query += ' LIMIT ?';
        bindings.push(params.limit);
    }

    if (params.offset) {
        query += ' OFFSET ?';
        bindings.push(params.offset);
    }

    const results = await db
        .prepare(query)
        .bind(...bindings)
        .all<any>();

    // Transform results to LogEntry format
    return results.results.map(row => ({
        id: row.id,
        service_name: row.service_name,
        level: row.level,
        message: row.message,
        timestamp: row.timestamp,
        metadata: row.metadata_json ? JSON.parse(row.metadata_json) : {},
        source_type: row.source_type,
        r2_key: row.r2_key,
    }));
}

/**
 * Get recent logs for a service
 */
export async function getRecentLogs(
    db: D1Database,
    serviceName: string,
    limit: number = 100
): Promise<LogEntry[]> {
    return searchLogs(db, {
        service_name: serviceName,
        limit,
    });
}

/**
 * Get error logs for a service in a time range
 */
export async function getErrorLogs(
    db: D1Database,
    serviceName: string,
    startTime?: number,
    endTime?: number,
    limit: number = 100
): Promise<LogEntry[]> {
    return searchLogs(db, {
        service_name: serviceName,
        level: 'ERROR',
        start_time: startTime,
        end_time: endTime,
        limit,
    });
}

/**
 * Search logs by message content (simple substring search)
 */
export async function searchLogsByMessage(
    db: D1Database,
    serviceName: string,
    searchTerm: string,
    limit: number = 100
): Promise<LogEntry[]> {
    const results = await db
        .prepare(`
            SELECT * FROM logs
            WHERE service_name = ?
            AND message LIKE ?
            ORDER BY timestamp DESC
            LIMIT ?
        `)
        .bind(serviceName, `%${searchTerm}%`, limit)
        .all<any>();

    return results.results.map(row => ({
        id: row.id,
        service_name: row.service_name,
        level: row.level,
        message: row.message,
        timestamp: row.timestamp,
        metadata: row.metadata_json ? JSON.parse(row.metadata_json) : {},
        source_type: row.source_type,
        r2_key: row.r2_key,
    }));
}

/**
 * Get log by ID
 */
export async function getLogById(
    db: D1Database,
    logId: string
): Promise<LogEntry | null> {
    const result = await db
        .prepare('SELECT * FROM logs WHERE id = ?')
        .bind(logId)
        .first<any>();

    if (!result) {
        return null;
    }

    return {
        id: result.id,
        service_name: result.service_name,
        level: result.level,
        message: result.message,
        timestamp: result.timestamp,
        metadata: result.metadata_json ? JSON.parse(result.metadata_json) : {},
        source_type: result.source_type,
        r2_key: result.r2_key,
    };
}

/**
 * Get unique service names
 */
export async function getServiceNames(db: D1Database): Promise<string[]> {
    const results = await db
        .prepare('SELECT DISTINCT service_name FROM logs ORDER BY service_name')
        .all<{ service_name: string }>();

    return results.results.map(row => row.service_name);
}

/**
 * Get log statistics for a service
 */
export async function getLogStats(
    db: D1Database,
    serviceName: string,
    startTime?: number,
    endTime?: number
): Promise<{
    total: number;
    by_level: Record<string, number>;
    oldest_timestamp?: number;
    newest_timestamp?: number;
}> {
    let countQuery = 'SELECT COUNT(*) as total FROM logs WHERE service_name = ?';
    let levelQuery = 'SELECT level, COUNT(*) as count FROM logs WHERE service_name = ?';
    let timeQuery = 'SELECT MIN(timestamp) as oldest, MAX(timestamp) as newest FROM logs WHERE service_name = ?';

    const bindings: any[] = [serviceName];
    const timeBindings: any[] = [serviceName];

    if (startTime) {
        const timeFilter = ' AND timestamp >= ?';
        countQuery += timeFilter;
        levelQuery += timeFilter;
        timeQuery += timeFilter;
        bindings.push(startTime);
        timeBindings.push(startTime);
    }

    if (endTime) {
        const timeFilter = ' AND timestamp <= ?';
        countQuery += timeFilter;
        levelQuery += timeFilter;
        timeQuery += timeFilter;
        bindings.push(endTime);
        timeBindings.push(endTime);
    }

    levelQuery += ' GROUP BY level';

    // Run queries
    const [totalResult, levelResults, timeResult] = await Promise.all([
        db.prepare(countQuery).bind(...bindings).first<{ total: number }>(),
        db.prepare(levelQuery).bind(...bindings).all<{ level: string; count: number }>(),
        db.prepare(timeQuery).bind(...timeBindings).first<{ oldest: number; newest: number }>(),
    ]);

    const by_level: Record<string, number> = {};
    for (const row of levelResults.results) {
        by_level[row.level] = row.count;
    }

    return {
        total: totalResult?.total || 0,
        by_level,
        oldest_timestamp: timeResult?.oldest,
        newest_timestamp: timeResult?.newest,
    };
}
