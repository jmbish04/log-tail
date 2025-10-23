/**
 * Agentic analysis cron job
 * Runs periodically to analyze error patterns and provide insights
 */

import { Env, ErrorSummary, AnalysisResult } from '../types';
import { getDefaultConfig } from '../lib/config';

/**
 * Main analysis cron job
 * Analyzes error patterns and generates insights using AI
 */
export async function analysisCron(env: Env): Promise<void> {
    console.log('Starting agentic analysis job...', new Date().toISOString());

    try {
        // Check if agentic analysis is enabled
        const config = await getDefaultConfig(env.DB);
        if (!config.enable_agentic_analysis) {
            console.log('Agentic analysis is disabled');
            return;
        }

        // Time window for analysis (last 6 hours)
        const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;

        // Get error summaries by service
        const errorSummaries = await getErrorSummaries(env.DB, sixHoursAgo);

        console.log(`Found ${errorSummaries.length} services with errors to analyze`);

        let analysisCount = 0;

        // Analyze each service
        for (const summary of errorSummaries) {
            try {
                const analysis = await analyzeServiceErrors(env, summary);

                if (analysis) {
                    await storeAnalysisResult(env.DB, analysis);
                    analysisCount++;

                    console.log(
                        `Analysis completed for ${summary.service_name}: ${analysis.severity}`
                    );
                }
            } catch (error) {
                console.error(`Analysis failed for ${summary.service_name}:`, error);
            }
        }

        console.log(`Analysis job completed. Analyzed ${analysisCount} services.`);

        // Log analysis summary
        await logAnalysisSummary(env, analysisCount);
    } catch (error) {
        console.error('Analysis job failed:', error);
        throw error;
    }
}

/**
 * Get error summaries for services with significant error counts
 */
async function getErrorSummaries(
    db: D1Database,
    since: number,
    minErrors: number = 10
): Promise<ErrorSummary[]> {
    const results = await db
        .prepare(
            `
        SELECT
            service_name,
            COUNT(*) as error_count,
            GROUP_CONCAT(DISTINCT SUBSTR(message, 1, 200)) as sample_messages
        FROM logs
        WHERE level = 'ERROR'
            AND timestamp > ?
        GROUP BY service_name
        HAVING error_count >= ?
        ORDER BY error_count DESC
    `
        )
        .bind(since, minErrors)
        .all<any>();

    return results.results.map((row) => ({
        service_name: row.service_name,
        error_count: row.error_count,
        sample_messages: row.sample_messages || '',
    }));
}

/**
 * Analyze service errors using AI
 */
async function analyzeServiceErrors(
    env: Env,
    summary: ErrorSummary
): Promise<AnalysisResult | null> {
    try {
        // Prepare prompt for AI
        const prompt = buildAnalysisPrompt(summary);

        // Run AI analysis
        const response = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
            prompt,
            max_tokens: 400,
        });

        if (!response || !response.response) {
            console.warn(`No AI response for ${summary.service_name}`);
            return null;
        }

        // Parse AI response
        const analysis = parseAnalysisResponse(summary.service_name, response.response);

        return analysis;
    } catch (error) {
        console.error(`AI analysis error for ${summary.service_name}:`, error);
        return null;
    }
}

/**
 * Build analysis prompt for AI
 */
function buildAnalysisPrompt(summary: ErrorSummary): string {
    return `You are a log analysis expert. Analyze the following error summary for the "${summary.service_name}" service:

Error Count: ${summary.error_count} errors in the last 6 hours
Sample Error Messages (truncated):
${summary.sample_messages}

Provide a JSON response with the following structure:
{
  "severity": "LOW|MEDIUM|HIGH|CRITICAL",
  "summary": "Brief summary of the main issues (1-2 sentences)",
  "patterns": ["pattern1", "pattern2"],
  "recommendations": ["recommendation1", "recommendation2"]
}

Guidelines for severity:
- LOW: Isolated errors, no pattern
- MEDIUM: Recurring errors but service functional
- HIGH: Service degradation likely
- CRITICAL: Service failure imminent or occurring

Keep all fields concise. Limit to 3 patterns and 3 recommendations maximum.`;
}

/**
 * Parse AI analysis response
 */
function parseAnalysisResponse(
    serviceName: string,
    aiResponse: string
): AnalysisResult {
    try {
        // Try to extract JSON from response
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);

            return {
                service_name: serviceName,
                severity: validateSeverity(parsed.severity),
                summary: parsed.summary || 'No summary provided',
                patterns: Array.isArray(parsed.patterns) ? parsed.patterns : [],
                recommendations: Array.isArray(parsed.recommendations)
                    ? parsed.recommendations
                    : [],
                analyzed_at: Date.now(),
            };
        }

        // Fallback if JSON parsing fails
        return {
            service_name: serviceName,
            severity: 'MEDIUM',
            summary: aiResponse.substring(0, 200),
            patterns: [],
            recommendations: [],
            analyzed_at: Date.now(),
        };
    } catch (error) {
        console.error('Failed to parse AI response:', error);
        return {
            service_name: serviceName,
            severity: 'MEDIUM',
            summary: 'Analysis completed but response parsing failed',
            patterns: [],
            recommendations: [],
            analyzed_at: Date.now(),
        };
    }
}

/**
 * Validate and normalize severity level
 */
function validateSeverity(
    severity: string
): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const normalized = severity?.toUpperCase();
    if (['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(normalized)) {
        return normalized as any;
    }
    return 'MEDIUM';
}

/**
 * Store analysis result in database
 */
async function storeAnalysisResult(
    db: D1Database,
    analysis: AnalysisResult
): Promise<void> {
    // Store in analysis_results table
    await db
        .prepare(
            `
        INSERT INTO analysis_results (
            id, service_name, severity, summary,
            patterns_json, recommendations_json, analyzed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `
        )
        .bind(
            crypto.randomUUID(),
            analysis.service_name,
            analysis.severity,
            analysis.summary,
            JSON.stringify(analysis.patterns),
            JSON.stringify(analysis.recommendations),
            analysis.analyzed_at
        )
        .run();

    // Also log as a log entry for visibility
    await db
        .prepare(
            `
        INSERT INTO logs (
            id, service_name, level, message,
            timestamp, metadata_json, source_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `
        )
        .bind(
            crypto.randomUUID(),
            `${analysis.service_name}-analysis`,
            analysis.severity === 'CRITICAL' || analysis.severity === 'HIGH'
                ? 'WARN'
                : 'INFO',
            `Error Analysis: ${analysis.summary}`,
            analysis.analyzed_at,
            JSON.stringify({
                severity: analysis.severity,
                patterns: analysis.patterns,
                recommendations: analysis.recommendations,
            }),
            'agent'
        )
        .run();
}

/**
 * Log analysis summary
 */
async function logAnalysisSummary(env: Env, analysisCount: number): Promise<void> {
    try {
        await env.DB.prepare(
            `
            INSERT INTO logs (
                id, service_name, level, message,
                timestamp, metadata_json, source_type
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `
        )
            .bind(
                crypto.randomUUID(),
                'logsService-analysis',
                'INFO',
                `Analysis job completed: ${analysisCount} services analyzed`,
                Date.now(),
                JSON.stringify({
                    services_analyzed: analysisCount,
                }),
                'agent'
            )
            .run();
    } catch (error) {
        console.error('Failed to log analysis summary:', error);
    }
}

/**
 * Get recent analysis results for a service
 */
export async function getServiceAnalysis(
    db: D1Database,
    serviceName: string,
    limit: number = 10
): Promise<AnalysisResult[]> {
    const results = await db
        .prepare(
            `
        SELECT *
        FROM analysis_results
        WHERE service_name = ?
        ORDER BY analyzed_at DESC
        LIMIT ?
    `
        )
        .bind(serviceName, limit)
        .all<any>();

    return results.results.map((row) => ({
        service_name: row.service_name,
        severity: row.severity,
        summary: row.summary,
        patterns: JSON.parse(row.patterns_json || '[]'),
        recommendations: JSON.parse(row.recommendations_json || '[]'),
        analyzed_at: row.analyzed_at,
    }));
}
