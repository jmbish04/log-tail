import { useMemo, useState } from 'react';

import { useServiceMetrics } from '@/hooks/useLogs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';

function ServiceDetailPage() {
  const { data } = useServiceMetrics('7d');
  const [selectedService, setSelectedService] = useState<string | null>(null);

  const services = data?.services ?? [];
  const activeService = useMemo(
    () => services.find((service) => service.service_name === selectedService) ?? services[0],
    [services, selectedService],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Services</CardTitle>
          <CardDescription>Pick a service to inspect its health trends.</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[480px] pr-4">
            <ul className="space-y-3">
              {services.map((service) => (
                <li key={service.service_name}>
                  <button
                    type="button"
                    onClick={() => setSelectedService(service.service_name)}
                    className={`w-full rounded-md border px-3 py-2 text-left text-sm transition hover:bg-muted ${
                      activeService?.service_name === service.service_name
                        ? 'border-primary bg-muted'
                        : 'border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{service.service_name}</span>
                      <Badge variant={service.error_count ? 'destructive' : 'outline'}>
                        {service.error_count} errors
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {service.total_logs.toLocaleString()} logs • {service.warning_count} warnings
                    </p>
                  </button>
                </li>
              ))}
              {!services.length && <p className="text-sm text-muted-foreground">No services available.</p>}
            </ul>
          </ScrollArea>
        </CardContent>
      </Card>

      {activeService ? (
        <Card>
          <CardHeader>
            <CardTitle>{activeService.service_name}</CardTitle>
            <CardDescription>
              {activeService.total_logs.toLocaleString()} logs collected in the last 7 days.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold uppercase text-muted-foreground">Error Ratio</h3>
              <Progress value={Math.min((activeService.error_count / activeService.total_logs) * 100, 100)} />
              <p className="mt-2 text-sm text-muted-foreground">
                {activeService.error_count.toLocaleString()} errors across {activeService.total_logs.toLocaleString()} logs
                ({((activeService.error_count / Math.max(activeService.total_logs, 1)) * 100).toFixed(2)}%).
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold uppercase text-muted-foreground">Warnings</h3>
              <p className="text-sm text-muted-foreground">
                {activeService.warning_count.toLocaleString()} warnings were observed for this service. Review recent
                deploys or configuration changes for potential causes.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold uppercase text-muted-foreground">Recommendations</h3>
              <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                <li>Trigger an AI analysis run for this service from the Analysis tab.</li>
                <li>Ensure log retention policies in R2 are aligned with incident response requirements.</li>
                <li>Review durable object state snapshots for anomalies detected by the Analysis Agent.</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Select a service</CardTitle>
            <CardDescription>Choose a service from the list to view details.</CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}

export default ServiceDetailPage;
