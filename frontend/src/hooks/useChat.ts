import { useMutation, useQuery } from '@tanstack/react-query';

import { fetchJson } from '../lib/api';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

export function useChatHistory(sessionId: string) {
  return useQuery({
    queryKey: ['chat-history', sessionId],
    enabled: Boolean(sessionId),
    queryFn: () => fetchJson<ChatMessage[]>(`/api/v1/analysis/chat/${sessionId}`),
    refetchInterval: 5000,
  });
}

export function useSendChatMessage(sessionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (content: string) => {
      if (!sessionId) {
        throw new Error('A valid session ID is required to send chat messages.');
      }

      return fetchJson<ChatMessage>(`/api/v1/analysis/chat/${sessionId}`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['chat-history', sessionId] });
    },
  });
}
