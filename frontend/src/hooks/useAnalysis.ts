import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchJson } from '../lib/api';

type SessionStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface AnalysisSession {
  id: string;
  service_name: string;
  status: SessionStatus;
  started_at: string;
  completed_at?: string;
  summary?: string;
}

interface CreateAnalysisPayload {
  service_name: string;
  start_time: string;
  end_time: string;
  search_term?: string;
}

export function useAnalysisSessions() {
  return useQuery({
    queryKey: ['analysis-sessions'],
    queryFn: () => fetchJson<AnalysisSession[]>('/api/v1/analysis/sessions'),
  });
}

export function useAnalysisSession(id: string) {
  return useQuery({
    queryKey: ['analysis-session', id],
    queryFn: () => fetchJson<AnalysisSession>(`/api/v1/analysis/status/${id}`),
    enabled: Boolean(id),
    refetchInterval: (data) =>
      data?.status && ['completed', 'failed'].includes(data.status)
        ? false
        : 5000,
  });
}

export function useCreateAnalysis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateAnalysisPayload) =>
      fetchJson<{ success: boolean; session_id: string }>(
        '/api/v1/analysis/analyze',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['analysis-sessions'] });
    },
  });
}
