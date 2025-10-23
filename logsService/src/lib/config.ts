/**
 * Configuration management for service-specific and default settings
 */

import { ServiceConfig, ServiceConfigUpdate, DefaultConfig } from '../types';

/**
 * Get configuration for a specific service
 */
export async function getServiceConfig(
    db: D1Database,
    serviceName: string
): Promise<ServiceConfig | null> {
    const result = await db
        .prepare('SELECT * FROM service_configs WHERE service_name = ?')
        .bind(serviceName)
        .first<ServiceConfig>();

    return result;
}

/**
 * Get configuration for a service, falling back to defaults
 */
export async function getServiceConfigOrDefault(
    db: D1Database,
    serviceName: string
): Promise<Partial<ServiceConfig>> {
    const config = await getServiceConfig(db, serviceName);

    if (config) {
        return config;
    }

    // Return default config
    const defaults = await getDefaultConfig(db);
    return {
        service_name: serviceName,
        ttl_days: defaults.default_ttl_days,
        retention_policy: defaults.default_retention_policy,
        alert_on_errors: false,
    };
}

/**
 * Update or create service configuration
 */
export async function updateServiceConfig(
    db: D1Database,
    serviceName: string,
    config: ServiceConfigUpdate
): Promise<void> {
    const now = Date.now();
    const existing = await getServiceConfig(db, serviceName);

    if (existing) {
        // Update existing config
        const updates: string[] = [];
        const bindings: any[] = [];

        if (config.ttl_days !== undefined) {
            updates.push('ttl_days = ?');
            bindings.push(config.ttl_days);
        }
        if (config.retention_policy !== undefined) {
            updates.push('retention_policy = ?');
            bindings.push(config.retention_policy);
        }
        if (config.alert_on_errors !== undefined) {
            updates.push('alert_on_errors = ?');
            bindings.push(config.alert_on_errors ? 1 : 0);
        }
        if (config.max_logs_per_day !== undefined) {
            updates.push('max_logs_per_day = ?');
            bindings.push(config.max_logs_per_day);
        }

        updates.push('updated_at = ?');
        bindings.push(now);
        bindings.push(serviceName);

        await db
            .prepare(
                `UPDATE service_configs SET ${updates.join(', ')} WHERE service_name = ?`
            )
            .bind(...bindings)
            .run();
    } else {
        // Insert new config
        const defaults = await getDefaultConfig(db);

        await db
            .prepare(`
                INSERT INTO service_configs (
                    service_name, ttl_days, retention_policy,
                    alert_on_errors, max_logs_per_day, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `)
            .bind(
                serviceName,
                config.ttl_days ?? defaults.default_ttl_days,
                config.retention_policy ?? defaults.default_retention_policy,
                config.alert_on_errors ? 1 : 0,
                config.max_logs_per_day ?? null,
                now,
                now
            )
            .run();
    }
}

/**
 * Get default configuration
 */
export async function getDefaultConfig(db: D1Database): Promise<DefaultConfig> {
    const results = await db
        .prepare('SELECT key, value FROM default_config')
        .all();

    const config: any = {};
    for (const row of results.results) {
        const key = row.key as string;
        const value = row.value as string;

        // Parse values appropriately
        if (key === 'default_ttl_days' || key === 'cleanup_batch_size') {
            config[key] = parseInt(value);
        } else if (key === 'enable_agentic_analysis') {
            config[key] = value === 'true';
        } else {
            config[key] = value;
        }
    }

    return config as DefaultConfig;
}

/**
 * Update a default configuration value
 */
export async function updateDefaultConfig(
    db: D1Database,
    key: string,
    value: string
): Promise<void> {
    await db
        .prepare('INSERT OR REPLACE INTO default_config (key, value) VALUES (?, ?)')
        .bind(key, value)
        .run();
}

/**
 * Get all service configurations
 */
export async function getAllServiceConfigs(db: D1Database): Promise<ServiceConfig[]> {
    const results = await db
        .prepare('SELECT * FROM service_configs ORDER BY service_name')
        .all<ServiceConfig>();

    return results.results;
}
