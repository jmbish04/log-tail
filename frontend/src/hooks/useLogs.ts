import { useQuery } from '@tanstack/react-query';

import { fetchJson } from '../lib/api';

export interface LogMetricSummary {
  period: string;
  total_logs: number;
  error_count: number;
  warning_count: number;
  unique_services: number;
  error_rate: number;
}

export interface TrendPoint {
  timestamp: string;
  total_logs: number;
  error_count: number;
}

export interface LogMetricsResponse extends LogMetricSummary {
  trend: TrendPoint[];
}

export interface ServiceMetric {
  service_name: string;
  total_logs: number;
  error_count: number;
  warning_count: number;
  last_seen: string;
}

export interface ServiceMetricsResponse {
  period: string;
  services: ServiceMetric[];
}

export function useLogMetrics(period: string) {
  return useQuery({
    queryKey: ['log-metrics', period],
    queryFn: () =>
      fetchJson<LogMetricsResponse>(`/api/v1/logs/metrics?period=${period}`),
  });
}

export function useServiceMetrics(period: string) {
  return useQuery({
    queryKey: ['service-metrics', period],
    queryFn: () =>
      fetchJson<ServiceMetricsResponse>(`/api/v1/logs/services?period=${period}`),
  });
}
