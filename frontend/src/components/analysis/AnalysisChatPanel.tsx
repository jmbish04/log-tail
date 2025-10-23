import { useState } from 'react';

import { useChatHistory, useSendChatMessage } from '@/hooks/useChat';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';

interface AnalysisChatPanelProps {
  sessionId?: string;
}

export function AnalysisChatPanel({ sessionId }: AnalysisChatPanelProps) {
  const [message, setMessage] = useState('');
  const { data: history } = useChatHistory(sessionId ?? '');
  const sendMessage = useSendChatMessage(sessionId ?? '');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!sessionId || !message.trim()) {
      return;
    }
    await sendMessage.mutateAsync(message.trim());
    setMessage('');
  };

  if (!sessionId) {
    return null;
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Agent Conversation</CardTitle>
      </CardHeader>
      <CardContent className="h-64">
        <ScrollArea className="h-full pr-3">
          <div className="space-y-4 text-sm">
            {history?.map((entry) => (
              <div key={entry.id} className="rounded-md border p-3">
                <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                  {entry.role}
                </div>
                <p className="whitespace-pre-wrap text-foreground">{entry.content}</p>
              </div>
            )) || <p className="text-muted-foreground">No messages yet.</p>}
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter>
        <form onSubmit={handleSubmit} className="flex w-full flex-col gap-2">
          <Textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Ask the Analysis Agent about the session results..."
          />
          <Button type="submit" disabled={sendMessage.isPending}>
            {sendMessage.isPending ? 'Sending…' : 'Send message'}
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
