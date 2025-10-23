/**
 * Cleanup cron job for removing old logs based on TTL
 */

import { Env } from '../types';
import { getDefaultConfig, getAllServiceConfigs } from '../lib/config';
import { getLogsForCleanup, deleteLogsMetadata, deleteLogFromR2 } from '../lib/storage';

/**
 * Main cleanup cron job
 * Runs daily to remove logs that have exceeded their TTL
 */
export async function cleanupCron(env: Env): Promise<void> {
    console.log('Starting cleanup job...', new Date().toISOString());

    try {
        // Get default configuration
        const defaultConfig = await getDefaultConfig(env.DB);
        const defaultTTLDays = defaultConfig.default_ttl_days;
        const batchSize = defaultConfig.cleanup_batch_size;

        // Get all service configurations
        const serviceConfigs = await getAllServiceConfigs(env.DB);

        // Create a map of service TTLs
        const serviceTTLs = new Map<string, number>();
        for (const config of serviceConfigs) {
            serviceTTLs.set(config.service_name, config.ttl_days);
        }

        // Get all unique services from logs
        const servicesResult = await env.DB.prepare(
            'SELECT DISTINCT service_name FROM logs'
        ).all<{ service_name: string }>();

        const services = servicesResult.results.map((r) => r.service_name);

        console.log(`Found ${services.length} services to clean up`);

        let totalDeleted = 0;

        // Process each service
        for (const serviceName of services) {
            const ttlDays = serviceTTLs.get(serviceName) || defaultTTLDays;
            const cutoffTime = Date.now() - ttlDays * 24 * 60 * 60 * 1000;

            let serviceDeleted = 0;
            let hasMore = true;

            // Process in batches
            while (hasMore) {
                const logsToDelete = await getLogsForCleanup(
                    env.DB,
                    serviceName,
                    cutoffTime,
                    batchSize
                );

                if (logsToDelete.length === 0) {
                    hasMore = false;
                    break;
                }

                console.log(
                    `Deleting ${logsToDelete.length} logs for ${serviceName} (TTL: ${ttlDays} days)`
                );

                // Delete from R2 (in parallel)
                const r2Deletions = logsToDelete
                    .filter((log) => log.r2_key)
                    .map((log) =>
                        deleteLogFromR2(env.LOGS_ARCHIVE, log.r2_key!)
                            .catch((err) => {
                                console.error(`R2 delete error for ${log.r2_key}:`, err);
                            })
                    );

                await Promise.allSettled(r2Deletions);

                // Delete from D1
                const logIds = logsToDelete.map((log) => log.id);
                await deleteLogsMetadata(env.DB, logIds);

                serviceDeleted += logsToDelete.length;
                totalDeleted += logsToDelete.length;

                // If we got fewer logs than batch size, we're done with this service
                if (logsToDelete.length < batchSize) {
                    hasMore = false;
                }
            }

            if (serviceDeleted > 0) {
                console.log(`Deleted ${serviceDeleted} logs for ${serviceName}`);
            }
        }

        console.log(`Cleanup job completed. Total deleted: ${totalDeleted}`);

        // Log cleanup summary
        await logCleanupSummary(env, totalDeleted, services.length);
    } catch (error) {
        console.error('Cleanup job failed:', error);
        throw error;
    }
}

/**
 * Log cleanup summary for monitoring
 */
async function logCleanupSummary(
    env: Env,
    totalDeleted: number,
    servicesProcessed: number
): Promise<void> {
    try {
        await env.DB.prepare(`
            INSERT INTO logs (
                id, service_name, level, message,
                timestamp, metadata_json, source_type
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
            .bind(
                crypto.randomUUID(),
                'logsService-cleanup',
                'INFO',
                `Cleanup job completed: ${totalDeleted} logs deleted from ${servicesProcessed} services`,
                Date.now(),
                JSON.stringify({
                    total_deleted: totalDeleted,
                    services_processed: servicesProcessed,
                }),
                'agent'
            )
            .run();
    } catch (error) {
        console.error('Failed to log cleanup summary:', error);
    }
}

/**
 * Get cleanup statistics without performing deletion
 * Useful for dry-run or reporting
 */
export async function getCleanupStats(env: Env): Promise<{
    services: Array<{
        service_name: string;
        ttl_days: number;
        logs_to_delete: number;
        oldest_log_age_days: number;
    }>;
    total_logs_to_delete: number;
}> {
    const defaultConfig = await getDefaultConfig(env.DB);
    const defaultTTLDays = defaultConfig.default_ttl_days;
    const serviceConfigs = await getAllServiceConfigs(env.DB);

    const serviceTTLs = new Map<string, number>();
    for (const config of serviceConfigs) {
        serviceTTLs.set(config.service_name, config.ttl_days);
    }

    const servicesResult = await env.DB.prepare(
        'SELECT DISTINCT service_name FROM logs'
    ).all<{ service_name: string }>();

    const services = servicesResult.results.map((r) => r.service_name);
    const stats: any[] = [];
    let totalToDelete = 0;

    for (const serviceName of services) {
        const ttlDays = serviceTTLs.get(serviceName) || defaultTTLDays;
        const cutoffTime = Date.now() - ttlDays * 24 * 60 * 60 * 1000;

        const countResult = await env.DB.prepare(`
            SELECT COUNT(*) as count, MIN(timestamp) as oldest
            FROM logs
            WHERE service_name = ? AND timestamp < ?
        `)
            .bind(serviceName, cutoffTime)
            .first<{ count: number; oldest: number }>();

        if (countResult && countResult.count > 0) {
            const oldestAge = Math.floor(
                (Date.now() - countResult.oldest) / (24 * 60 * 60 * 1000)
            );

            stats.push({
                service_name: serviceName,
                ttl_days: ttlDays,
                logs_to_delete: countResult.count,
                oldest_log_age_days: oldestAge,
            });

            totalToDelete += countResult.count;
        }
    }

    return {
        services: stats,
        total_logs_to_delete: totalToDelete,
    };
}
