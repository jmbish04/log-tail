/**
 * Prompt templates for AI agents
 */

import { ErrorSummary } from '../types';

/**
 * Build prompt for error analysis
 */
export function buildErrorAnalysisPrompt(summary: ErrorSummary): string {
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
 * Build prompt for log summarization
 */
export function buildLogSummarizationPrompt(
    serviceName: string,
    logs: Array<{ level: string; message: string; timestamp: number }>
): string {
    const logSample = logs
        .slice(0, 50)
        .map((log) => `[${log.level}] ${log.message}`)
        .join('\n');

    return `Summarize the following logs for the "${serviceName}" service.

Logs (showing up to 50 most recent):
${logSample}

Provide a brief summary (2-3 sentences) of:
1. Overall activity and patterns
2. Any notable errors or warnings
3. Recommendations if needed

Keep the response concise and actionable.`;
}

/**
 * Build prompt for anomaly detection
 */
export function buildAnomalyDetectionPrompt(
    serviceName: string,
    currentStats: {
        error_rate: number;
        total_logs: number;
    },
    historicalStats: {
        avg_error_rate: number;
        avg_total_logs: number;
    }
): string {
    return `Analyze the following metrics for the "${serviceName}" service to detect anomalies:

Current (last hour):
- Error rate: ${currentStats.error_rate.toFixed(2)}%
- Total logs: ${currentStats.total_logs}

Historical average (last 24 hours):
- Average error rate: ${historicalStats.avg_error_rate.toFixed(2)}%
- Average total logs: ${historicalStats.avg_total_logs}

Determine if there's an anomaly and provide:
1. Is there an anomaly? (yes/no)
2. Severity (low/medium/high)
3. Description of the anomaly
4. Recommended action

Keep the response brief and actionable.`;
}

/**
 * Build prompt for pattern detection
 */
export function buildPatternDetectionPrompt(
    serviceName: string,
    errorMessages: string[]
): string {
    const messageSample = errorMessages.slice(0, 30).join('\n');

    return `Analyze the following error messages from the "${serviceName}" service to identify patterns:

Error Messages:
${messageSample}

Identify:
1. Common error patterns or recurring issues
2. Potential root causes
3. Priority (low/medium/high)

Provide a JSON response:
{
  "patterns": ["pattern1", "pattern2"],
  "root_causes": ["cause1", "cause2"],
  "priority": "low|medium|high"
}`;
}

/**
 * Build prompt for recommendation generation
 */
export function buildRecommendationPrompt(
    serviceName: string,
    errorPattern: string,
    frequency: number
): string {
    return `Generate actionable recommendations for the "${serviceName}" service.

Error Pattern: ${errorPattern}
Frequency: ${frequency} occurrences in the last 6 hours

Provide 2-3 specific, actionable recommendations to:
1. Prevent this error from recurring
2. Improve error handling
3. Enhance monitoring or alerting

Keep each recommendation to 1-2 sentences.`;
}
