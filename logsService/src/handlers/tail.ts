/**
 * Tail Worker handler for consuming logs from other Cloudflare Workers
 */

import { TraceItem, LogEntry, Env } from '../types';
import { ingestLog } from '../lib/ingester';

/**
 * Handle tail events from Cloudflare Workers
 */
export async function tailHandler(
    events: TraceItem[],
    env: Env,
    ctx: ExecutionContext
): Promise<void> {
    // Process all events in parallel
    const promises = events.map((event) => processTailEvent(event, env, ctx));

    // Use allSettled to ensure all events are processed even if some fail
    const results = await Promise.allSettled(promises);

    // Log any failures for debugging
    const failures = results.filter((r) => r.status === 'rejected');
    if (failures.length > 0) {
        console.error(`Failed to process ${failures.length} tail events:`, failures);
    }
}

/**
 * Process a single tail event
 */
async function processTailEvent(
    event: TraceItem,
    env: Env,
    ctx: ExecutionContext
): Promise<void> {
    const logs: LogEntry[] = [];

    // Extract service name from script name
    const serviceName = event.scriptName || 'unknown';

    // Process console.log messages
    if (event.logs && event.logs.length > 0) {
        for (const log of event.logs) {
            logs.push({
                service_name: serviceName,
                level: mapTailLogLevel(log.level),
                message: log.message.join(' '),
                timestamp: log.timestamp,
                metadata: {
                    source: 'tail',
                    event_timestamp: event.eventTimestamp,
                    outcome: event.outcome,
                    log_level_original: log.level,
                },
                source_type: 'tail',
            });
        }
    }

    // Process exceptions
    if (event.exceptions && event.exceptions.length > 0) {
        for (const exception of event.exceptions) {
            logs.push({
                service_name: serviceName,
                level: 'ERROR',
                message: `${exception.name}: ${exception.message}`,
                timestamp: exception.timestamp,
                metadata: {
                    source: 'tail',
                    exception_name: exception.name,
                    stack: exception.stack,
                    outcome: event.outcome,
                    event_timestamp: event.eventTimestamp,
                },
                source_type: 'tail',
            });
        }
    }

    // Ingest all extracted logs
    const ingestionPromises = logs.map((log) =>
        ingestLog(log, env, ctx).catch((error) => {
            console.error('Failed to ingest tail log:', error, log);
            // Don't rethrow - we want to process other logs even if one fails
        })
    );

    await Promise.allSettled(ingestionPromises);
}

/**
 * Map Cloudflare tail log levels to our standard log levels
 */
function mapTailLogLevel(level: 'log' | 'debug' | 'info' | 'warn' | 'error'): 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' {
    switch (level) {
        case 'debug':
            return 'DEBUG';
        case 'info':
        case 'log':
            return 'INFO';
        case 'warn':
            return 'WARN';
        case 'error':
            return 'ERROR';
        default:
            return 'INFO';
    }
}
