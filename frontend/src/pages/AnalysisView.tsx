import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useAnalysisSessions } from '@/hooks/useAnalysis';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { StartAnalysisForm } from '@/components/analysis/StartAnalysisForm';
import { AnalysisSessionsTable } from '@/components/analysis/AnalysisSessionsTable';
import { AnalysisSessionDetails } from '@/components/analysis/AnalysisSessionDetails';
import { AnalysisChatPanel } from '@/components/analysis/AnalysisChatPanel';

function AnalysisViewPage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session') ?? undefined;
  const { data: sessions } = useAnalysisSessions();

  const sortedSessions = useMemo(
    () =>
      [...(sessions ?? [])].sort(
        (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
      ),
    [sessions],
  );

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">AI Analysis</h1>
        <p className="text-muted-foreground">
          Launch targeted investigations and collaborate with the Analysis Agent to understand issues faster.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Start a new analysis</CardTitle>
            <CardDescription>Select a service and log window to begin.</CardDescription>
          </CardHeader>
          <CardContent>
            <StartAnalysisForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Sessions</CardTitle>
            <CardDescription>Review the history of analyses kicked off by your team.</CardDescription>
          </CardHeader>
          <CardContent>
            <AnalysisSessionsTable sessions={sortedSessions} />
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <AnalysisSessionDetails sessionId={sessionId} />
        <AnalysisChatPanel sessionId={sessionId} />
      </div>
    </div>
  );
}

export default AnalysisViewPage;
