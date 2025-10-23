/**
 * Anomaly detection agent
 * Detects unusual patterns in log volume and error rates
 */

import { Env } from '../types';
import { buildAnomalyDetectionPrompt } from './prompts';

/**
 * Detect anomalies in service logs
 */
export async function detectAnomalies(
    env: Env,
    serviceName: string
): Promise<{
    has_anomaly: boolean;
    severity: 'low' | 'medium' | 'high';
    description: string;
    recommendation: string;
}> {
    try {
        // Get current stats (last hour)
        const currentStats = await getRecentStats(env.DB, serviceName, 60);

        // Get historical stats (last 24 hours for baseline)
        const historicalStats = await getHistoricalStats(env.DB, serviceName, 1440);

        // Calculate metrics
        const currentErrorRate =
            currentStats.total_logs > 0
                ? (currentStats.errors / currentStats.total_logs) * 100
                : 0;

        const avgErrorRate =
            historicalStats.avg_total_logs > 0
                ? (historicalStats.avg_errors / historicalStats.avg_total_logs) * 100
                : 0;

        // Simple anomaly detection thresholds
        const errorRateIncrease = currentErrorRate - avgErrorRate;
        const volumeChange =
            Math.abs(currentStats.total_logs - historicalStats.avg_total_logs) /
            (historicalStats.avg_total_logs || 1);

        // Use AI for more sophisticated analysis
        const prompt = buildAnomalyDetectionPrompt(
            serviceName,
            {
                error_rate: currentErrorRate,
                total_logs: currentStats.total_logs,
            },
            {
                avg_error_rate: avgErrorRate,
                avg_total_logs: historicalStats.avg_total_logs,
            }
        );

        const response = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
            prompt,
            max_tokens: 250,
        });

        if (!response || !response.response) {
            // Fallback to rule-based detection
            return performRuleBasedDetection(
                errorRateIncrease,
                volumeChange,
                currentStats.total_logs,
                historicalStats.avg_total_logs
            );
        }

        return parseAnomalyResponse(response.response);
    } catch (error) {
        console.error('Anomaly detection error:', error);
        throw error;
    }
}

/**
 * Get recent statistics for a service
 */
async function getRecentStats(
    db: D1Database,
    serviceName: string,
    minutes: number
): Promise<{
    total_logs: number;
    errors: number;
    warnings: number;
}> {
    const since = Date.now() - minutes * 60 * 1000;

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

/**
 * Get historical statistics for baseline
 */
async function getHistoricalStats(
    db: D1Database,
    serviceName: string,
    minutes: number
): Promise<{
    avg_total_logs: number;
    avg_errors: number;
    avg_warnings: number;
}> {
    const since = Date.now() - minutes * 60 * 1000;

    const results = await db
        .prepare(
            `
        SELECT
            COUNT(*) as total_logs,
            SUM(CASE WHEN level = 'ERROR' THEN 1 ELSE 0 END) as total_errors,
            SUM(CASE WHEN level = 'WARN' THEN 1 ELSE 0 END) as total_warnings
        FROM logs
        WHERE service_name = ? AND timestamp >= ?
    `
        )
        .bind(serviceName, since)
        .first<any>();

    const hours = minutes / 60;

    return {
        avg_total_logs: (results?.total_logs || 0) / hours,
        avg_errors: (results?.total_errors || 0) / hours,
        avg_warnings: (results?.total_warnings || 0) / hours,
    };
}

/**
 * Parse AI anomaly detection response
 */
function parseAnomalyResponse(aiResponse: string): {
    has_anomaly: boolean;
    severity: 'low' | 'medium' | 'high';
    description: string;
    recommendation: string;
} {
    // Try to extract structured information from AI response
    const hasAnomalyMatch = aiResponse.match(/anomaly[:\s]*(yes|no)/i);
    const severityMatch = aiResponse.match(/severity[:\s]*(low|medium|high)/i);

    const has_anomaly = hasAnomalyMatch
        ? hasAnomalyMatch[1].toLowerCase() === 'yes'
        : false;
    const severity = (severityMatch?.[1]?.toLowerCase() as any) || 'low';

    // Extract description and recommendation (simplified)
    const lines = aiResponse.split('\n').filter((line) => line.trim());
    const description = lines.find((line) => line.includes('Description')) || aiResponse;
    const recommendation =
        lines.find((line) => line.includes('Recommended')) || 'Continue monitoring';

    return {
        has_anomaly,
        severity,
        description: description.substring(0, 200),
        recommendation: recommendation.substring(0, 200),
    };
}

/**
 * Fallback rule-based anomaly detection
 */
function performRuleBasedDetection(
    errorRateIncrease: number,
    volumeChange: number,
    currentVolume: number,
    historicalVolume: number
): {
    has_anomaly: boolean;
    severity: 'low' | 'medium' | 'high';
    description: string;
    recommendation: string;
} {
    let has_anomaly = false;
    let severity: 'low' | 'medium' | 'high' = 'low';
    let description = 'No significant anomalies detected';
    let recommendation = 'Continue normal monitoring';

    // Error rate anomaly
    if (errorRateIncrease > 20) {
        has_anomaly = true;
        severity = 'high';
        description = `Error rate increased by ${errorRateIncrease.toFixed(1)}%`;
        recommendation = 'Investigate error sources immediately';
    } else if (errorRateIncrease > 10) {
        has_anomaly = true;
        severity = 'medium';
        description = `Error rate increased by ${errorRateIncrease.toFixed(1)}%`;
        recommendation = 'Monitor error trends closely';
    }

    // Volume anomaly
    if (volumeChange > 2.0 && currentVolume > historicalVolume * 2) {
        has_anomaly = true;
        if (severity !== 'high') {
            severity = 'medium';
        }
        description += '. Unusual spike in log volume detected';
        recommendation += '. Check for potential logging loops or system issues';
    } else if (volumeChange > 2.0 && currentVolume < historicalVolume * 0.5) {
        has_anomaly = true;
        severity = 'medium';
        description += '. Significant drop in log volume detected';
        recommendation += '. Verify service is running and logging properly';
    }

    return {
        has_anomaly,
        severity,
        description,
        recommendation,
    };
}

/**
 * Run anomaly detection for all services
 */
export async function detectAllServiceAnomalies(
    env: Env
): Promise<
    Array<{
        service_name: string;
        has_anomaly: boolean;
        severity: 'low' | 'medium' | 'high';
        description: string;
    }>
> {
    // Get all services
    const servicesResult = await env.DB.prepare(
        'SELECT DISTINCT service_name FROM logs'
    ).all<{ service_name: string }>();

    const services = servicesResult.results.map((r) => r.service_name);

    // Detect anomalies for each service
    const results = await Promise.allSettled(
        services.map(async (service) => {
            const anomaly = await detectAnomalies(env, service);
            return {
                service_name: service,
                ...anomaly,
            };
        })
    );

    // Filter to only services with anomalies
    return results
        .filter((r) => r.status === 'fulfilled')
        .map((r) => (r as any).value)
        .filter((r) => r.has_anomaly);
}
