-- Initial schema for the logging service
-- This creates the main logs table with indexes for efficient querying

CREATE TABLE IF NOT EXISTS logs (
    id TEXT PRIMARY KEY,
    service_name TEXT NOT NULL,
    level TEXT NOT NULL,
    message TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    r2_key TEXT,
    metadata_json TEXT,
    source_type TEXT DEFAULT 'http' -- 'tail', 'http', or 'agent'
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_logs_service ON logs(service_name);
CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_logs_service_time ON logs(service_name, timestamp);
CREATE INDEX IF NOT EXISTS idx_logs_level_time ON logs(level, timestamp);

-- Composite index for common queries filtering by service and level
CREATE INDEX IF NOT EXISTS idx_logs_service_level_time ON logs(service_name, level, timestamp);
