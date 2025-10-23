-- Configuration tables for service-specific and default settings

CREATE TABLE IF NOT EXISTS service_configs (
    service_name TEXT PRIMARY KEY,
    ttl_days INTEGER NOT NULL DEFAULT 30,
    retention_policy TEXT DEFAULT 'standard', -- 'standard', 'extended', 'minimal'
    alert_on_errors BOOLEAN DEFAULT FALSE,
    max_logs_per_day INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS default_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Default configuration values
INSERT OR IGNORE INTO default_config (key, value) VALUES
    ('default_ttl_days', '30'),
    ('default_retention_policy', 'standard'),
    ('cleanup_batch_size', '1000'),
    ('enable_agentic_analysis', 'true');

-- Table for storing analysis results
CREATE TABLE IF NOT EXISTS analysis_results (
    id TEXT PRIMARY KEY,
    service_name TEXT NOT NULL,
    severity TEXT NOT NULL,
    summary TEXT NOT NULL,
    patterns_json TEXT,
    recommendations_json TEXT,
    analyzed_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_analysis_service ON analysis_results(service_name);
CREATE INDEX IF NOT EXISTS idx_analysis_time ON analysis_results(analyzed_at);
