/**
 * Storage operations for D1 and R2
 */

import { LogEntry } from '../types';
import { compressData, decompressData } from './compression';

/**
 * Store log metadata in D1
 */
export async function storeLogMetadata(
    db: D1Database,
    log: LogEntry
): Promise<void> {
    const metadata_json = JSON.stringify(log.metadata || {});

    await db
        .prepare(`
            INSERT INTO logs (
                id, service_name, level, message,
                timestamp, metadata_json, source_type, r2_key
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
            log.id,
            log.service_name,
            log.level,
            log.message.substring(0, 1000), // Truncate for D1
            log.timestamp,
            metadata_json,
            log.source_type || 'http',
            log.r2_key || null
        )
        .run();
}

/**
 * Update R2 key in D1 after successful R2 upload
 */
export async function updateLogR2Key(
    db: D1Database,
    logId: string,
    r2Key: string
): Promise<void> {
    await db
        .prepare('UPDATE logs SET r2_key = ? WHERE id = ?')
        .bind(r2Key, logId)
        .run();
}

/**
 * Store full log in R2 with compression
 */
export async function storeLogInR2(
    r2: R2Bucket,
    log: LogEntry
): Promise<string> {
    const r2Key = generateR2Key(log);
    const compressed = await compressData(JSON.stringify(log));

    await r2.put(r2Key, compressed, {
        customMetadata: {
            service: log.service_name,
            level: log.level,
            timestamp: log.timestamp.toString(),
            source_type: log.source_type || 'http',
        },
    });

    return r2Key;
}

/**
 * Retrieve full log from R2
 */
export async function getLogFromR2(
    r2: R2Bucket,
    r2Key: string
): Promise<LogEntry | null> {
    const object = await r2.get(r2Key);

    if (!object) {
        return null;
    }

    const decompressed = await decompressData(object.body);
    return JSON.parse(decompressed) as LogEntry;
}

/**
 * Delete log from R2
 */
export async function deleteLogFromR2(
    r2: R2Bucket,
    r2Key: string
): Promise<void> {
    await r2.delete(r2Key);
}

/**
 * Delete log metadata from D1
 */
export async function deleteLogMetadata(
    db: D1Database,
    logId: string
): Promise<void> {
    await db.prepare('DELETE FROM logs WHERE id = ?').bind(logId).run();
}

/**
 * Delete multiple logs from D1
 */
export async function deleteLogsMetadata(
    db: D1Database,
    logIds: string[]
): Promise<void> {
    if (logIds.length === 0) return;

    const placeholders = logIds.map(() => '?').join(',');
    await db
        .prepare(`DELETE FROM logs WHERE id IN (${placeholders})`)
        .bind(...logIds)
        .run();
}

/**
 * Generate R2 key for a log entry
 * Format: logs/{service_name}/{date}/{log_id}.json.gz
 */
function generateR2Key(log: LogEntry): string {
    const date = new Date(log.timestamp).toISOString().split('T')[0];
    return `logs/${log.service_name}/${date}/${log.id}.json.gz`;
}

/**
 * Get logs that need cleanup based on TTL
 */
export async function getLogsForCleanup(
    db: D1Database,
    serviceName: string,
    cutoffTime: number,
    limit: number = 1000
): Promise<Array<{ id: string; r2_key: string | null }>> {
    const results = await db
        .prepare(`
            SELECT id, r2_key
            FROM logs
            WHERE service_name = ? AND timestamp < ?
            ORDER BY timestamp ASC
            LIMIT ?
        `)
        .bind(serviceName, cutoffTime, limit)
        .all<{ id: string; r2_key: string | null }>();

    return results.results;
}

/**
 * Get total log count for a service
 */
export async function getLogCount(
    db: D1Database,
    serviceName?: string
): Promise<number> {
    let query = 'SELECT COUNT(*) as count FROM logs';
    const bindings: any[] = [];

    if (serviceName) {
        query += ' WHERE service_name = ?';
        bindings.push(serviceName);
    }

    const result = await db.prepare(query).bind(...bindings).first<{ count: number }>();
    return result?.count || 0;
}

/**
 * Get log count by level for a service
 */
export async function getLogCountByLevel(
    db: D1Database,
    serviceName: string,
    startTime?: number,
    endTime?: number
): Promise<Record<string, number>> {
    let query = `
        SELECT level, COUNT(*) as count
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

    query += ' GROUP BY level';

    const results = await db
        .prepare(query)
        .bind(...bindings)
        .all<{ level: string; count: number }>();

    const counts: Record<string, number> = {};
    for (const row of results.results) {
        counts[row.level] = row.count;
    }

    return counts;
}
