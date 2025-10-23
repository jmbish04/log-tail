import { formatDistanceToNow } from 'date-fns';

import { ServiceMetric } from '@/hooks/useLogs';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface ServicesTableProps {
  services?: ServiceMetric[];
}

export function ServicesTable({ services }: ServicesTableProps) {
  return (
    <div className="overflow-hidden rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Service</TableHead>
            <TableHead className="text-right">Total Logs</TableHead>
            <TableHead className="text-right">Errors</TableHead>
            <TableHead className="text-right">Warnings</TableHead>
            <TableHead>Last Seen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {services?.length ? (
            services.map((service) => (
              <TableRow key={service.service_name}>
                <TableCell className="font-medium">{service.service_name}</TableCell>
                <TableCell className="text-right">
                  {service.total_logs.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant={service.error_count > 0 ? 'destructive' : 'outline'}>
                    {service.error_count.toLocaleString()}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {service.warning_count.toLocaleString()}
                </TableCell>
                <TableCell>
                  {formatDistanceToNow(new Date(service.last_seen), { addSuffix: true })}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                No services available for the selected period.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
