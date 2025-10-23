/**
 * Analysis Workflow for orchestrating log analysis
 * Uses Cloudflare Workflows for step-by-step execution
 */

import { Env } from '../types';
import { AnalysisWorkflowParams, AnalysisWorkflowResult } from '../types-extended';
import { searchLogs } from '../lib/search';

/**
 * Main analysis workflow
 * Steps:
 * 1. Initialize analysis session in Durable Object
 * 2. Fetch logs for the specified time range
 * 3. Analyze logs with AI
 * 4. Store results
 * 5. Complete session
 */
export async function runAnalysisWorkflow(
    params: AnalysisWorkflowParams,
    env: Env,
    ctx: ExecutionContext
): Promise<AnalysisWorkflowResult> {
    try {
        // Step 1: Initialize analysis session
        const doId = env.ANALYSIS_AGENT.idFromName(params.session_id);
        const doStub = env.ANALYSIS_AGENT.get(doId);

        const startResponse = await doStub.fetch('https://do/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
        });

        if (!startResponse.ok) {
            throw new Error('Failed to initialize analysis session');
        }

        // Step 2: Fetch logs
        console.log('Fetching logs for analysis...');
        const logs = await searchLogs(env.DB, {
            service_name: params.service_name,
            start_time: params.start_time,
            end_time: params.end_time,
            limit: 1000, // Limit for performance
        });

        // Update progress
        await doStub.fetch('https://do/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                logs_processed: logs.length,
                current_step: 'counting_by_level',
            }),
        });

        // Count by level
        const error_count = logs.filter((l) => l.level === 'ERROR').length;
        const warning_count = logs.filter((l) => l.level === 'WARN').length;
        const info_count = logs.filter((l) => l.level === 'INFO').length;

        await doStub.fetch('https://do/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error_count,
                warning_count,
                info_count,
                current_step: 'ai_analysis',
            }),
        });

        // Step 3: AI Analysis
        console.log('Running AI analysis...');
        const analysis = await analyzeLogsWithAI(
            env,
            params.service_name,
            logs,
            params.search_term
        );

        // Step 4: Complete session
        await doStub.fetch('https://do/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(analysis),
        });

        return {
            success: true,
            session_id: params.session_id,
            error_count,
            warning_count,
            summary: analysis.summary,
            patterns: analysis.patterns,
            recommendations: analysis.recommendations,
        };
    } catch (error: any) {
        console.error('Analysis workflow error:', error);

        // Mark session as failed
        try {
            const doId = env.ANALYSIS_AGENT.idFromName(params.session_id);
            const doStub = env.ANALYSIS_AGENT.get(doId);

            await doStub.fetch('https://do/fail', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: error.message }),
            });
        } catch (failError) {
            console.error('Failed to mark session as failed:', failError);
        }

        return {
            success: false,
            session_id: params.session_id,
            error_count: 0,
            warning_count: 0,
            error: error.message,
        };
    }
}

/**
 * Analyze logs with AI
 */
async function analyzeLogsWithAI(
    env: Env,
    serviceName: string,
    logs: any[],
    searchTerm?: string
): Promise<{
    summary: string;
    patterns: string[];
    recommendations: string[];
}> {
    if (logs.length === 0) {
        return {
            summary: 'No logs found for the specified time range.',
            patterns: [],
            recommendations: [],
        };
    }

    // Prepare logs for analysis
    const errorLogs = logs.filter((l) => l.level === 'ERROR').slice(0, 50);
    const warningLogs = logs.filter((l) => l.level === 'WARN').slice(0, 30);

    const logSample = [
        ...errorLogs.map((l) => `[ERROR] ${l.message}`),
        ...warningLogs.map((l) => `[WARN] ${l.message}`),
    ].join('\n');

    const prompt = buildAnalysisPrompt(serviceName, logs.length, errorLogs.length, warningLogs.length, logSample, searchTerm);

    // Run AI analysis
    try {
        const response = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
            prompt,
            max_tokens: 500,
        });

        if (!response || !response.response) {
            throw new Error('No AI response');
        }

        return parseAIResponse(response.response);
    } catch (error) {
        console.error('AI analysis error:', error);
        return {
            summary: `Analysis completed for ${logs.length} logs. ${errorLogs.length} errors and ${warningLogs.length} warnings found.`,
            patterns: ['AI analysis unavailable'],
            recommendations: ['Manual review recommended'],
        };
    }
}

/**
 * Build analysis prompt
 */
function buildAnalysisPrompt(
    serviceName: string,
    totalLogs: number,
    errorCount: number,
    warningCount: number,
    logSample: string,
    searchTerm?: string
): string {
    return `Analyze the following logs for the "${serviceName}" service${searchTerm ? ` (filtered by: "${searchTerm}")` : ''}:

Total Logs: ${totalLogs}
Errors: ${errorCount}
Warnings: ${warningCount}

Sample Logs:
${logSample}

Provide a JSON response with this structure:
{
  "summary": "Brief 2-3 sentence summary of findings",
  "patterns": ["pattern1", "pattern2", "pattern3"],
  "recommendations": ["rec1", "rec2", "rec3"]
}

Focus on:
1. Common error patterns
2. Root cause analysis
3. Actionable recommendations

Keep it concise and technical.`;
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
        // Try to extract JSON from response
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
                summary: parsed.summary || 'Analysis completed',
                patterns: Array.isArray(parsed.patterns) ? parsed.patterns : [],
                recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
            };
        }

        // Fallback parsing
        return {
            summary: aiResponse.substring(0, 300),
            patterns: [],
            recommendations: [],
        };
    } catch (error) {
        console.error('Failed to parse AI response:', error);
        return {
            summary: 'Analysis completed but response parsing failed',
            patterns: [],
            recommendations: [],
        };
    }
}
