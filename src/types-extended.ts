/**
 * Extended type definitions for agents, workflows, and frontend
 */

import { LogLevel } from './types';

// Analysis request and response types
export interface AnalysisRequest {
    service_name: string;
    start_time: string; // ISO 8601 format in UTC
    end_time: string;   // ISO 8601 format in UTC
    search_term?: string;
}

export interface AnalysisSession {
    id: string;
    service_name: string;
    start_time: number;
    end_time: number;
    search_term?: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    error_count?: number;
    warning_count?: number;
    info_count?: number;
    summary?: string;
    patterns?: string[];
    recommendations?: string[];
    created_at: number;
    completed_at?: number;
}

// Global analysis types
export interface GlobalAnalysis {
    id: string;
    analysis_period: 'daily' | 'weekly' | 'monthly';
    start_time: number;
    end_time: number;
    total_logs: number;
    total_errors: number;
    total_warnings: number;
    unique_services: number;
    error_rate: number;
    summary: string;
    patterns?: string[];
    anomalies?: Anomaly[];
    recommendations?: string[];
    analyzed_at: number;
}

export interface Anomaly {
    type: 'error_spike' | 'volume_spike' | 'volume_drop' | 'new_error_pattern';
    service_name: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
    detected_at: number;
    value?: number;
    threshold?: number;
}

// Chat types
export interface ChatMessage {
    id: string;
    session_id: string;
    service_name: string;
    role: 'user' | 'assistant';
    message: string;
    context?: {
        log_ids?: string[];
        error_codes?: string[];
        time_range?: {
            start: number;
            end: number;
        };
    };
    created_at: number;
}

export interface ChatRequest {
    session_id: string;
    service_name: string;
    message: string;
    context?: {
        log_ids?: string[];
        time_range?: {
            start: number;
            end: number;
        };
    };
}

export interface ChatResponse {
    message: string;
    suggestions?: string[];
    related_logs?: string[];
}

// Service metrics types
export interface ServiceMetrics {
    id: string;
    service_name: string;
    time_bucket: number;
    bucket_size: 'hour' | 'day' | 'week';
    total_logs: number;
    error_count: number;
    warning_count: number;
    info_count: number;
    debug_count: number;
    unique_error_codes: number;
    error_codes?: Array<{
        code: string;
        count: number;
    }>;
    avg_response_time?: number;
    p95_response_time?: number;
    p99_response_time?: number;
    created_at: number;
}

// Error pattern types
export interface ErrorPattern {
    id: string;
    service_name: string;
    error_signature: string;
    error_message_template: string;
    first_seen: number;
    last_seen: number;
    occurrence_count: number;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    status: 'active' | 'resolved' | 'ignored';
    related_logs?: string[];
    metadata?: Record<string, any>;
}

// Queue message types
export interface AnalysisQueueMessage {
    id: string;
    queue_type: 'on_demand' | 'scheduled' | 'global';
    service_name?: string;
    start_time?: number;
    end_time?: number;
    search_term?: string;
    created_at: number;
}

// Workflow types
export interface AnalysisWorkflowParams {
    session_id: string;
    service_name: string;
    start_time: number;
    end_time: number;
    search_term?: string;
}

export interface AnalysisWorkflowResult {
    success: boolean;
    session_id: string;
    error_count: number;
    warning_count: number;
    summary?: string;
    patterns?: string[];
    recommendations?: string[];
    error?: string;
}

// Dashboard types
export interface DashboardStats {
    period: '24h' | '7d' | '30d' | '1y' | 'custom';
    start_time: number;
    end_time: number;
    total_logs: number;
    total_errors: number;
    total_warnings: number;
    unique_services: number;
    error_rate: number;
    top_services: Array<{
        service_name: string;
        log_count: number;
        error_count: number;
        error_rate: number;
    }>;
    top_errors: Array<{
        error_code?: string;
        message: string;
        count: number;
        services: string[];
    }>;
    trend: {
        logs: Array<{ timestamp: number; count: number }>;
        errors: Array<{ timestamp: number; count: number }>;
        warnings: Array<{ timestamp: number; count: number }>;
    };
    anomalies?: Anomaly[];
    ai_insights?: GlobalAnalysis;
}

// Service detail types
export interface ServiceDetailStats {
    service_name: string;
    time_range: {
        start: number;
        end: number;
    };
    total_logs: number;
    error_count: number;
    warning_count: number;
    info_count: number;
    debug_count: number;
    error_rate: number;
    error_patterns: ErrorPattern[];
    recent_logs: Array<{
        id: string;
        level: LogLevel;
        message: string;
        timestamp: number;
        session_id?: string;
    }>;
    metrics: ServiceMetrics[];
    performance: {
        avg_response_time?: number;
        p50_response_time?: number;
        p95_response_time?: number;
        p99_response_time?: number;
    };
}

// Job tracker types
export interface JobTracker {
    job_name: string;
    last_run_at: number;
    last_run_status: 'success' | 'failed';
    next_run_at?: number;
    run_count: number;
    metadata?: Record<string, any>;
}

// OpenAPI schema types
export interface OpenAPIDateTimeParam {
    type: 'string';
    format: 'date-time';
    description: string;
    example: string;
    pattern?: string;
}
