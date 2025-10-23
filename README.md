# Cloudflare Logging Service

A comprehensive logging service for Cloudflare Workers that combines Tail Worker capabilities with a full-featured logging API, supporting both Workers and external services (like Python apps, Node.js apps, etc.).

## Features

✅ **Dual Ingestion**: Tail handler for Workers + HTTP API for external services
✅ **Hybrid Storage**: D1 for fast queries + R2 for long-term archive
✅ **Configurable TTL**: Per-service and default cleanup policies
✅ **Cron Automation**: Automated cleanup and agentic analysis
✅ **Real-time Streaming**: WebSocket support for live log viewing (basic implementation)
✅ **Agentic Capabilities**: AI-powered log summarization and anomaly detection
✅ **Batch Processing**: Efficient bulk log ingestion
✅ **Flexible Configuration**: Runtime-configurable retention policies

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    LOGGING SERVICE WORKER                    │
│                                                              │
│  ┌────────────────┐  ┌──────────────────┐  ┌─────────────┐ │
│  │  Tail Handler  │  │  HTTP API        │  │  WebSocket  │ │
│  │  (Workers)     │  │  (External Apps) │  │  (Realtime) │ │
│  └────────┬───────┘  └────────┬─────────┘  └──────┬──────┘ │
│           │                   │                     │        │
│           └───────────────────┴─────────────────────┘        │
│                              │                               │
│                    ┌─────────▼──────────┐                    │
│                    │  Ingestion Logic   │                    │
│                    │  + Validation      │                    │
│                    └─────────┬──────────┘                    │
│                              │                               │
│           ┌──────────────────┴───────────────────┐           │
│           │                                      │           │
│    ┌──────▼──────┐                      ┌───────▼────────┐  │
│    │ D1 Database │                      │   R2 Archive   │  │
│    │ - Metadata  │                      │ - Full Logs    │  │
│    │ - Config    │                      │ - Compressed   │  │
│    └─────────────┘                      └────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Cron Jobs: Cleanup + Agentic Analysis              │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Cloudflare account with Workers, D1, and R2 access
- Wrangler CLI (`npm install -g wrangler`)

### Installation

1. **Clone and install dependencies:**
```bash
npm install
```

2. **Create D1 database:**
```bash
wrangler d1 create platform-logs-db
```

Copy the database ID and update `wrangler.toml`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "platform-logs-db"
database_id = "YOUR_DATABASE_ID_HERE"
```

3. **Create R2 bucket:**
```bash
wrangler r2 bucket create platform-logs-archive
```

4. **Run migrations:**
```bash
wrangler d1 migrations apply platform-logs-db
```

5. **Set API key:**
```bash
wrangler secret put LOG_SERVICE_API_KEY
# Enter a secure API key when prompted
```

6. **Deploy:**
```bash
npm run deploy
```

### Development

```bash
npm run dev
```

## Usage

### 1. Tail Worker (Automatic Log Collection from Workers)

Attach the logging service as a tail consumer to any Worker:

**In your producer worker's `wrangler.toml`:**
```toml
name = "my-api-worker"
main = "src/index.ts"

# Attach the tail worker
tail_consumers = [{service = "logsService"}]
```

All `console.log()`, `console.error()`, etc. from your worker will automatically flow to the logging service.

### 2. HTTP API (External Services)

#### Ingest Single Log

```bash
curl -X POST https://logs.example.workers.dev/api/v1/logs/ingest \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "service_name": "python-data-processor",
    "level": "ERROR",
    "message": "Database connection failed",
    "metadata": {
      "error_code": "DB_TIMEOUT",
      "retry_count": 3
    }
  }'
```

#### Batch Ingest

```bash
curl -X POST https://logs.example.workers.dev/api/v1/logs/ingest/batch \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "logs": [
      {
        "service_name": "api-gateway",
        "level": "INFO",
        "message": "Request processed successfully"
      },
      {
        "service_name": "api-gateway",
        "level": "ERROR",
        "message": "Validation failed"
      }
    ]
  }'
```

#### Search Logs

```bash
curl -X GET "https://logs.example.workers.dev/api/v1/logs/search?service=my-service&level=ERROR&limit=50" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

#### Get Service Statistics

```bash
curl -X GET "https://logs.example.workers.dev/api/v1/logs/stats/my-service" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### 3. Python Integration Example

```python
import requests
from datetime import datetime

class CloudflareLogger:
    def __init__(self, service_name, api_url, api_key):
        self.service_name = service_name
        self.api_url = api_url
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        })

    def log(self, level, message, **metadata):
        payload = {
            'service_name': self.service_name,
            'level': level.upper(),
            'message': message,
            'metadata': metadata
        }

        try:
            response = self.session.post(
                f'{self.api_url}/api/v1/logs/ingest',
                json=payload,
                timeout=5
            )
            response.raise_for_status()
        except Exception as e:
            print(f"[LOG ERROR] {e}: {message}")

    def info(self, message, **metadata):
        self.log('INFO', message, **metadata)

    def error(self, message, **metadata):
        self.log('ERROR', message, **metadata)

# Usage
logger = CloudflareLogger(
    service_name='python-data-processor',
    api_url='https://logs.example.workers.dev',
    api_key='your-api-key'
)

logger.info('Processing started', job_id='123', batch_size=1000)
logger.error('Database error', error_code='TIMEOUT', retry=3)
```

### 4. Service Configuration

Set custom retention policies per service:

```bash
curl -X PUT https://logs.example.workers.dev/api/v1/logs/config/my-service \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "ttl_days": 90,
    "retention_policy": "extended",
    "alert_on_errors": true,
    "max_logs_per_day": 1000000
  }'
```

## API Reference

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/api/v1/logs/ingest` | Ingest single log |
| POST | `/api/v1/logs/ingest/batch` | Ingest multiple logs |
| GET | `/api/v1/logs/search` | Search logs |
| GET | `/api/v1/logs/logs/:id` | Get log by ID |
| GET | `/api/v1/logs/logs/:id/full` | Get full log from R2 |
| GET | `/api/v1/logs/services` | List all services |
| GET | `/api/v1/logs/stats/:service` | Get service statistics |
| GET | `/api/v1/logs/recent/:service` | Get recent logs |
| GET | `/api/v1/logs/config/:service` | Get service config |
| PUT | `/api/v1/logs/config/:service` | Update service config |
| GET | `/api/v1/logs/configs` | List all configs |

### Log Levels

- `DEBUG`
- `INFO`
- `WARN` (or `WARNING`)
- `ERROR`
- `CRITICAL` (or `FATAL`)

### Query Parameters

**Search:**
- `service`: Filter by service name
- `level`: Filter by log level
- `start_time`: Start timestamp (Unix milliseconds)
- `end_time`: End timestamp (Unix milliseconds)
- `limit`: Number of results (max 1000)
- `offset`: Pagination offset

## Automated Maintenance

### Cleanup Cron

**Schedule**: Daily at 2 AM UTC

Automatically deletes logs older than their configured TTL:
- Service-specific TTL (from `service_configs`)
- Default TTL: 30 days

### Analysis Cron

**Schedule**: Every 6 hours

Runs AI-powered analysis on services with 10+ errors:
- Identifies error patterns
- Determines severity
- Provides recommendations

See [AGENTS.md](./AGENTS.md) for detailed documentation on AI agents.

## Database Schema

### logs

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key (UUID) |
| service_name | TEXT | Service identifier |
| level | TEXT | Log level |
| message | TEXT | Log message (truncated to 1000 chars) |
| timestamp | INTEGER | Unix timestamp (milliseconds) |
| r2_key | TEXT | R2 object key for full log |
| metadata_json | TEXT | JSON metadata |
| source_type | TEXT | 'tail', 'http', or 'agent' |

### service_configs

| Column | Type | Description |
|--------|------|-------------|
| service_name | TEXT | Primary key |
| ttl_days | INTEGER | Retention period in days |
| retention_policy | TEXT | 'standard', 'extended', 'minimal' |
| alert_on_errors | BOOLEAN | Enable error alerting |
| max_logs_per_day | INTEGER | Daily log limit |
| created_at | INTEGER | Creation timestamp |
| updated_at | INTEGER | Update timestamp |

### analysis_results

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key (UUID) |
| service_name | TEXT | Service analyzed |
| severity | TEXT | 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL' |
| summary | TEXT | Analysis summary |
| patterns_json | TEXT | Identified patterns (JSON) |
| recommendations_json | TEXT | Recommendations (JSON) |
| analyzed_at | INTEGER | Analysis timestamp |

## Storage Strategy

### D1 Database
- **Purpose**: Fast queries, metadata
- **Contains**: Truncated messages, timestamps, service info
- **Indexed**: By service, level, timestamp

### R2 Bucket
- **Purpose**: Long-term archive, full logs
- **Contains**: Complete log entries (compressed)
- **Format**: `logs/{service}/{date}/{id}.json.gz`

## Configuration

### Environment Variables

Set in `wrangler.toml`:
```toml
[vars]
DEFAULT_TTL_DAYS = "30"
ENABLE_WEBSOCKET = "true"
CLEANUP_BATCH_SIZE = "1000"
```

### Secrets

Set with `wrangler secret put`:
- `LOG_SERVICE_API_KEY`: API authentication key

### AI Binding

```toml
[ai]
binding = "AI"
```

## Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage
```

## Monitoring

### Health Check

```bash
curl https://logs.example.workers.dev/health
```

Response:
```json
{
  "status": "healthy",
  "service": "logsService",
  "db": "connected",
  "timestamp": 1234567890000,
  "version": "2.0.0"
}
```

### Service Logs

The logging service logs its own activity with `source_type = 'agent'`:

```sql
SELECT * FROM logs
WHERE service_name LIKE 'logsService%'
ORDER BY timestamp DESC;
```

## Performance Considerations

### Rate Limits

- Standard API: 100 requests/minute per IP
- Batch ingestion: 20 requests/minute per IP
- Configurable per environment

### Batch Size Limits

- Maximum 1000 logs per batch request
- Cleanup processes 1000 logs per iteration

### Storage Costs

- **D1**: ~$0.75/million writes, $0.001/million reads
- **R2**: $0.015/GB/month storage
- **AI**: Varies by model and usage

## Troubleshooting

### Logs Not Appearing

1. Check API key authentication
2. Verify service name format (alphanumeric, dashes, underscores only)
3. Check D1 database connection
4. Review Worker logs in Cloudflare dashboard

### Tail Worker Not Receiving Logs

1. Verify `tail_consumers` in producer worker's `wrangler.toml`
2. Redeploy producer worker after configuration change
3. Check that producer worker is logging to console

### Cleanup Not Running

1. Check cron trigger configuration in `wrangler.toml`
2. Review scheduled trigger logs in Cloudflare dashboard
3. Verify TTL configuration in database

## Security

### API Authentication

- Uses Bearer token authentication
- Constant-time comparison to prevent timing attacks
- API key stored as Worker secret

### Best Practices

1. Rotate API keys regularly
2. Use different API keys per environment
3. Limit CORS origins in production
4. Review access logs periodically

## Roadmap

### Planned Features

- [ ] Advanced WebSocket implementation with Durable Objects
- [ ] Natural language query API
- [ ] Grafana/Prometheus integration
- [ ] Email/Slack alerting
- [ ] Log sampling for high-volume services
- [ ] Multi-region R2 support
- [ ] Enhanced anomaly detection with ML
- [ ] Log replay for debugging

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

MIT License - see [LICENSE](./LICENSE) file for details

## Support

For issues or questions:
- Check the [AGENTS.md](./AGENTS.md) documentation for AI features
- Review error logs in Cloudflare dashboard
- Open an issue on GitHub

## Resources

- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [D1 Database](https://developers.cloudflare.com/d1/)
- [R2 Storage](https://developers.cloudflare.com/r2/)
- [Workers AI](https://developers.cloudflare.com/workers-ai/)
- [Tail Workers](https://developers.cloudflare.com/workers/observability/tail-workers/)
