# Implementation Guide - Cloudflare Logging Service v2.0

This document outlines the completed backend implementation and provides guidance for completing the React frontend.

## ✅ Completed Backend Features

### 1. Durable Objects for State Management
- **File**: `src/durable-objects/AnalysisAgent.ts`
- **Purpose**: Manages state for AI analysis sessions
- **Endpoints**:
  - `/start` - Initialize analysis session
  - `/status` - Get current status
  - `/update` - Update progress
  - `/complete` - Mark as completed
  - `/fail` - Handle failures

### 2. Workflows for Orchestration
- **File**: `src/workflows/analysis-workflow.ts`
- **Steps**:
  1. Initialize session in Durable Object
  2. Fetch logs for time range
  3. Run AI analysis
  4. Store results
  5. Complete session
- **Features**: Automatic error handling and state management

### 3. Queue System
- **File**: `src/queues/analysis-queue.ts`
- **Purpose**: Background processing of analysis jobs
- **Configuration**:
  - Max batch size: 10
  - Max retries: 3
  - Timeout: 30 seconds

### 4. On-Demand Analysis API
- **File**: `src/handlers/analysis.ts`
- **Endpoints**:
  - `POST /api/v1/analysis/analyze` - Trigger analysis
  - `GET /api/v1/analysis/status/:session_id` - Check status
  - `GET /api/v1/analysis/sessions` - List sessions

**UTC Timezone Requirements**:
- All timestamps MUST be ISO 8601 format with 'Z' suffix
- Example: `2024-01-15T00:00:00.000Z`
- Validation ensures UTC timezone compliance
- Max time range: 7 days

### 5. Daily Global Analysis Cron
- **File**: `src/cron/global-analysis.ts`
- **Schedule**: Daily at 3 AM UTC
- **Features**:
  - Analyzes logs from all services
  - Detects global anomalies
  - Generates AI-powered insights
  - Stores in `global_analysis` table
  - Tracks last run time

### 6. Database Schema
New tables added in migration `0003_agent_tables.sql`:

- `global_analysis` - Daily/weekly/monthly trend analysis
- `analysis_sessions` - On-demand analysis tracking
- `chat_history` - AI assistant conversations
- `service_metrics` - Aggregated performance data
- `error_patterns` - Common error tracking
- `analysis_queue` - Queue status tracking
- `job_tracker` - Cron job tracking

### 7. OpenAPI Specification
- **File**: `openapi.json`
- **Features**:
  - Complete API documentation
  - Timezone requirements clearly specified
  - Example requests and responses
  - Security schemes documented

## 📋 Frontend Architecture (To Be Implemented)

### Technology Stack
- **Framework**: React 18 with TypeScript
- **Routing**: React Router v6
- **State Management**: TanStack Query (React Query)
- **UI Components**: shadcn/ui
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Icons**: Lucide React

### Directory Structure
```
frontend/
├── src/
│   ├── components/
│   │   ├── ui/              # shadcn/ui components
│   │   ├── dashboard/       # Dashboard widgets
│   │   ├── service/         # Service detail components
│   │   └── chat/            # AI chat components
│   ├── pages/
│   │   ├── Dashboard.tsx    # Main dashboard
│   │   ├── ServiceDetail.tsx
│   │   └── AnalysisView.tsx
│   ├── lib/
│   │   ├── api.ts           # API client
│   │   └── utils.ts         # Helper functions
│   └── hooks/
│       ├── useAnalysis.ts
│       ├── useLogs.ts
│       └── useChat.ts
└── public/                   # Built assets (for Workers Assets)
```

### Dashboard Requirements

#### Time Period Tabs
```typescript
type Period = '24h' | '7d' | '30d' | '1y' | 'custom';
```

Display metrics for each period:
- Total logs
- Error count and rate
- Warning count
- Unique services affected
- Trend charts (line/area charts)

#### AI Insights Panel
Query `/api/v1/global-analysis` to display:
- Latest global analysis summary
- Detected anomalies with severity badges
- AI recommendations

#### Top Services Widget
Display services ordered by:
- Error count
- Total log volume
- Error rate

Make service names clickable to navigate to detail page.

#### Top Errors Widget
Group errors by:
- Error message pattern
- Error code (from metadata)
- Affected services

### Service Detail Page

#### URL Structure
```
/service/:service_name?start=<timestamp>&end=<timestamp>
```

#### Sections

**1. Performance Metrics**
- Error rate trend chart
- Log volume over time
- P50/P95/P99 response times (if available)

**2. Error Patterns**
Query `error_patterns` table for this service:
- Display common error signatures
- Occurrence count
- First/last seen
- Severity badge
- Status (active/resolved/ignored)

**3. Recent Logs**
- Filterable log list
- Group by session_id if available in metadata
- Click to expand full log details

**4. AI Chat Interface**
Located in a sidebar or bottom panel:

```typescript
interface ChatProps {
  serviceName: string;
  timeRange: { start: number; end: number };
}
```

**Chat API Endpoint** (to be implemented):
```
POST /api/v1/chat
{
  "session_id": "uuid",
  "service_name": "my-service",
  "message": "Why are we seeing timeout errors?",
  "context": {
    "time_range": { "start": 1234567890, "end": 1234567899 },
    "log_ids": ["id1", "id2"]  // Optional, for context
  }
}
```

**Chat Features**:
- Maintain conversation history in `chat_history` table
- Provide relevant log context to AI
- Show loading state during AI response
- Display code snippets with syntax highlighting
- Suggest follow-up questions

### Key API Integrations

#### 1. Dashboard Data
```typescript
// Fetch global analysis
GET /api/v1/global-analysis?period=daily&limit=1

// Fetch service stats
GET /api/v1/logs/services

// Fetch recent errors
GET /api/v1/logs/search?level=ERROR&start_time=X&end_time=Y&limit=50
```

#### 2. Trigger Analysis
```typescript
const triggerAnalysis = async (params: {
  service_name: string;
  start_time: string; // "2024-01-15T00:00:00.000Z"
  end_time: string;   // "2024-01-15T23:59:59.999Z"
  search_term?: string;
}) => {
  const response = await fetch('/api/v1/analysis/analyze', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(params)
  });
  return response.json();
};

// Poll for status
const checkStatus = async (sessionId: string) => {
  const response = await fetch(`/api/v1/analysis/status/${sessionId}`, {
    headers: { 'Authorization': `Bearer ${API_KEY}` }
  });
  return response.json();
};
```

#### 3. UTC Time Handling
```typescript
import { format, parseISO } from 'date-fns';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';

// Always convert to UTC for API
const toUTCString = (date: Date): string => {
  return date.toISOString(); // Returns "2024-01-15T00:00:00.000Z"
};

// Display in user's timezone
const displayTime = (utcString: string, timezone: string = 'America/New_York') => {
  const date = parseISO(utcString);
  return formatInTimeZone(date, timezone, 'PPpp');
};
```

### shadcn/ui Components to Install

```bash
npx shadcn-ui@latest init
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add tabs
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add table
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add input
npx shadcn-ui@latest add select
npx shadcn-ui@latest add textarea
npx shadcn-ui@latest add scroll-area
npx shadcn-ui@latest add separator
npx shadcn-ui@latest add alert
npx shadcn-ui@latest add skeleton
```

### Building for Production

```bash
# Build frontend
cd frontend
npm run build

# Output goes to frontend/dist
# Copy to logsService/public for Workers Assets binding
cp -r dist/* ../public/

# Deploy worker (includes assets)
cd ..
npm run deploy
```

### Environment Variables

Frontend `.env` file:
```
VITE_API_URL=https://logs.example.workers.dev
VITE_API_KEY=your-api-key
VITE_WS_URL=wss://logs.example.workers.dev
```

## 🚀 Deployment Checklist

### Backend
- [ ] Create D1 database: `wrangler d1 create platform-logs-db`
- [ ] Create R2 bucket: `wrangler r2 bucket create platform-logs-archive`
- [ ] Update `wrangler.toml` with database ID
- [ ] Run migrations: `wrangler d1 migrations apply platform-logs-db`
- [ ] Set API key: `wrangler secret put LOG_SERVICE_API_KEY`
- [ ] Deploy: `npm run deploy`
- [ ] Create queue: `wrangler queues create analysis-queue`

### Frontend
- [ ] Install dependencies: `cd frontend && npm install`
- [ ] Configure shadcn/ui: `npx shadcn-ui@latest init`
- [ ] Build: `npm run build`
- [ ] Copy to public: `cp -r dist/* ../public/`
- [ ] Redeploy worker to include assets

## 🧪 Testing

### Test Analysis Endpoint
```bash
curl -X POST https://logs.example.workers.dev/api/v1/analysis/analyze \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "service_name": "test-service",
    "start_time": "2024-01-15T00:00:00.000Z",
    "end_time": "2024-01-15T23:59:59.999Z",
    "search_term": "error"
  }'

# Response:
# {
#   "success": true,
#   "session_id": "uuid",
#   "status_url": "/api/v1/analysis/status/uuid",
#   "estimated_completion": "Within 2-5 minutes"
# }
```

### Check Analysis Status
```bash
curl https://logs.example.workers.dev/api/v1/analysis/status/SESSION_ID \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Verify Global Analysis
```bash
# After cron runs (3 AM UTC)
wrangler d1 execute platform-logs-db --command \
  "SELECT * FROM global_analysis ORDER BY analyzed_at DESC LIMIT 1"
```

## 📊 Monitoring

### Check Durable Object Instances
```bash
wrangler tail --format pretty
# Look for "AnalysisAgent" DO activity
```

### Check Queue Status
```bash
wrangler queues list
wrangler queues metrics analysis-queue
```

### Check Cron Execution
View in Cloudflare Dashboard:
1. Workers & Pages → logsService
2. Triggers tab
3. View cron history

## 🐛 Troubleshooting

### Analysis Not Starting
- Check queue is created: `wrangler queues list`
- Verify DO binding in `wrangler.toml`
- Check worker logs: `wrangler tail`

### Timezone Errors
- Ensure all timestamps end with 'Z'
- Use `toISOString()` in JavaScript
- Validate format: `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/`

### Frontend Not Loading
- Verify assets in `public/` directory
- Check `[assets]` binding in `wrangler.toml`
- Rebuild frontend and redeploy worker

## 📚 Additional Resources

- [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/)
- [Cloudflare Queues](https://developers.cloudflare.com/queues/)
- [Cloudflare Workers Assets](https://developers.cloudflare.com/workers/static-assets/)
- [shadcn/ui Documentation](https://ui.shadcn.com/)
- [TanStack Query](https://tanstack.com/query/latest)
- [Date-fns Timezone](https://date-fns.org/docs/Time-Zones)
