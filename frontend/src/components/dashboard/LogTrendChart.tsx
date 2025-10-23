import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { LogMetricsResponse } from '@/hooks/useLogs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface LogTrendChartProps {
  metrics?: LogMetricsResponse;
}

export function LogTrendChart({ metrics }: LogTrendChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Log Volume Trend</CardTitle>
      </CardHeader>
      <CardContent className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={metrics?.trend ?? []}>
            <defs>
              <linearGradient id="colorLogs" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="timestamp" tickLine={false} axisLine={false} minTickGap={32} />
            <YAxis tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ background: 'hsl(var(--popover))', borderRadius: 8 }}
              labelFormatter={(value) => new Date(value).toLocaleString()}
            />
            <Area
              type="monotone"
              dataKey="total_logs"
              stroke="hsl(var(--primary))"
              fill="url(#colorLogs)"
              name="Total logs"
            />
            <Area
              type="monotone"
              dataKey="error_count"
              stroke="hsl(var(--destructive))"
              fill="hsl(var(--destructive) / 0.2)"
              name="Errors"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
