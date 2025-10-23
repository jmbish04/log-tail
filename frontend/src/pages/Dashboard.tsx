import { useState } from 'react';

import { useLogMetrics, useServiceMetrics } from '@/hooks/useLogs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { OverviewCards } from '@/components/dashboard/OverviewCards';
import { Period, PeriodTabs } from '@/components/dashboard/PeriodTabs';
import { LogTrendChart } from '@/components/dashboard/LogTrendChart';
import { ServicesTable } from '@/components/dashboard/ServicesTable';

const DEFAULT_PERIOD: Period = '24h';

function DashboardPage() {
  const [period, setPeriod] = useState<Period>(DEFAULT_PERIOD);
  const { data: metrics, isLoading: metricsLoading } = useLogMetrics(period);
  const { data: serviceMetrics } = useServiceMetrics(period);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Log Intelligence Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor real-time log activity, error rates, and service health across your platform.
          </p>
        </div>
        <Button variant="outline" onClick={() => setPeriod('24h')}>
          Reset to 24h
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Time Window</CardTitle>
          <CardDescription>Select the period you would like to explore</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <PeriodTabs value={period} onValueChange={setPeriod} />
          {period === 'custom' && (
            <p className="text-sm text-muted-foreground">
              Custom range selection is coming soon. For now, pick one of the predefined windows.
            </p>
          )}
        </CardContent>
      </Card>

      <OverviewCards metrics={metrics} isLoading={metricsLoading} />

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <LogTrendChart metrics={metrics} />
        <Card>
          <CardHeader>
            <CardTitle>Insights</CardTitle>
            <CardDescription>Highlights from the selected period</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div>
              <h3 className="font-semibold text-foreground">Anomaly Detection</h3>
              <p>
                Review the Analysis tab to launch AI-assisted investigations on spikes detected in your logs.
              </p>
            </div>
            <Separator />
            <div>
              <h3 className="font-semibold text-foreground">Queue Throughput</h3>
              <p>
                Background analysis jobs leverage Cloudflare Queues. Monitor queue size from the backend worker
                metrics for proactive scaling.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Top Services</h2>
          <p className="text-muted-foreground">
            Identify services with the highest activity and error concentration for the selected window.
          </p>
        </div>
        <ServicesTable services={serviceMetrics?.services} />
      </div>
    </div>
  );
}

export default DashboardPage;
