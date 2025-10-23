import { Link } from 'react-router-dom';

import { AnalysisSession } from '@/hooks/useAnalysis';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface AnalysisSessionsTableProps {
  sessions?: AnalysisSession[];
}

const STATUS_MAP: Record<AnalysisSession['status'], string> = {
  pending: 'Pending',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
};

export function AnalysisSessionsTable({ sessions }: AnalysisSessionsTableProps) {
  return (
    <div className="overflow-hidden rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Session</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Service</TableHead>
            <TableHead>Started</TableHead>
            <TableHead>Completed</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sessions?.length ? (
            sessions.map((session) => (
              <TableRow key={session.id}>
                <TableCell className="font-medium">
                  <Link to={`?session=${session.id}`} className="hover:underline">
                    {session.id}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      session.status === 'failed'
                        ? 'destructive'
                        : session.status === 'completed'
                        ? 'default'
                        : 'secondary'
                    }
                  >
                    {STATUS_MAP[session.status]}
                  </Badge>
                </TableCell>
                <TableCell>{session.service_name}</TableCell>
                <TableCell>{new Date(session.started_at).toLocaleString()}</TableCell>
                <TableCell>
                  {session.completed_at ? new Date(session.completed_at).toLocaleString() : '—'}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                No analysis sessions have been created yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
