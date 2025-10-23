-- Additional tables for AI agents and frontend features

-- Global trend analysis table
CREATE TABLE IF NOT EXISTS global_analysis (
    id TEXT PRIMARY KEY,
    analysis_period TEXT NOT NULL, -- 'daily', 'weekly', 'monthly'
    start_time INTEGER NOT NULL,
    end_time INTEGER NOT NULL,
    total_logs INTEGER NOT NULL,
    total_errors INTEGER NOT NULL,
    total_warnings INTEGER NOT NULL,
    unique_services INTEGER NOT NULL,
    error_rate REAL NOT NULL,
    summary TEXT NOT NULL,
    patterns_json TEXT,
    anomalies_json TEXT,
    recommendations_json TEXT,
    analyzed_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_global_analysis_period ON global_analysis(analysis_period, analyzed_at);
CREATE INDEX IF NOT EXISTS idx_global_analysis_time ON global_analysis(start_time, end_time);

-- Service-specific analysis sessions table
CREATE TABLE IF NOT EXISTS analysis_sessions (
    id TEXT PRIMARY KEY,
    service_name TEXT NOT NULL,
    start_time INTEGER NOT NULL,
    end_time INTEGER NOT NULL,
    search_term TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
    error_count INTEGER,
    warning_count INTEGER,
    info_count INTEGER,
    summary TEXT,
    patterns_json TEXT,
    recommendations_json TEXT,
    created_at INTEGER NOT NULL,
    completed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_analysis_sessions_service ON analysis_sessions(service_name);
CREATE INDEX IF NOT EXISTS idx_analysis_sessions_status ON analysis_sessions(status);
CREATE INDEX IF NOT EXISTS idx_analysis_sessions_created ON analysis_sessions(created_at);

-- Chat history for AI assistant
CREATE TABLE IF NOT EXISTS chat_history (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    service_name TEXT NOT NULL,
    role TEXT NOT NULL, -- 'user' or 'assistant'
    message TEXT NOT NULL,
    context_json TEXT, -- Additional context like log IDs, error codes
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_history_session ON chat_history(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_history_service ON chat_history(service_name);

-- Service performance metrics (aggregated)
CREATE TABLE IF NOT EXISTS service_metrics (
    id TEXT PRIMARY KEY,
    service_name TEXT NOT NULL,
    time_bucket INTEGER NOT NULL, -- Unix timestamp rounded to hour
    bucket_size TEXT NOT NULL, -- 'hour', 'day', 'week'
    total_logs INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    warning_count INTEGER NOT NULL DEFAULT 0,
    info_count INTEGER NOT NULL DEFAULT 0,
    debug_count INTEGER NOT NULL DEFAULT 0,
    unique_error_codes INTEGER NOT NULL DEFAULT 0,
    error_codes_json TEXT, -- JSON array of error codes with counts
    avg_response_time REAL,
    p95_response_time REAL,
    p99_response_time REAL,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_service_metrics_service ON service_metrics(service_name, time_bucket);
CREATE INDEX IF NOT EXISTS idx_service_metrics_bucket ON service_metrics(bucket_size, time_bucket);

-- Error pattern tracking
CREATE TABLE IF NOT EXISTS error_patterns (
    id TEXT PRIMARY KEY,
    service_name TEXT NOT NULL,
    error_signature TEXT NOT NULL, -- Hash or pattern identifier
    error_message_template TEXT NOT NULL,
    first_seen INTEGER NOT NULL,
    last_seen INTEGER NOT NULL,
    occurrence_count INTEGER NOT NULL DEFAULT 1,
    severity TEXT NOT NULL, -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'resolved', 'ignored'
    related_logs_json TEXT, -- Sample log IDs
    metadata_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_error_patterns_service ON error_patterns(service_name);
CREATE INDEX IF NOT EXISTS idx_error_patterns_signature ON error_patterns(error_signature);
CREATE INDEX IF NOT EXISTS idx_error_patterns_severity ON error_patterns(severity);
CREATE INDEX IF NOT EXISTS idx_error_patterns_status ON error_patterns(status);

-- Analysis queue tracking (for monitoring workflow status)
CREATE TABLE IF NOT EXISTS analysis_queue (
    id TEXT PRIMARY KEY,
    queue_type TEXT NOT NULL, -- 'on_demand', 'scheduled', 'global'
    service_name TEXT,
    start_time INTEGER,
    end_time INTEGER,
    search_term TEXT,
    status TEXT NOT NULL DEFAULT 'queued', -- 'queued', 'processing', 'completed', 'failed'
    workflow_id TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at INTEGER NOT NULL,
    started_at INTEGER,
    completed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_analysis_queue_status ON analysis_queue(status);
CREATE INDEX IF NOT EXISTS idx_analysis_queue_type ON analysis_queue(queue_type);
CREATE INDEX IF NOT EXISTS idx_analysis_queue_workflow ON analysis_queue(workflow_id);

-- Last run tracker for scheduled jobs
CREATE TABLE IF NOT EXISTS job_tracker (
    job_name TEXT PRIMARY KEY,
    last_run_at INTEGER NOT NULL,
    last_run_status TEXT NOT NULL, -- 'success', 'failed'
    next_run_at INTEGER,
    run_count INTEGER NOT NULL DEFAULT 0,
    metadata_json TEXT
);
