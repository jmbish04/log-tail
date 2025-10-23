/**
 * Core ingestion logic for processing and storing logs
 */

import { LogEntry } from '../types';
import { storeLogMetadata, storeLogInR2, updateLogR2Key } from './storage';

/**
 * Ingest a log entry into the system
 * Stores metadata in D1 and full log in R2
 */
export async function ingestLog(
    log: LogEntry,
    env: { DB: D1Database; LOGS_ARCHIVE: R2Bucket },
    ctx: ExecutionContext
): Promise<string> {
    // Generate ID if not provided
    const id = log.id || crypto.randomUUID();
    const timestamp = log.timestamp || Date.now();

    // Validate log entry
    validateLogEntry(log);

    // Prepare log entry with ID and timestamp
    const logEntry: LogEntry = {
        ...log,
        id,
        timestamp,
        level: log.level.toUpperCase() as any,
    };

    // Store metadata in D1 (blocking)
    await storeLogMetadata(env.DB, logEntry);

    // Store full log in R2 (non-blocking, using waitUntil)
    ctx.waitUntil(
        (async () => {
            try {
                const r2Key = await storeLogInR2(env.LOGS_ARCHIVE, logEntry);

                // Update D1 with R2 key
                await updateLogR2Key(env.DB, id, r2Key);
            } catch (error) {
                console.error('R2 storage error:', error);
                // Log the error but don't fail the ingestion
                // The log is still in D1 even if R2 storage fails
            }
        })()
    );

    return id;
}

/**
 * Batch ingest multiple logs
 */
export async function batchIngestLogs(
    logs: LogEntry[],
    env: { DB: D1Database; LOGS_ARCHIVE: R2Bucket },
    ctx: ExecutionContext
): Promise<{ successful: number; failed: number; errors: string[] }> {
    const errors: string[] = [];
    let successful = 0;
    let failed = 0;

    // Process logs in parallel with error handling
    const results = await Promise.allSettled(
        logs.map((log) => ingestLog(log, env, ctx))
    );

    for (const result of results) {
        if (result.status === 'fulfilled') {
            successful++;
        } else {
            failed++;
            errors.push(result.reason?.message || 'Unknown error');
        }
    }

    return { successful, failed, errors };
}

/**
 * Validate a log entry
 */
function validateLogEntry(log: LogEntry): void {
    if (!log.service_name || log.service_name.trim() === '') {
        throw new Error('service_name is required');
    }

    if (!log.level) {
        throw new Error('level is required');
    }

    const validLevels = ['DEBUG', 'INFO', 'WARN', 'WARNING', 'ERROR', 'CRITICAL'];
    const normalizedLevel = log.level.toUpperCase();
    if (!validLevels.includes(normalizedLevel)) {
        throw new Error(`Invalid log level: ${log.level}. Must be one of: ${validLevels.join(', ')}`);
    }

    if (!log.message || log.message.trim() === '') {
        throw new Error('message is required');
    }

    // Validate message length (warn if too long)
    if (log.message.length > 10000) {
        console.warn(`Log message is very long (${log.message.length} chars). Consider truncating.`);
    }

    // Validate metadata size
    if (log.metadata) {
        const metadataSize = JSON.stringify(log.metadata).length;
        if (metadataSize > 50000) {
            throw new Error(`Metadata is too large (${metadataSize} bytes). Maximum is 50KB.`);
        }
    }

    // Validate service name format (alphanumeric, dashes, underscores)
    const serviceNameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!serviceNameRegex.test(log.service_name)) {
        throw new Error('service_name must contain only alphanumeric characters, dashes, and underscores');
    }
}

/**
 * Normalize log level to standard format
 */
export function normalizeLogLevel(level: string): string {
    const normalized = level.toUpperCase();

    // Map common variations
    const levelMap: Record<string, string> = {
        'WARNING': 'WARN',
        'FATAL': 'CRITICAL',
        'TRACE': 'DEBUG',
    };

    return levelMap[normalized] || normalized;
}
