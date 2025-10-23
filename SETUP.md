# Setup Guide

Step-by-step guide to deploy the Cloudflare Logging Service.

## Prerequisites

- Cloudflare account (free tier works for testing)
- Node.js 18+ and npm installed
- Wrangler CLI installed: `npm install -g wrangler`
- Authenticated with Wrangler: `wrangler login`

## Step 1: Install Dependencies

```bash
cd logsService
npm install
```

## Step 2: Create D1 Database

```bash
wrangler d1 create platform-logs-db
```

You'll see output like:
```
✅ Successfully created DB 'platform-logs-db'!

[[d1_databases]]
binding = "DB"
database_name = "platform-logs-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

Copy the `database_id` value.

## Step 3: Update wrangler.toml

Open `wrangler.toml` and replace `YOUR_D1_DATABASE_ID` with your actual database ID:

```toml
[[d1_databases]]
binding = "DB"
database_name = "platform-logs-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # Your actual ID
```

## Step 4: Create R2 Bucket

```bash
wrangler r2 bucket create platform-logs-archive
```

The bucket name is already configured in `wrangler.toml`, so no changes needed unless you want a different name.

## Step 5: Run Database Migrations

```bash
# Apply migrations to remote database
wrangler d1 migrations apply platform-logs-db

# Or for local development
wrangler d1 migrations apply platform-logs-db --local
```

You should see:
```
✅ Migrations applied successfully!
```

## Step 6: Set API Key Secret

Generate a secure API key (or use an existing one) and set it as a secret:

```bash
wrangler secret put LOG_SERVICE_API_KEY
```

When prompted, enter your API key. This will be used for HTTP API authentication.

**Generate a secure key (example):**
```bash
# On macOS/Linux
openssl rand -base64 32

# On Windows (PowerShell)
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

## Step 7: Deploy to Cloudflare

```bash
npm run deploy
```

Or using Wrangler directly:
```bash
wrangler deploy
```

You'll see output like:
```
✨ Compiled Worker successfully
🌍 Uploading...
✨ Success! Deployed to https://logsservice.your-subdomain.workers.dev
```

## Step 8: Verify Deployment

Test the health endpoint:

```bash
curl https://logsservice.your-subdomain.workers.dev/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "logsService",
  "db": "connected",
  "timestamp": 1234567890000,
  "version": "1.0.0"
}
```

## Step 9: Test Log Ingestion

Ingest a test log:

```bash
curl -X POST https://logsservice.your-subdomain.workers.dev/api/v1/logs/ingest \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "service_name": "test-service",
    "level": "INFO",
    "message": "Test log entry"
  }'
```

Expected response:
```json
{
  "success": true,
  "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

## Step 10: Search Logs

Verify the log was stored:

```bash
curl -X GET "https://logsservice.your-subdomain.workers.dev/api/v1/logs/search?service=test-service&limit=10" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

You should see your test log in the results.

## Step 11: Attach to a Worker (Optional)

To collect logs from another Worker automatically:

1. Open the target worker's `wrangler.toml`
2. Add the tail consumer:

```toml
name = "my-api-worker"
main = "src/index.ts"

# Add this line
tail_consumers = [{service = "logsService"}]
```

3. Deploy the worker:
```bash
wrangler deploy
```

Now all console logs from `my-api-worker` will flow to the logging service!

## Local Development

### Run locally with local D1 and R2

```bash
npm run dev
```

This starts a local development server at `http://localhost:8787`.

### Apply migrations locally

```bash
wrangler d1 migrations apply platform-logs-db --local
```

### Test locally

```bash
curl -X POST http://localhost:8787/api/v1/logs/ingest \
  -H "Authorization: Bearer test-key" \
  -H "Content-Type: application/json" \
  -d '{
    "service_name": "local-test",
    "level": "INFO",
    "message": "Local test message"
  }'
```

Note: For local development, set the API key in `.dev.vars`:

```
LOG_SERVICE_API_KEY=test-key
```

## Configuration Options

### Adjust TTL (Time To Live)

Default is 30 days. To change globally:

```sql
wrangler d1 execute platform-logs-db --command \
  "UPDATE default_config SET value = '90' WHERE key = 'default_ttl_days'"
```

Or per-service via API:
```bash
curl -X PUT https://logsservice.your-subdomain.workers.dev/api/v1/logs/config/my-service \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"ttl_days": 90}'
```

### Disable Agentic Analysis

If you don't want AI analysis:

```sql
wrangler d1 execute platform-logs-db --command \
  "UPDATE default_config SET value = 'false' WHERE key = 'enable_agentic_analysis'"
```

### Custom Cleanup Schedule

Edit `wrangler.toml`:

```toml
[triggers]
crons = [
    "0 3 * * *",   # Daily cleanup at 3 AM instead of 2 AM
    "0 */6 * * *"  # Analysis every 6 hours (unchanged)
]
```

Then redeploy:
```bash
npm run deploy
```

## Monitoring

### View Logs

In Cloudflare Dashboard:
1. Go to Workers & Pages
2. Select `logsService`
3. Click "Logs" tab
4. View real-time logs

### Check Cron Executions

In Cloudflare Dashboard:
1. Go to Workers & Pages
2. Select `logsService`
3. Click "Triggers" tab
4. View scheduled trigger history

### Query Database Directly

```bash
# List all logs
wrangler d1 execute platform-logs-db --command \
  "SELECT * FROM logs ORDER BY timestamp DESC LIMIT 10"

# Check service configs
wrangler d1 execute platform-logs-db --command \
  "SELECT * FROM service_configs"

# View analysis results
wrangler d1 execute platform-logs-db --command \
  "SELECT * FROM analysis_results ORDER BY analyzed_at DESC LIMIT 5"
```

## Troubleshooting

### Migration Errors

If migrations fail, check that the database ID is correct in `wrangler.toml`.

### API Key Issues

Reset the secret:
```bash
wrangler secret put LOG_SERVICE_API_KEY
```

### Can't Connect to D1/R2

Verify bindings in `wrangler.toml` match your actual resources.

### Tail Consumer Not Working

1. Ensure both workers are deployed
2. Check the producer worker's `wrangler.toml` has correct `tail_consumers`
3. Redeploy the producer worker after adding tail consumer

## Next Steps

- Read [README.md](./README.md) for usage examples
- Read [AGENTS.md](./AGENTS.md) for AI features documentation
- Set up monitoring and alerting
- Configure service-specific retention policies
- Integrate with your applications

## Support

For issues:
- Check Cloudflare Workers logs
- Review database queries
- Verify API authentication
- Check cron job execution logs
