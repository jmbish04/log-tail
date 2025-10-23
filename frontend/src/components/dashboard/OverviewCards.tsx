import { LogMetricsResponse } from '@/hooks/useLogs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface OverviewCardsProps {
  metrics?: LogMetricsResponse;
  isLoading?: boolean;
}

export function OverviewCards({ metrics, isLoading }: OverviewCardsProps) {
  const items = [
    {
      label: 'Total Logs',
      value: metrics?.total_logs.toLocaleString() ?? '—',
      description: metrics ? `${metrics.period.toUpperCase()} window` : '—',
    },
    {
      label: 'Error Rate',
      value: metrics ? `${(metrics.error_rate * 100).toFixed(2)}%` : '—',
      description: metrics
        ? `${metrics.error_count.toLocaleString()} errors`
        : '—',
    },
    {
      label: 'Warnings',
      value: metrics?.warning_count.toLocaleString() ?? '—',
      description: 'Aggregated warnings',
    },
    {
      label: 'Services Impacted',
      value: metrics?.unique_services.toString() ?? '—',
      description: 'Unique services with logs',
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{item.label}</CardTitle>
            {isLoading && <Badge variant="secondary">Loading</Badge>}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{item.value}</div>
            <p className="text-xs text-muted-foreground">{item.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
