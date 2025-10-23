/**
 * Core type definitions for the logging service
 */

export interface Env {
    DB: D1Database;
    LOGS_ARCHIVE: R2Bucket;
    AI: Ai;
    LOG_SERVICE_API_KEY: string;
    DEFAULT_TTL_DAYS: string;
    ENABLE_WEBSOCKET: string;
    CLEANUP_BATCH_SIZE: string;
}

export interface LogEntry {
    id?: string;
    service_name: string;
    level: LogLevel;
    message: string;
    timestamp: number;
    metadata?: Record<string, any>;
    source_type?: 'tail' | 'http' | 'agent';
    r2_key?: string;
}

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';

export interface LogSearchParams {
    service_name?: string;
    level?: LogLevel;
    start_time?: number;
    end_time?: number;
    limit?: number;
    offset?: number;
}

export interface ServiceConfig {
    service_name: string;
    ttl_days: number;
    retention_policy: 'standard' | 'extended' | 'minimal';
    alert_on_errors: boolean;
    max_logs_per_day?: number;
    created_at: number;
    updated_at: number;
}

export interface ServiceConfigUpdate {
    ttl_days?: number;
    retention_policy?: 'standard' | 'extended' | 'minimal';
    alert_on_errors?: boolean;
    max_logs_per_day?: number;
}

export interface DefaultConfig {
    default_ttl_days: number;
    default_retention_policy: 'standard' | 'extended' | 'minimal';
    cleanup_batch_size: number;
    enable_agentic_analysis: boolean;
}

// Cloudflare Tail Worker types
export interface TailEvent {
    scriptName: string;
    eventTimestamp: number;
    logs?: TailLog[];
    exceptions?: TailException[];
    outcome: 'ok' | 'exception' | 'exceededCpu' | 'exceededMemory' | 'unknown';
}

export interface TailLog {
    timestamp: number;
    level: 'log' | 'debug' | 'info' | 'warn' | 'error';
    message: string[];
}

export interface TailException {
    timestamp: number;
    name: string;
    message: string;
    stack?: string;
}

export type TraceItem = TailEvent;

// HTTP API types
export interface IngestRequest {
    service_name: string;
    level: string;
    message: string;
    metadata?: Record<string, any>;
    timestamp?: number;
}

export interface BatchIngestRequest {
    logs: IngestRequest[];
}

export interface IngestResponse {
    success: boolean;
    id?: string;
    error?: string;
}

export interface BatchIngestResponse {
    success: boolean;
    ingested: number;
    failed: number;
    errors?: string[];
}

export interface SearchResponse {
    logs: LogEntry[];
    total?: number;
    has_more?: boolean;
}

// Agentic analysis types
export interface AnalysisResult {
    service_name: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    summary: string;
    patterns: string[];
    recommendations: string[];
    analyzed_at: number;
}

export interface ErrorSummary {
    service_name: string;
    error_count: number;
    sample_messages: string;
}

// WebSocket types
export interface WebSocketMessage {
    type: 'subscribe' | 'unsubscribe' | 'log' | 'error' | 'ping' | 'pong';
    service_name?: string;
    data?: any;
}

export interface WebSocketSubscription {
    service_name?: string;
    level?: LogLevel;
}
