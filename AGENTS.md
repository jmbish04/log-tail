# Logging Service Agents

This document describes the AI-powered agents integrated into the logging service for automated analysis, anomaly detection, and insights generation.

## Overview

The logging service includes several AI agents that run automatically to provide intelligent insights:

1. **Log Analysis Agent** - Analyzes error patterns and provides recommendations
2. **Log Summarization Agent** - Generates human-readable summaries of log activity
3. **Anomaly Detection Agent** - Detects unusual patterns in log volume and error rates

## Log Analysis Agent

**Trigger**: Every 6 hours via cron (configurable)
**Model**: `@cf/meta/llama-3-8b-instruct`

### Purpose

Analyzes error patterns across all services and identifies:
- Common error patterns
- Potential root causes
- Severity of issues
- Actionable recommendations

### How It Works

1. Queries logs for ERROR-level entries in the last 6 hours
2. Groups errors by service
3. For services with 10+ errors, generates an AI-powered analysis
4. Stores results in `analysis_results` table
5. Creates log entries for visibility

### Analysis Output

```json
{
  "service_name": "my-api-service",
  "severity": "HIGH",
  "summary": "Database connection timeouts occurring frequently",
  "patterns": [
    "Connection pool exhaustion",
    "Slow query performance",
    "Network latency spikes"
  ],
  "recommendations": [
    "Increase database connection pool size",
    "Add query performance monitoring",
    "Implement connection retry logic with backoff"
  ],
  "analyzed_at": 1234567890000
}
```

### Severity Levels

- **LOW**: Isolated errors with no clear pattern
- **MEDIUM**: Recurring errors but service remains functional
- **HIGH**: Service degradation likely occurring
- **CRITICAL**: Service failure imminent or in progress

### Configuration

Control analysis behavior via the `default_config` table:

```sql
UPDATE default_config
SET value = 'false'
WHERE key = 'enable_agentic_analysis';
```

### Accessing Analysis Results

**Via Database:**
```sql
SELECT * FROM analysis_results
WHERE service_name = 'my-service'
ORDER BY analyzed_at DESC
LIMIT 10;
```

**Via API (future enhancement):**
```bash
curl -H "Authorization: Bearer $API_KEY" \
  https://logs.example.workers.dev/api/v1/logs/analysis/my-service
```

## Log Summarization Agent

**Usage**: On-demand via API (future feature) or manual invocation
**Model**: `@cf/meta/llama-3-8b-instruct`

### Purpose

Generates concise, human-readable summaries of log activity for a service over a specified time period.

### Example Output

```
Service "payment-processor" Summary (Last 24 hours):

The service processed 12,450 payment requests with a 99.2% success rate.
Notable activity includes 3 database timeout errors during the 14:00-15:00
UTC window, likely due to increased load. One critical error related to
payment gateway connectivity was logged at 16:45 UTC and resolved within
10 minutes. Recommend monitoring database performance during peak hours
and implementing circuit breaker pattern for external gateway calls.
```

### Daily Summary Generation

```typescript
import { generateDailySummary } from './src/agents/summarizer';

const summary = await generateDailySummary(env, 'my-service');
console.log(summary.summary);
console.log('Stats:', summary.stats);
```

### Use Cases

- Daily/weekly status reports
- Incident investigation
- Service health overviews
- Executive summaries for non-technical stakeholders

## Anomaly Detection Agent

**Usage**: On-demand or via scheduled checks
**Model**: `@cf/meta/llama-3-8b-instruct` + rule-based detection

### Purpose

Detects unusual patterns that may indicate:
- Service degradation
- Logging configuration issues
- Traffic anomalies
- Error rate spikes

### Detection Methods

**1. Rule-Based Detection:**
- Error rate increase > 20% → HIGH severity
- Error rate increase > 10% → MEDIUM severity
- Log volume > 2x baseline → Potential issue
- Log volume < 0.5x baseline → Possible service issue

**2. AI-Enhanced Detection:**
Uses historical baselines and AI analysis for more sophisticated pattern recognition.

### Example Output

```json
{
  "service_name": "api-gateway",
  "has_anomaly": true,
  "severity": "high",
  "description": "Error rate increased by 35% compared to 24-hour average",
  "recommendation": "Investigate error sources immediately. Check for deployment issues or external service failures."
}
```

### Baseline Calculation

- **Current Window**: Last 60 minutes
- **Historical Baseline**: Last 24 hours averaged per hour

### Running Anomaly Detection

**Single Service:**
```typescript
import { detectAnomalies } from './src/agents/anomaly-detector';

const result = await detectAnomalies(env, 'my-service');
if (result.has_anomaly) {
  console.log(`Anomaly detected: ${result.description}`);
}
```

**All Services:**
```typescript
import { detectAllServiceAnomalies } from './src/agents/anomaly-detector';

const anomalies = await detectAllServiceAnomalies(env);
// Returns only services with detected anomalies
```

## Prompt Engineering

### Prompt Templates

All AI prompts are defined in `src/agents/prompts.ts` for easy customization.

### Best Practices

1. **Be Specific**: Clearly define expected output format (e.g., JSON structure)
2. **Provide Context**: Include relevant metrics and time windows
3. **Set Constraints**: Limit output length (e.g., "max 3 recommendations")
4. **Use Examples**: Show desired output format in the prompt
5. **Temperature Control**: Use low temperature for consistent, factual outputs

### Example Prompt Structure

```typescript
const prompt = `You are a log analysis expert.

Context:
- Service: ${serviceName}
- Error Count: ${errorCount}
- Time Window: Last 6 hours

Task:
Analyze the errors and provide recommendations.

Output Format (JSON):
{
  "severity": "LOW|MEDIUM|HIGH|CRITICAL",
  "summary": "string",
  "recommendations": ["string"]
}

Guidelines:
- Keep summary to 1-2 sentences
- Provide max 3 recommendations
- Be specific and actionable`;
```

## Model Configuration

### Current Model

- **Model**: `@cf/meta/llama-3-8b-instruct`
- **Max Tokens**: 300-400 (depending on use case)
- **Temperature**: Not explicitly set (uses default)

### Future Considerations

- **GPT-4** for more complex analysis
- **Specialized models** for anomaly detection
- **Fine-tuned models** on domain-specific logs

## Performance Considerations

### Token Usage

- Average tokens per analysis: ~500-800
- Estimated cost per analysis: ~$0.0001 (varies by model)

### Execution Time

- Analysis per service: 1-3 seconds
- Batch analysis (10 services): 10-30 seconds

### Rate Limits

- Cloudflare AI has rate limits
- Batch operations are throttled to avoid hitting limits
- Failed analyses are logged but don't block the cron job

## Monitoring Agent Performance

### Metrics to Track

1. **Analysis Success Rate**: % of successful AI calls
2. **Average Execution Time**: Time per analysis
3. **False Positive Rate**: Anomalies that weren't real issues
4. **Actionability Score**: How useful are the recommendations?

### Logging Agent Activity

All agent activity is logged to the `logs` table with `source_type = 'agent'`:

```sql
SELECT * FROM logs
WHERE source_type = 'agent'
ORDER BY timestamp DESC;
```

## Future Enhancements

### Planned Features

1. **Pattern Recognition**: Learn recurring patterns over time
2. **Alert Correlation**: Link related errors across services
3. **Predictive Analysis**: Forecast potential issues before they occur
4. **Custom Agents**: Service-specific analysis agents
5. **Interactive Queries**: Natural language log queries via API

### Example Future Use Cases

**Natural Language Queries:**
```
Query: "Show me all payment failures in the last hour"
Agent: Translates to SQL query and returns results with summary
```

**Predictive Alerts:**
```
Agent: "Based on current error rate trajectory, service X will
        reach critical threshold in approximately 2 hours"
```

**Root Cause Analysis:**
```
Agent: "Analyzing error cascade across 5 services...
        Root cause identified: Database connection pool exhaustion
        in auth-service at 14:32 UTC"
```

## Configuration Reference

### Database Tables

**analysis_results:**
Stores AI-generated analysis results

**default_config:**
- `enable_agentic_analysis`: Enable/disable AI analysis (true/false)

### Environment Variables

Configure in `wrangler.toml`:
```toml
[ai]
binding = "AI"

[vars]
ENABLE_WEBSOCKET = "true"
```

## API Integration (Future)

### Planned Endpoints

```
GET  /api/v1/logs/analysis/:service
     - Get latest analysis for a service

POST /api/v1/logs/analyze
     - Trigger on-demand analysis

GET  /api/v1/logs/anomalies
     - Get current anomalies across all services

POST /api/v1/logs/summarize
     - Generate custom summary
```

## Contributing

### Adding New Agents

1. Create agent file in `src/agents/`
2. Define prompts in `src/agents/prompts.ts`
3. Add agent invocation in cron or API handler
4. Update this documentation

### Testing Agents

```typescript
import { analyzeServiceErrors } from './src/cron/analysis';

// Test with mock data
const mockSummary = {
  service_name: 'test-service',
  error_count: 50,
  sample_messages: 'Error: Connection timeout...'
};

const result = await analyzeServiceErrors(env, mockSummary);
console.log(result);
```

## Resources

- [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/)
- [Llama 3 Model Documentation](https://huggingface.co/meta-llama)
- [Prompt Engineering Guide](https://www.promptingguide.ai/)

## Support

For issues or questions about the AI agents:
- Check logs with `source_type = 'agent'`
- Review `analysis_results` table for stored outputs
- Monitor cron job execution in Cloudflare dashboard
