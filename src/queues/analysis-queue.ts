/**
 * Queue consumer for analysis jobs
 * Processes analysis requests asynchronously
 */

import { Env } from '../types';
import { AnalysisQueueMessage } from '../types-extended';
import { runAnalysisWorkflow } from '../workflows/analysis-workflow';

/**
 * Process a batch of analysis queue messages
 */
export async function handleAnalysisQueue(
    batch: MessageBatch<AnalysisQueueMessage>,
    env: Env,
    ctx: ExecutionContext
): Promise<void> {
    console.log(`Processing ${batch.messages.length} analysis queue messages`);

    for (const message of batch.messages) {
        try {
            await processAnalysisMessage(message.body, env, ctx);
            message.ack();
        } catch (error: any) {
            console.error('Failed to process analysis message:', error);
            message.retry();
        }
    }
}

/**
 * Process a single analysis message
 */
async function processAnalysisMessage(
    message: AnalysisQueueMessage,
    env: Env,
    ctx: ExecutionContext
): Promise<void> {
    console.log('Processing analysis message:', message.id);

    // Update queue status to processing
    await env.DB.prepare(`
        UPDATE analysis_queue
        SET status = 'processing', started_at = ?
        WHERE id = ?
    `)
        .bind(Date.now(), message.id)
        .run();

    try {
        // Run the workflow
        const workflowParams = {
            session_id: message.id,
            service_name: message.service_name!,
            start_time: message.start_time!,
            end_time: message.end_time!,
            search_term: message.search_term,
        };

        const result = await runAnalysisWorkflow(workflowParams, env, ctx);

        if (result.success) {
            // Update queue status to completed
            await env.DB.prepare(`
                UPDATE analysis_queue
                SET status = 'completed', completed_at = ?
                WHERE id = ?
            `)
                .bind(Date.now(), message.id)
                .run();

            console.log(`Analysis ${message.id} completed successfully`);
        } else {
            throw new Error(result.error || 'Analysis failed');
        }
    } catch (error: any) {
        console.error(`Analysis ${message.id} failed:`, error);

        // Update queue status to failed
        await env.DB.prepare(`
            UPDATE analysis_queue
            SET status = 'failed',
                error_message = ?,
                completed_at = ?,
                retry_count = retry_count + 1
            WHERE id = ?
        `)
            .bind(error.message, Date.now(), message.id)
            .run();

        throw error;
    }
}
