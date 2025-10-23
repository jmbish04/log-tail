/**
 * Daily global analysis cron job
 * Analyzes logs across all services and generates daily insights
 */

import { Env } from '../types';
import { GlobalAnalysis, Anomaly } from '../types-extended';

/**
 * Run daily global analysis
 */
export async function globalAnalysisCron(env: Env): Promise<void> {
    console.log('Starting daily global analysis...', new Date().toISOString());

    try {
        // Get last run time
        const lastRun = await getLastRunTime(env.DB);
        const now = Date.now();

        // Calculate time range (last 24 hours from last run, or exactly 24h if first run)
        const end_time = now;
        const start_time = lastRun || now - 24 * 60 * 60 * 1000;

        console.log(`Analyzing logs from ${new Date(start_time).toISOString()} to ${new Date(end_time).toISOString()}`);

        // Gather global statistics
        const stats = await gatherGlobalStats(env.DB, start_time, end_time);

        // Detect anomalies
        const anomalies = await detectGlobalAnomalies(env.DB, stats, start_time, end_time);

        // Run AI analysis on aggregated data
        const aiAnalysis = await analyzeGlobalTrends(env, stats, anomalies);

        // Store global analysis
        const analysis: GlobalAnalysis = {
            id: crypto.randomUUID(),
            analysis_period: 'daily',
            start_time,
            end_time,
            total_logs: stats.total_logs,
            total_errors: stats.total_errors,
            total_warnings: stats.total_warnings,
            unique_services: stats.unique_services,
            error_rate: stats.error_rate,
            summary: aiAnalysis.summary,
            patterns: aiAnalysis.patterns,
            anomalies,
            recommendations: aiAnalysis.recommendations,
            analyzed_at: now,
        };

        await storeGlobalAnalysis(env.DB, analysis);

        // Update job tracker
        await updateJobTracker(env.DB, 'daily_global_analysis', now, 'success');

        console.log('Daily global analysis completed successfully');
    } catch (error) {
        console.error('Daily global analysis failed:', error);
        await updateJobTracker(env.DB, 'daily_global_analysis', Date.now(), 'failed');
        throw error;
    }
}

/**
 * Get last run time from job tracker
 */
async function getLastRunTime(db: D1Database): Promise<number | null> {
    const result = await db
        .prepare('SELECT last_run_at FROM job_tracker WHERE job_name = ?')
        .bind('daily_global_analysis')
        .first<{ last_run_at: number }>();

    return result?.last_run_at || null;
}

/**
 * Gather global statistics
 */
async function gatherGlobalStats(
    db: D1Database,
    start_time: number,
    end_time: number
): Promise<{
    total_logs: number;
    total_errors: number;
    total_warnings: number;
    unique_services: number;
    error_rate: number;
    service_breakdown: Array<{
        service_name: string;
        log_count: number;
        error_count: number;
    }>;
}> {
    // Get overall stats
    const overallStats = await db
        .prepare(
            `
        SELECT
            COUNT(*) as total_logs,
            SUM(CASE WHEN level = 'ERROR' THEN 1 ELSE 0 END) as total_errors,
            SUM(CASE WHEN level = 'WARN' THEN 1 ELSE 0 END) as total_warnings,
            COUNT(DISTINCT service_name) as unique_services
        FROM logs
        WHERE timestamp >= ? AND timestamp < ?
    `
        )
        .bind(start_time, end_time)
        .first<any>();

    // Get per-service breakdown
    const serviceBreakdown = await db
        .prepare(
            `
        SELECT
            service_name,
            COUNT(*) as log_count,
            SUM(CASE WHEN level = 'ERROR' THEN 1 ELSE 0 END) as error_count
        FROM logs
        WHERE timestamp >= ? AND timestamp < ?
        GROUP BY service_name
        ORDER BY error_count DESC
        LIMIT 50
    `
        )
        .bind(start_time, end_time)
        .all<any>();

    const total_logs = overallStats?.total_logs || 0;
    const total_errors = overallStats?.total_errors || 0;
    const error_rate = total_logs > 0 ? (total_errors / total_logs) * 100 : 0;

    return {
        total_logs,
        total_errors,
        total_warnings: overallStats?.total_warnings || 0,
        unique_services: overallStats?.unique_services || 0,
        error_rate,
        service_breakdown: serviceBreakdown.results,
    };
}

/**
 * Detect global anomalies
 */
async function detectGlobalAnomalies(
    db: D1Database,
    currentStats: any,
    start_time: number,
    end_time: number
): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];

    // Get historical baseline (average of last 7 days before this period)
    const baselineEnd = start_time;
    const baselineStart = start_time - 7 * 24 * 60 * 60 * 1000;

    const baseline = await db
        .prepare(
            `
        SELECT
            COUNT(*) / 7.0 as avg_daily_logs,
            SUM(CASE WHEN level = 'ERROR' THEN 1 ELSE 0 END) / 7.0 as avg_daily_errors
        FROM logs
        WHERE timestamp >= ? AND timestamp < ?
    `
        )
        .bind(baselineStart, baselineEnd)
        .first<any>();

    if (baseline) {
        const avg_daily_logs = baseline.avg_daily_logs || 0;
        const avg_daily_errors = baseline.avg_daily_errors || 0;

        // Error spike detection
        if (
            avg_daily_errors > 0 &&
            currentStats.total_errors > avg_daily_errors * 2
        ) {
            anomalies.push({
                type: 'error_spike',
                service_name: 'global',
                severity: currentStats.total_errors > avg_daily_errors * 5 ? 'high' : 'medium',
                description: `Error count increased by ${Math.round(
                    ((currentStats.total_errors - avg_daily_errors) / avg_daily_errors) * 100
                )}% compared to 7-day average`,
                detected_at: Date.now(),
                value: currentStats.total_errors,
                threshold: avg_daily_errors * 2,
            });
        }

        // Volume spike detection
        if (avg_daily_logs > 0 && currentStats.total_logs > avg_daily_logs * 3) {
            anomalies.push({
                type: 'volume_spike',
                service_name: 'global',
                severity: 'medium',
                description: `Log volume increased significantly`,
                detected_at: Date.now(),
                value: currentStats.total_logs,
                threshold: avg_daily_logs * 3,
            });
        }

        // Volume drop detection
        if (avg_daily_logs > 100 && currentStats.total_logs < avg_daily_logs * 0.3) {
            anomalies.push({
                type: 'volume_drop',
                service_name: 'global',
                severity: 'medium',
                description: `Log volume dropped significantly`,
                detected_at: Date.now(),
                value: currentStats.total_logs,
                threshold: avg_daily_logs * 0.3,
            });
        }
    }

    // Check for services with unusual error rates
    for (const service of currentStats.service_breakdown) {
        const errorRate = service.log_count > 0 ? (service.error_count / service.log_count) * 100 : 0;

        if (service.error_count > 10 && errorRate > 50) {
            anomalies.push({
                type: 'error_spike',
                service_name: service.service_name,
                severity: errorRate > 80 ? 'high' : 'medium',
                description: `High error rate (${errorRate.toFixed(1)}%)`,
                detected_at: Date.now(),
                value: errorRate,
                threshold: 50,
            });
        }
    }

    return anomalies;
}

/**
 * Analyze global trends with AI
 */
async function analyzeGlobalTrends(
    env: Env,
    stats: any,
    anomalies: Anomaly[]
): Promise<{
    summary: string;
    patterns: string[];
    recommendations: string[];
}> {
    const prompt = buildGlobalAnalysisPrompt(stats, anomalies);

    try {
        const response = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
            prompt,
            max_tokens: 600,
        });

        if (!response || !response.response) {
            throw new Error('No AI response');
        }

        return parseAIResponse(response.response);
    } catch (error) {
        console.error('AI analysis error:', error);
        return {
            summary: `Daily analysis: ${stats.total_logs} logs from ${stats.unique_services} services. Error rate: ${stats.error_rate.toFixed(2)}%`,
            patterns: [`${anomalies.length} anomalies detected`],
            recommendations: ['Manual review recommended'],
        };
    }
}

/**
 * Build global analysis prompt
 */
function buildGlobalAnalysisPrompt(stats: any, anomalies: Anomaly[]): string {
    const topServices = stats.service_breakdown
        .slice(0, 10)
        .map((s: any) => `${s.service_name}: ${s.error_count} errors (${s.log_count} logs)`)
        .join('\n');

    const anomalyList = anomalies
        .map((a) => `- ${a.type} in ${a.service_name}: ${a.description}`)
        .join('\n');

    return `Analyze the following global system logs for the last 24 hours:

Total Logs: ${stats.total_logs}
Total Errors: ${stats.total_errors}
Total Warnings: ${stats.total_warnings}
Unique Services: ${stats.unique_services}
Error Rate: ${stats.error_rate.toFixed(2)}%

Top Services by Errors:
${topServices}

Detected Anomalies:
${anomalyList || 'None'}

Provide a JSON response:
{
  "summary": "2-3 sentence executive summary of system health",
  "patterns": ["pattern1", "pattern2", "pattern3"],
  "recommendations": ["rec1", "rec2", "rec3"]
}

Focus on system-wide trends and critical issues.`;
}

/**
 * Parse AI response
 */
function parseAIResponse(aiResponse: string): {
    summary: string;
    patterns: string[];
    recommendations: string[];
} {
    try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
                summary: parsed.summary || 'Analysis completed',
                patterns: Array.isArray(parsed.patterns) ? parsed.patterns : [],
                recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
            };
        }

        return {
            summary: aiResponse.substring(0, 300),
            patterns: [],
            recommendations: [],
        };
    } catch (error) {
        return {
            summary: 'Analysis completed but parsing failed',
            patterns: [],
            recommendations: [],
        };
    }
}

/**
 * Store global analysis
 */
async function storeGlobalAnalysis(
    db: D1Database,
    analysis: GlobalAnalysis
): Promise<void> {
    await db
        .prepare(
            `
        INSERT INTO global_analysis (
            id, analysis_period, start_time, end_time,
            total_logs, total_errors, total_warnings,
            unique_services, error_rate, summary,
            patterns_json, anomalies_json, recommendations_json,
            analyzed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
        )
        .bind(
            analysis.id,
            analysis.analysis_period,
            analysis.start_time,
            analysis.end_time,
            analysis.total_logs,
            analysis.total_errors,
            analysis.total_warnings,
            analysis.unique_services,
            analysis.error_rate,
            analysis.summary,
            JSON.stringify(analysis.patterns || []),
            JSON.stringify(analysis.anomalies || []),
            JSON.stringify(analysis.recommendations || []),
            analysis.analyzed_at
        )
        .run();
}

/**
 * Update job tracker
 */
async function updateJobTracker(
    db: D1Database,
    jobName: string,
    runTime: number,
    status: 'success' | 'failed'
): Promise<void> {
    const existing = await db
        .prepare('SELECT run_count FROM job_tracker WHERE job_name = ?')
        .bind(jobName)
        .first<{ run_count: number }>();

    if (existing) {
        await db
            .prepare(
                `
            UPDATE job_tracker
            SET last_run_at = ?,
                last_run_status = ?,
                run_count = run_count + 1
            WHERE job_name = ?
        `
            )
            .bind(runTime, status, jobName)
            .run();
    } else {
        await db
            .prepare(
                `
            INSERT INTO job_tracker (
                job_name, last_run_at, last_run_status, run_count
            ) VALUES (?, ?, ?, ?)
        `
            )
            .bind(jobName, runTime, status, 1)
            .run();
    }
}
