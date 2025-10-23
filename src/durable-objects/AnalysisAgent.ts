/**
 * Durable Object for managing AI analysis sessions
 * Handles state management and coordination for log analysis
 */

import { Env } from '../types';
import { AnalysisSession, AnalysisWorkflowParams } from '../types-extended';

interface AnalysisState {
    session: AnalysisSession;
    logs_processed: number;
    current_step: string;
    started_at?: number;
}

export class AnalysisAgent implements DurableObject {
    private state: DurableObjectState;
    private env: Env;
    private currentState?: AnalysisState;

    constructor(state: DurableObjectState, env: Env) {
        this.state = state;
        this.env = env;
    }

    /**
     * Handle HTTP requests to the Durable Object
     */
    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);
        const path = url.pathname;

        try {
            switch (path) {
                case '/start':
                    return await this.handleStart(request);
                case '/status':
                    return await this.handleStatus();
                case '/update':
                    return await this.handleUpdate(request);
                case '/complete':
                    return await this.handleComplete(request);
                case '/fail':
                    return await this.handleFail(request);
                default:
                    return new Response('Not found', { status: 404 });
            }
        } catch (error: any) {
            return new Response(
                JSON.stringify({ error: error.message }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }
    }

    /**
     * Start a new analysis session
     */
    private async handleStart(request: Request): Promise<Response> {
        const params: AnalysisWorkflowParams = await request.json();

        // Create initial session
        const session: AnalysisSession = {
            id: params.session_id,
            service_name: params.service_name,
            start_time: params.start_time,
            end_time: params.end_time,
            search_term: params.search_term,
            status: 'running',
            created_at: Date.now(),
        };

        // Store in durable object state
        this.currentState = {
            session,
            logs_processed: 0,
            current_step: 'initializing',
            started_at: Date.now(),
        };

        await this.state.storage.put('analysis_state', this.currentState);

        // Also store in D1 for persistence
        await this.env.DB.prepare(`
            INSERT INTO analysis_sessions (
                id, service_name, start_time, end_time, search_term,
                status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
            .bind(
                session.id,
                session.service_name,
                session.start_time,
                session.end_time,
                session.search_term || null,
                session.status,
                session.created_at
            )
            .run();

        return new Response(
            JSON.stringify({ success: true, session }),
            { headers: { 'Content-Type': 'application/json' } }
        );
    }

    /**
     * Get current analysis status
     */
    private async handleStatus(): Promise<Response> {
        const state = await this.state.storage.get<AnalysisState>('analysis_state');

        if (!state) {
            return new Response(
                JSON.stringify({ error: 'No active analysis' }),
                { status: 404, headers: { 'Content-Type': 'application/json' } }
            );
        }

        return new Response(
            JSON.stringify({
                session: state.session,
                logs_processed: state.logs_processed,
                current_step: state.current_step,
                running_duration: Date.now() - (state.started_at || Date.now()),
            }),
            { headers: { 'Content-Type': 'application/json' } }
        );
    }

    /**
     * Update analysis progress
     */
    private async handleUpdate(request: Request): Promise<Response> {
        const update = await request.json();
        const state = await this.state.storage.get<AnalysisState>('analysis_state');

        if (!state) {
            return new Response(
                JSON.stringify({ error: 'No active analysis' }),
                { status: 404, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Update state
        if (update.logs_processed !== undefined) {
            state.logs_processed = update.logs_processed;
        }
        if (update.current_step) {
            state.current_step = update.current_step;
        }
        if (update.error_count !== undefined) {
            state.session.error_count = update.error_count;
        }
        if (update.warning_count !== undefined) {
            state.session.warning_count = update.warning_count;
        }
        if (update.info_count !== undefined) {
            state.session.info_count = update.info_count;
        }

        await this.state.storage.put('analysis_state', state);

        return new Response(
            JSON.stringify({ success: true }),
            { headers: { 'Content-Type': 'application/json' } }
        );
    }

    /**
     * Complete the analysis
     */
    private async handleComplete(request: Request): Promise<Response> {
        const result = await request.json();
        const state = await this.state.storage.get<AnalysisState>('analysis_state');

        if (!state) {
            return new Response(
                JSON.stringify({ error: 'No active analysis' }),
                { status: 404, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Update session
        state.session.status = 'completed';
        state.session.completed_at = Date.now();
        state.session.summary = result.summary;
        state.session.patterns = result.patterns;
        state.session.recommendations = result.recommendations;

        // Update in D1
        await this.env.DB.prepare(`
            UPDATE analysis_sessions
            SET status = ?,
                error_count = ?,
                warning_count = ?,
                info_count = ?,
                summary = ?,
                patterns_json = ?,
                recommendations_json = ?,
                completed_at = ?
            WHERE id = ?
        `)
            .bind(
                state.session.status,
                state.session.error_count || 0,
                state.session.warning_count || 0,
                state.session.info_count || 0,
                state.session.summary || null,
                JSON.stringify(state.session.patterns || []),
                JSON.stringify(state.session.recommendations || []),
                state.session.completed_at,
                state.session.id
            )
            .run();

        await this.state.storage.put('analysis_state', state);

        return new Response(
            JSON.stringify({ success: true, session: state.session }),
            { headers: { 'Content-Type': 'application/json' } }
        );
    }

    /**
     * Mark analysis as failed
     */
    private async handleFail(request: Request): Promise<Response> {
        const { error } = await request.json();
        const state = await this.state.storage.get<AnalysisState>('analysis_state');

        if (!state) {
            return new Response(
                JSON.stringify({ error: 'No active analysis' }),
                { status: 404, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Update session
        state.session.status = 'failed';
        state.session.completed_at = Date.now();

        // Update in D1
        await this.env.DB.prepare(`
            UPDATE analysis_sessions
            SET status = ?, completed_at = ?
            WHERE id = ?
        `)
            .bind(state.session.status, state.session.completed_at, state.session.id)
            .run();

        await this.state.storage.put('analysis_state', state);

        // Log error
        console.error(`Analysis ${state.session.id} failed:`, error);

        return new Response(
            JSON.stringify({ success: true, session: state.session }),
            { headers: { 'Content-Type': 'application/json' } }
        );
    }
}
