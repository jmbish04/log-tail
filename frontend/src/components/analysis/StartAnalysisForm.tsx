import { useState } from 'react';
import { formatISO } from 'date-fns';

import { useCreateAnalysis } from '@/hooks/useAnalysis';
import { useServiceMetrics } from '@/hooks/useLogs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

const DEFAULT_RANGE_HOURS = 24;

export function StartAnalysisForm() {
  const { data: serviceMetrics } = useServiceMetrics('24h');
  const [serviceName, setServiceName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [hours, setHours] = useState(DEFAULT_RANGE_HOURS);
  const { toast } = useToast();
  const createAnalysis = useCreateAnalysis();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - hours * 60 * 60 * 1000);

    try {
      const result = await createAnalysis.mutateAsync({
        service_name: serviceName,
        start_time: formatISO(startTime),
        end_time: formatISO(endTime),
        search_term: searchTerm || undefined,
      });

      toast({
        title: 'Analysis launched',
        description: `Session ${result.session_id} is now running.`,
      });
      setSearchTerm('');
    } catch (error) {
      toast({
        title: 'Unable to start analysis',
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-2">
        <label htmlFor="service" className="text-sm font-medium">
          Service
        </label>
        <Select value={serviceName} onValueChange={setServiceName}>
          <SelectTrigger id="service">
            <SelectValue placeholder="Select a service" />
          </SelectTrigger>
          <SelectContent>
            {(serviceMetrics?.services ?? []).map((service) => (
              <SelectItem key={service.service_name} value={service.service_name}>
                {service.service_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <label htmlFor="hours" className="text-sm font-medium">
          Time Range (hours)
        </label>
        <Input
          id="hours"
          type="number"
          min={1}
          max={168}
          value={hours}
          onChange={(event) => setHours(Number(event.target.value))}
        />
      </div>

      <div className="grid gap-2">
        <label htmlFor="search" className="text-sm font-medium">
          Search Term (optional)
        </label>
        <Textarea
          id="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Filter logs by keyword or error signature"
        />
      </div>

      <Button type="submit" disabled={createAnalysis.isPending || !serviceName}>
        {createAnalysis.isPending ? 'Launching analysis...' : 'Start analysis'}
      </Button>
    </form>
  );
}
