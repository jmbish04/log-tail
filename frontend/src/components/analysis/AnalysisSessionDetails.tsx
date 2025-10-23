import { useAnalysisSession } from '@/hooks/useAnalysis';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AnalysisSessionDetailsProps {
  sessionId?: string;
}

export function AnalysisSessionDetails({ sessionId }: AnalysisSessionDetailsProps) {
  const { data, isLoading } = useAnalysisSession(sessionId ?? '');

  if (!sessionId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Select a session</CardTitle>
          <CardDescription>Choose an analysis session to review its results.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading session</CardTitle>
          <CardDescription>Fetching the most recent updates for {sessionId}.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Session unavailable</CardTitle>
          <CardDescription>We could not retrieve details for {sessionId}.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="space-y-2">
        <CardTitle className="flex items-center gap-3">
          Session {data.id}
          <Badge variant={data.status === 'completed' ? 'default' : data.status === 'failed' ? 'destructive' : 'secondary'}>
            {data.status.toUpperCase()}
          </Badge>
        </CardTitle>
        <CardDescription>
          {data.service_name} • Started {new Date(data.started_at).toLocaleString()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold uppercase text-muted-foreground">Summary</h3>
          <p className="text-sm text-foreground">
            {data.summary ?? 'Results will appear here once the AI agent completes its investigation.'}
          </p>
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase text-muted-foreground">Raw Output</h3>
          <ScrollArea className="h-48 rounded-md border p-3 text-sm">
            <pre className="whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}
